import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import Database from 'better-sqlite3';

const testDirectory = mkdtempSync(path.join(tmpdir(), 'ori-neoguri-question-improvement-'));

process.env.SESSION_SECRET ||= 'test-secret';
process.env.BAZE_API_KEY ||= 'test-api-key';
process.env.GENERATION_MODEL ||= 'test-model';
process.env.MODEL_TIMEOUT_MS ||= '1000';
process.env.CRISIS_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.NOTICE_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SUFFICIENCY_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SUBJECT_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SQLITE_PATH = path.join(testDirectory, 'test.sqlite');

const { db, migrateLegacyQuestionImprovement, migrateFinalSuggestionStatus, migrateFinalSuggestionColumn } = await import('../src/db/database.js');
const { store } = await import('../src/repositories/store.js');
const { QuestionPipeline } = await import('../src/services/question-pipeline.js');
const { ModelError } = await import('../src/errors.js');

after(() => {
  db.close();
  rmSync(testDirectory, { recursive: true, force: true });
});

test('기존 육하원칙 질문 상태를 복구 가능한 개선 상태로 마이그레이션한다', () => {
  const legacy = new Database(path.join(testDirectory, 'legacy.sqlite'));
  legacy.pragma('foreign_keys = ON');
  legacy.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE subjects (id INTEGER PRIMARY KEY);
    CREATE TABLE questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id),
      original_content TEXT NOT NULL,
      final_content TEXT,
      rewritten_content TEXT,
      status TEXT NOT NULL CHECK (status IN ('PROCESSING','NEEDS_DETAILS','REWRITING','AWAITING_CONFIRMATION','PROCESSING_FAILED')),
      route_type TEXT,
      subject_id INTEGER REFERENCES subjects(id),
      assigned_teacher_id INTEGER REFERENCES users(id),
      teacher_read_at TEXT,
      failed_stage TEXT,
      retry_status TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE question_details (
      question_id INTEGER PRIMARY KEY REFERENCES questions(id),
      who TEXT NOT NULL, when_text TEXT NOT NULL, where_text TEXT NOT NULL,
      what TEXT NOT NULL, how TEXT NOT NULL, why TEXT NOT NULL, created_at TEXT NOT NULL
    );
    INSERT INTO users (id) VALUES (1);
    INSERT INTO questions (id, student_id, original_content, final_content, status, created_at, updated_at)
      VALUES (1, 1, '원 질문', '원 질문', 'NEEDS_DETAILS', '2026-01-01', '2026-01-01');
    INSERT INTO question_details VALUES (1, '누가', '언제', '어디서', '무엇을', '어떻게', '왜', '2026-01-01');
  `);

  migrateLegacyQuestionImprovement(legacy);

  const question = legacy.prepare('SELECT status, failed_stage AS failedStage, retry_status AS retryStatus FROM questions WHERE id = 1').get();
  assert.deepEqual(question, {
    status: 'PROCESSING_FAILED',
    failedStage: 'IMPROVEMENT_STAGE_1_GENERATION',
    retryStatus: 'GENERATING_IMPROVEMENT_STAGE_1',
  });
  assert.equal(legacy.prepare("SELECT COUNT(*) AS count FROM legacy_question_details").get().count, 1);
  legacy.close();
});

test('기존 질문 개선 스키마에 최종 추천 생성 상태를 추가한다', () => {
  const previous = new Database(path.join(testDirectory, 'previous-improvement.sqlite'));
  previous.pragma('foreign_keys = ON');
  previous.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE subjects (id INTEGER PRIMARY KEY);
    CREATE TABLE questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id), original_content TEXT NOT NULL, final_content TEXT,
      status TEXT NOT NULL CHECK (status IN ('PROCESSING','GENERATING_IMPROVEMENT_STAGE_1','AWAITING_IMPROVEMENT_STAGE_1','GENERATING_IMPROVEMENT_STAGE_2','AWAITING_IMPROVEMENT_STAGE_2','GENERATING_IMPROVEMENT_STAGE_3','AWAITING_FINAL_QUESTION','NEEDS_SUBJECT_SELECTION','ASSIGNED','ANSWERED','NOTICE_ANSWERED','PROCESSING_FAILED')),
      route_type TEXT, subject_id INTEGER REFERENCES subjects(id), assigned_teacher_id INTEGER REFERENCES users(id),
      teacher_read_at TEXT, failed_stage TEXT, retry_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE question_improvements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER NOT NULL UNIQUE REFERENCES questions(id),
      stage1_prompt TEXT, stage1_student_answer TEXT, stage2_prompt TEXT, stage2_student_answer TEXT,
      stage3_prompt TEXT, final_question TEXT, created_at TEXT NOT NULL, completed_at TEXT
    );
    INSERT INTO users (id) VALUES (1);
    INSERT INTO questions (id, student_id, original_content, final_content, status, created_at, updated_at)
      VALUES (1, 1, '원 질문', '원 질문', 'AWAITING_IMPROVEMENT_STAGE_1', '2026-01-01', '2026-01-01');
  `);

  migrateFinalSuggestionStatus(previous);
  migrateFinalSuggestionColumn(previous);

  previous.prepare("UPDATE questions SET status = 'GENERATING_FINAL_QUESTION_SUGGESTION' WHERE id = 1").run();
  assert.equal(previous.prepare('SELECT status FROM questions WHERE id = 1').get().status, 'GENERATING_FINAL_QUESTION_SUGGESTION');
  assert.ok(previous.prepare('PRAGMA table_info(question_improvements)').all().some(({ name }) => name === 'final_suggestion'));
  previous.close();
});

test('네 단계 질문 개선 이력을 저장하고 완료 후 충분성 판단을 생략한다', async () => {
  const createdAt = new Date().toISOString();
  const teacherId = Number(db.prepare(
    "INSERT INTO users (login_id, password, nickname, role, created_at) VALUES ('teacher', 'password', '선생님', 'TEACHER', ?)",
  ).run(createdAt).lastInsertRowid);
  const studentId = Number(db.prepare(
    "INSERT INTO users (login_id, password, nickname, role, homeroom_teacher_id, created_at) VALUES ('student', 'password', '학생', 'STUDENT', ?, ?)",
  ).run(teacherId, createdAt).lastInsertRowid);
  const subjectId = Number(db.prepare('INSERT INTO subjects (name, teacher_id) VALUES (?, ?)')
    .run('영어', teacherId).lastInsertRowid);

  const calls = { sufficiency: 0 };
  const decision = {
    detectCrisis: async () => ({ probability: 0.01, confidence: 0.99, provider: 'TEST', model: 'test' }),
    matchNotices: async () => ({ answerable: false, noticeIds: [], provider: 'TEST', model: 'test' }),
    checkSufficiency: async () => {
      calls.sufficiency += 1;
      return { probability: 0.1, confidence: 0.9, provider: 'TEST', model: 'test' };
    },
    classifySubject: async () => ({ subjectId, confidence: 1, provider: 'TEST', model: 'test' }),
  };
  const generation = {
    generateImprovementStage1: async () => ({
      prompt: '현재완료에서 어디까지는 알고 있나요?',
      exampleAnswers: ['형태는 알아요.', '과거시제와 차이가 헷갈려요.'],
    }),
    generateImprovementStage2: async () => ({ prompt: '헷갈렸던 실제 문장을 하나 적어 주세요.' }),
    generateImprovementStage3: async () => ({
      prompt: '궁금증에 가까운 질문을 골라 자유롭게 고쳐 주세요.',
      candidates: [
        { question: '두 문장의 뜻은 어떻게 다른가요?', type: '차이', bloomLevel: '분석' },
        { question: '왜 현재완료를 따로 쓰나요?', type: '이유', bloomLevel: '이해' },
      ],
    }),
  };
  const pipeline = new QuestionPipeline(decision, generation);
  const questionId = store.createQuestion(studentId, '현재완료 모르겠어요.');

  const stage1 = await pipeline.run(questionId);
  assert.equal(stage1.status, 'AWAITING_IMPROVEMENT_STAGE_1');
  assert.equal(store.submitImprovementStage1(questionId, '과거시제와 차이가 헷갈려요.'), true);

  const stage2 = await pipeline.improvement.generateStage2(questionId);
  assert.equal(stage2.status, 'AWAITING_IMPROVEMENT_STAGE_2');
  assert.equal(store.submitImprovementStage2(questionId, 'I have lost my key와 I lost my key'), true);

  const stage3 = await pipeline.improvement.generateStage3(questionId);
  assert.equal(stage3.status, 'AWAITING_FINAL_QUESTION');
  assert.match(stage3.candidates[0].id, /^candidate_\d+$/);
  await assert.rejects(
    pipeline.improvement.requestFinalSuggestion(questionId),
    (error) => error.code === 'QUESTION_INVALID_STATE',
  );

  const finalQuestion = 'I have lost my key와 I lost my key의 차이는 무엇인가요?';
  assert.equal(store.finalizeImprovement(questionId, finalQuestion), true);
  const result = await pipeline.run(questionId);

  assert.equal(result.status, 'ASSIGNED');
  assert.equal(calls.sufficiency, 1);
  assert.equal(store.getQuestion(questionId).final_content, finalQuestion);
  assert.deepEqual(store.getImprovement(questionId).stage4, { suggestedQuestion: null, finalQuestion });
  assert.equal(store.getImprovement(questionId).stage3.candidates.length, 2);
});

test('중간 단계 추천을 한 번만 생성하고 실패 시 retry로 재개한다', async () => {
  const studentId = db.prepare("SELECT id FROM users WHERE login_id = 'student'").get().id;
  const subjectId = db.prepare("SELECT id FROM subjects WHERE name = '영어'").get().id;
  let suggestionCalls = 0;
  let failSuggestion = false;
  const decision = {
    detectCrisis: async () => ({ probability: 0.01, confidence: 0.99, provider: 'TEST', model: 'test' }),
    matchNotices: async () => ({ answerable: false, noticeIds: [], provider: 'TEST', model: 'test' }),
    checkSufficiency: async () => ({ probability: 0.1, confidence: 0.9, provider: 'TEST', model: 'test' }),
    classifySubject: async () => ({ subjectId, confidence: 1, provider: 'TEST', model: 'test' }),
  };
  const generation = {
    generateImprovementStage1: async () => ({
      prompt: '어디까지 알고 있나요?',
      exampleAnswers: ['개념은 알아요.', '사용법이 헷갈려요.'],
    }),
    generateFinalQuestionSuggestion: async () => {
      suggestionCalls += 1;
      if (failSuggestion) {
        failSuggestion = false;
        throw new ModelError('MODEL_PROVIDER_UNAVAILABLE', '일시적인 생성 실패입니다.');
      }
      return { suggestedQuestion: '현재완료를 언제 사용하는지 알려 주세요.' };
    },
  };
  const pipeline = new QuestionPipeline(decision, generation);

  const cachedQuestionId = store.createQuestion(studentId, '현재완료가 어려워요.');
  await pipeline.run(cachedQuestionId);
  const first = await pipeline.improvement.requestFinalSuggestion(cachedQuestionId);
  const duplicate = await pipeline.improvement.requestFinalSuggestion(cachedQuestionId);

  assert.deepEqual(duplicate, first);
  assert.equal(suggestionCalls, 1);
  assert.deepEqual(store.getImprovement(cachedQuestionId), {
    stage1: {
      prompt: '어디까지 알고 있나요?',
      exampleAnswers: ['개념은 알아요.', '사용법이 헷갈려요.'],
      studentAnswer: null,
    },
    stage2: { prompt: null, studentAnswer: null },
    stage3: { prompt: null, candidates: [] },
    stage4: { suggestedQuestion: first.suggestedQuestion, finalQuestion: null },
  });
  assert.equal(store.finalizeImprovement(cachedQuestionId, first.suggestedQuestion), true);
  assert.equal((await pipeline.run(cachedQuestionId)).status, 'ASSIGNED');

  const failedImprovementId = store.createQuestion(studentId, '문법 질문이에요.');
  await pipeline.run(failedImprovementId);
  store.updateQuestion(failedImprovementId, {
    status: 'PROCESSING_FAILED',
    failed_stage: 'IMPROVEMENT_STAGE_2_GENERATION',
    retry_status: 'GENERATING_IMPROVEMENT_STAGE_2',
  }, 'AWAITING_IMPROVEMENT_STAGE_1');
  const fromFailedStage = await pipeline.improvement.requestFinalSuggestion(failedImprovementId);
  assert.equal(fromFailedStage.status, 'AWAITING_FINAL_QUESTION');

  const retryQuestionId = store.createQuestion(studentId, '또 다른 문법 질문이에요.');
  await pipeline.run(retryQuestionId);
  failSuggestion = true;
  await assert.rejects(
    pipeline.improvement.requestFinalSuggestion(retryQuestionId),
    (error) => error instanceof ModelError,
  );
  assert.equal(store.getQuestion(retryQuestionId).failed_stage, 'FINAL_QUESTION_SUGGESTION_GENERATION');

  const retried = await pipeline.retry(retryQuestionId);
  assert.equal(retried.status, 'AWAITING_FINAL_QUESTION');
  assert.equal(store.getQuestion(retryQuestionId).status, 'AWAITING_FINAL_QUESTION');
});
