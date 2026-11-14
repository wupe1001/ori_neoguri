import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'ori-neoguri-attachments-'));
process.env.SQLITE_PATH = path.join(directory, 'test.sqlite');
process.env.SESSION_SECRET ||= 'test-secret';
process.env.BAZE_API_KEY ||= 'test-key';
process.env.GENERATION_MODEL ||= 'test-model';
process.env.MODEL_TIMEOUT_MS ||= '1000';
process.env.CRISIS_CONFIDENCE_THRESHOLD ||= '0.5';
process.env.NOTICE_CONFIDENCE_THRESHOLD ||= '0.5';
process.env.SUFFICIENCY_CONFIDENCE_THRESHOLD ||= '0.5';
process.env.SUBJECT_CONFIDENCE_THRESHOLD ||= '0.5';
process.env.UNIT_CONFIDENCE_THRESHOLD ||= '0.5';

const { db } = await import('../src/db/database.js');
const { store } = await import('../src/repositories/store.js');
const { prepareAttachments, attachmentMetadata, safeMimeType } = await import('../src/services/attachment.js');

after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

function insertUser(loginId, role, homeroomTeacherId = null) {
  return Number(db.prepare(`INSERT INTO users
    (login_id, password, nickname, role, homeroom_teacher_id, created_at)
    VALUES (?, 'pw', ?, ?, ?, ?)`)
    .run(loginId, loginId, role, homeroomTeacherId, new Date().toISOString()).lastInsertRowid);
}

test('질문 첨부파일의 메타데이터와 BLOB을 트랜잭션으로 저장하고 권한을 제한한다', () => {
  const teacherId = insertUser('teacher', 'TEACHER');
  const otherTeacherId = insertUser('other-teacher', 'TEACHER');
  const studentId = insertUser('student', 'STUDENT', teacherId);
  const otherStudentId = insertUser('other-student', 'STUDENT', teacherId);
  const [attachment] = prepareAttachments([{
    originalname: '질문 자료.bin',
    mimetype: 'application/octet-stream',
    buffer: Buffer.from([0, 1, 2, 3]),
  }]);

  const questionId = store.createQuestion(studentId, '첨부 질문', [attachment]);
  const question = store.getQuestion(questionId);
  store.updateQuestion(questionId, { assigned_teacher_id: teacherId, status: 'ASSIGNED' });

  const [metadata] = store.listQuestionAttachments(questionId);
  assert.deepEqual(attachmentMetadata(metadata), {
    id: metadata.id,
    originalName: '질문 자료.bin',
    mimeType: 'application/octet-stream',
    sizeBytes: 4,
    downloadUrl: `/api/files/${metadata.id}`,
  });
  assert.deepEqual(store.getAuthorizedFile(metadata.id, studentId).content, Buffer.from([0, 1, 2, 3]));
  assert.deepEqual(store.getAuthorizedFile(metadata.id, teacherId).content, Buffer.from([0, 1, 2, 3]));
  assert.equal(store.getAuthorizedFile(metadata.id, otherStudentId), undefined);
  assert.equal(store.getAuthorizedFile(metadata.id, otherTeacherId), undefined);
  assert.equal(question.original_content, '첨부 질문');
});

test('교사 답변과 첨부파일 및 질문 상태를 하나의 트랜잭션으로 저장한다', () => {
  const teacherId = insertUser('answer-teacher', 'TEACHER');
  const studentId = insertUser('answer-student', 'STUDENT', teacherId);
  const questionId = store.createQuestion(studentId, '답변이 필요한 질문');
  store.updateQuestion(questionId, { assigned_teacher_id: teacherId, status: 'ASSIGNED' });
  const attachments = prepareAttachments([{
    originalname: '답변.txt', mimetype: 'text/plain', buffer: Buffer.from('answer'),
  }]);

  const answer = store.createTeacherAnswer(questionId, teacherId, '답변입니다.', attachments);
  assert.equal(answer.kind, 'CREATED');
  assert.equal(store.getQuestion(questionId).status, 'ANSWERED');
  const [metadata] = store.listAnswerAttachments(answer.id);
  assert.equal(metadata.originalName, '답변.txt');
  assert.equal(store.getAuthorizedFile(metadata.id, studentId).content.toString(), 'answer');
  assert.equal(store.getAuthorizedFile(metadata.id, teacherId).content.toString(), 'answer');
});

test('저장 MIME 형식이 유효하지 않으면 다운로드 형식을 octet-stream으로 낮춘다', () => {
  assert.equal(safeMimeType('text/plain'), 'text/plain');
  assert.equal(safeMimeType('text/plain\r\nX-Bad: true'), 'application/octet-stream');
});
