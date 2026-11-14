import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'ori-neoguri-seed-'));
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

const { db, validateSeed } = await import('../src/db/database.js');

after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

function validSeed() {
  return {
    teachers: [{ loginId: 'teacher03', password: 'replace-me', nickname: 'teacher03' }],
    students: [{
      loginId: 'student01', password: 'replace-me', nickname: '학생', homeroomTeacherLoginId: 'teacher03',
    }],
    subjects: [
      { name: '수학', teacherLoginId: 'teacher03', units: ['다항식'] },
      { name: '국어', teacherLoginId: 'teacher03', units: ['독서'] },
      { name: '영어', teacherLoginId: 'teacher03', units: ['독해', '문법'] },
    ],
  };
}

test('시드는 수학·국어·영어와 과목별 고유 단원 배열을 요구한다', () => {
  assert.doesNotThrow(() => validateSeed(validSeed()));

  const missingUnits = validSeed();
  missingUnits.subjects[2].units = [];
  assert.throws(() => validateSeed(missingUnits), /units는 비어 있지 않은 배열/);

  const duplicateUnits = validSeed();
  duplicateUnits.subjects[2].units = ['문법', '문법'];
  assert.throws(() => validateSeed(duplicateUnits), /비어 있거나 중복/);

  const missingSubject = validSeed();
  missingSubject.subjects.pop();
  assert.throws(() => validateSeed(missingSubject), /수학, 국어, 영어/);
});
