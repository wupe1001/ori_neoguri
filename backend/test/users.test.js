import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const testDirectory = mkdtempSync(path.join(tmpdir(), 'ori-neoguri-users-'));

process.env.SESSION_SECRET ||= 'test-secret';
process.env.BAZE_API_KEY ||= 'test-api-key';
process.env.GENERATION_MODEL ||= 'test-model';
process.env.MODEL_TIMEOUT_MS ||= '1000';
process.env.CRISIS_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.NOTICE_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SUFFICIENCY_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SUBJECT_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SQLITE_PATH = path.join(testDirectory, 'test.sqlite');

const legacyDb = new Database(process.env.SQLITE_PATH);
legacyDb.exec(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER')),
  homeroom_teacher_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
)`);
legacyDb.prepare("INSERT INTO users (login_id, password, role, created_at) VALUES ('legacy', 'secret', 'TEACHER', ?)")
  .run(new Date().toISOString());
legacyDb.close();

const { db } = await import('../src/db/database.js');
const { store } = await import('../src/repositories/store.js');

after(() => {
  db.close();
  rmSync(testDirectory, { recursive: true, force: true });
});

test('기존 users 테이블에는 nickname 컬럼을 추가하고 login_id를 초기값으로 이관한다', () => {
  const columns = db.prepare('PRAGMA table_info(users)').all();
  assert.equal(columns.find(({ name }) => name === 'nickname')?.notnull, 1);
  assert.equal(store.getPublicUser(1).nickname, 'legacy');
});

test('ID로 조회한 사용자 정보에는 닉네임이 있고 비밀번호가 없다', () => {
  const createdAt = new Date().toISOString();
  const id = Number(db.prepare(
    "INSERT INTO users (login_id, password, nickname, role, created_at) VALUES ('teacher', 'secret', '김선생', 'TEACHER', ?)",
  ).run(createdAt).lastInsertRowid);

  assert.deepEqual(store.getPublicUser(id), {
    id,
    loginId: 'teacher',
    nickname: '김선생',
    role: 'TEACHER',
    homeroomTeacherId: null,
    createdAt,
  });
  assert.equal(store.getPublicUser(999999), undefined);
});
