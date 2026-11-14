import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET ||= 'test-secret';
process.env.BAZE_API_KEY ||= 'test-key';
process.env.GENERATION_MODEL ||= 'test-model';
process.env.MODEL_TIMEOUT_MS ||= '1000';
process.env.CRISIS_CONFIDENCE_THRESHOLD ||= '0.5';
process.env.NOTICE_CONFIDENCE_THRESHOLD ||= '0.5';
process.env.SUFFICIENCY_CONFIDENCE_THRESHOLD ||= '0.5';
process.env.SUBJECT_CONFIDENCE_THRESHOLD ||= '0.5';
process.env.ATTACHMENT_MAX_COUNT = '2';
process.env.ATTACHMENT_MAX_FILE_BYTES = '4';
process.env.ATTACHMENT_MAX_TOTAL_BYTES = '6';

const { mapMulterError, validateParsedAttachments } = await import('../src/middleware/multipart-upload.js');

test('Multer 파일 개수 제한을 ATTACHMENT_COUNT_EXCEEDED로 변환한다', () => {
  const error = mapMulterError({ code: 'LIMIT_FILE_COUNT' });
  assert.equal(error.status, 400);
  assert.equal(error.code, 'ATTACHMENT_COUNT_EXCEEDED');
});

test('Multer 개별 파일 크기 제한을 ATTACHMENT_FILE_TOO_LARGE로 변환한다', () => {
  const error = mapMulterError({ code: 'LIMIT_FILE_SIZE' });
  assert.equal(error.status, 413);
  assert.equal(error.code, 'ATTACHMENT_FILE_TOO_LARGE');
});

test('전체 파일 크기 제한을 ATTACHMENT_TOTAL_TOO_LARGE로 반환한다', () => {
  assert.throws(
    () => validateParsedAttachments([{ buffer: Buffer.from('1234') }, { buffer: Buffer.from('5678') }]),
    (error) => error.status === 413 && error.code === 'ATTACHMENT_TOTAL_TOO_LARGE',
  );
});

test('빈 파일을 ATTACHMENT_EMPTY로 반환한다', () => {
  assert.throws(
    () => validateParsedAttachments([{ buffer: Buffer.alloc(0) }]),
    (error) => error.status === 400 && error.code === 'ATTACHMENT_EMPTY',
  );
});

test('그 밖의 Multer 형식 오류를 MULTIPART_INVALID로 변환한다', () => {
  const error = mapMulterError({ code: 'LIMIT_UNEXPECTED_FILE' });
  assert.equal(error.status, 400);
  assert.equal(error.code, 'MULTIPART_INVALID');
});
