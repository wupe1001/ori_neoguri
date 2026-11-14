import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'ori-neoguri-units-'));
process.env.SQLITE_PATH = path.join(directory, 'test.sqlite');
process.env.SESSION_SECRET ||= 'test-secret';
process.env.BAZE_API_KEY ||= 'test-key';
process.env.GENERATION_MODEL ||= 'test-model';
process.env.MODEL_TIMEOUT_MS ||= '1000';
process.env.CRISIS_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.NOTICE_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SUFFICIENCY_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SUBJECT_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.UNIT_CONFIDENCE_THRESHOLD ||= '0.8';

const { ModelError } = await import('../src/errors.js');
const { db } = await import('../src/db/database.js');
const { store } = await import('../src/repositories/store.js');
const { QuestionPipeline } = await import('../src/services/question-pipeline.js');

let teacherId;
let studentId;
let subject;
let grammarUnit;
let readingUnit;

before(() => {
  const createdAt = new Date().toISOString();
  teacherId = Number(db.prepare(`INSERT INTO users
    (login_id, password, nickname, role, created_at) VALUES ('teacher', 'pw', '선생님', 'TEACHER', ?)`)
    .run(createdAt).lastInsertRowid);
  studentId = Number(db.prepare(`INSERT INTO users
    (login_id, password, nickname, role, homeroom_teacher_id, created_at)
    VALUES ('student', 'pw', '학생', 'STUDENT', ?, ?)`)
    .run(teacherId, createdAt).lastInsertRowid);
  const subjectId = Number(db.prepare('INSERT INTO subjects (name, teacher_id) VALUES (?, ?)')
    .run('영어', teacherId).lastInsertRowid);
  grammarUnit = {
    id: Number(db.prepare('INSERT INTO subject_units (subject_id, name) VALUES (?, ?)')
      .run(subjectId, '문법').lastInsertRowid),
    subjectId,
    name: '문법',
  };
  readingUnit = {
    id: Number(db.prepare('INSERT INTO subject_units (subject_id, name) VALUES (?, ?)')
      .run(subjectId, '독해').lastInsertRowid),
    subjectId,
    name: '독해',
  };
  subject = store.getSubject(subjectId);
});

after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

function decisionWith(classifyUnit) {
  return {
    detectCrisis: async () => ({ probability: 0.01, confidence: 0.99, provider: 'TEST', model: 'test' }),
    matchNotices: async () => ({ answerable: false, noticeIds: [], provider: 'TEST', model: 'test' }),
    checkSufficiency: async () => ({ probability: 1, confidence: 1, provider: 'TEST', model: 'test' }),
    classifySubject: async () => ({ subjectId: subject.id, confidence: 1, provider: 'TEST', model: 'test' }),
    classifyUnit,
  };
}

test('과목 자동 분류 뒤 단원 태그를 하나 저장하고 판단 로그를 남긴다', async () => {
  const pipeline = new QuestionPipeline(decisionWith(async (_question, selectedSubject, units) => {
    assert.equal(selectedSubject.id, subject.id);
    assert.deepEqual(units.map(({ name }) => name), ['문법', '독해']);
    return { unitId: grammarUnit.id, confidence: 0.95, probabilities: {}, provider: 'TEST', model: 'test' };
  }), {});
  const questionId = store.createQuestion(studentId, '현재완료와 과거시제의 차이는 무엇인가요?');

  const result = await pipeline.run(questionId);

  assert.deepEqual(result.unit, { id: grammarUnit.id, name: '문법' });
  assert.equal(store.getQuestion(questionId).unit_id, grammarUnit.id);
  assert.ok(store.getLatestDecision(questionId, 'UNIT_CLASSIFICATION'));
});

test('단원 신뢰도가 낮거나 모델이 실패하면 태그 없이 정상 배정한다', async () => {
  const lowConfidence = new QuestionPipeline(decisionWith(async () => ({
    unitId: readingUnit.id, confidence: 0.2, probabilities: {}, provider: 'TEST', model: 'test',
  })), {});
  const lowQuestionId = store.createQuestion(studentId, '긴 영어 지문 질문입니다.');
  const lowResult = await lowConfidence.run(lowQuestionId);
  assert.equal(lowResult.status, 'ASSIGNED');
  assert.equal(lowResult.unit, null);
  assert.equal(store.getQuestion(lowQuestionId).unit_id, null);
  assert.ok(store.getLatestDecision(lowQuestionId, 'UNIT_CLASSIFICATION'));

  const failed = new QuestionPipeline(decisionWith(async () => {
    throw new ModelError('MODEL_PROVIDER_UNAVAILABLE', '단원 분류 실패');
  }), {});
  const failedQuestionId = store.createQuestion(studentId, '또 다른 영어 질문입니다.');
  const failedResult = await failed.run(failedQuestionId);
  const failedQuestion = store.getQuestion(failedQuestionId);
  assert.equal(failedResult.status, 'ASSIGNED');
  assert.equal(failedResult.unit, null);
  assert.equal(failedQuestion.status, 'ASSIGNED');
  assert.equal(failedQuestion.failed_stage, null);
});

test('학생이 과목을 직접 선택해도 단원 분류 후 원자적으로 배정한다', async () => {
  const pipeline = new QuestionPipeline(decisionWith(async () => ({
    unitId: readingUnit.id, confidence: 0.9, probabilities: {}, provider: 'TEST', model: 'test',
  })), {});
  const questionId = store.createQuestion(studentId, '영어 지문의 요지를 모르겠어요.');
  store.updateQuestion(questionId, { status: 'NEEDS_SUBJECT_SELECTION' }, 'PROCESSING');

  const result = await pipeline.assignSelectedSubject(questionId, subject);

  assert.deepEqual(result.unit, { id: readingUnit.id, name: '독해' });
  assert.equal(store.getQuestion(questionId).unit_id, readingUnit.id);
  assert.equal(await pipeline.assignSelectedSubject(questionId, subject), null);
});

test('학생·교사 조회에 단원 태그를 제공하고 교사 목록을 unitId로 필터링한다', () => {
  const taggedId = store.createQuestion(studentId, '문법 질문');
  assert.equal(store.assignSubject(taggedId, subject, grammarUnit), 1);
  const untaggedId = store.createQuestion(studentId, '분류되지 않은 질문');
  assert.equal(store.assignSubject(untaggedId, subject, null), 1);

  const studentItems = store.listStudentQuestions(studentId, 100, 0);
  assert.deepEqual(JSON.parse(studentItems.find(({ id }) => id === taggedId).unitJson), { id: grammarUnit.id, name: '문법' });
  assert.equal(studentItems.find(({ id }) => id === untaggedId).unitJson, null);

  const filtered = store.listTeacherQuestions(teacherId, { unitId: grammarUnit.id }, 100, 0);
  assert.ok(filtered.items.some(({ id }) => id === taggedId));
  assert.equal(filtered.items.some(({ id }) => id === untaggedId), false);
  assert.equal(filtered.items.every(({ unitId }) => unitId === grammarUnit.id), true);
  assert.throws(
    () => store.updateQuestion(taggedId, { unit_id: readingUnit.id }),
    /question unit is immutable/,
  );
});
