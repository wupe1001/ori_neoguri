import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { schema } from './schema.js';

mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
export const db = new Database(config.sqlitePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.exec(schema);

function validateSeed(seed) {
  if (!seed || !Array.isArray(seed.teachers) || !seed.teachers.length || !Array.isArray(seed.students) || !seed.students.length || !Array.isArray(seed.subjects) || !seed.subjects.length) {
    throw new Error('시드에는 teachers, students, subjects의 비어 있지 않은 배열이 필요합니다.');
  }
  const loginIds = new Set();
  for (const account of [...seed.teachers, ...seed.students]) {
    if (!account.loginId?.trim() || !account.password?.trim() || loginIds.has(account.loginId)) throw new Error('시드 계정의 loginId/password가 없거나 loginId가 중복됩니다.');
    loginIds.add(account.loginId);
  }
  const teacherIds = new Set(seed.teachers.map((teacher) => teacher.loginId));
  for (const student of seed.students) if (!teacherIds.has(student.homeroomTeacherLoginId)) throw new Error(`학생 ${student.loginId}의 담임교사가 유효하지 않습니다.`);
  const subjectNames = new Set();
  for (const subject of seed.subjects) {
    if (!subject.name?.trim() || subjectNames.has(subject.name) || !teacherIds.has(subject.teacherLoginId)) throw new Error(`과목 ${subject.name || '(이름 없음)'}의 이름 또는 담당 교사가 유효하지 않습니다.`);
    subjectNames.add(subject.name);
  }
}

export function seedDatabase() {
  if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0) {
    let seed;
    try {
      seed = JSON.parse(readFileSync(config.seedPath, 'utf8'));
    } catch (error) {
      throw new Error(`시드 파일을 읽을 수 없습니다: ${config.seedPath} (${error.message})`);
    }
    validateSeed(seed);
    const run = db.transaction(() => {
      const now = new Date().toISOString();
      const insertUser = db.prepare('INSERT INTO users (login_id, password, role, homeroom_teacher_id, created_at) VALUES (?, ?, ?, ?, ?)');
      const ids = new Map();
      for (const teacher of seed.teachers) ids.set(teacher.loginId, Number(insertUser.run(teacher.loginId.trim(), teacher.password, 'TEACHER', null, now).lastInsertRowid));
      for (const student of seed.students) insertUser.run(student.loginId.trim(), student.password, 'STUDENT', ids.get(student.homeroomTeacherLoginId), now);
      const insertSubject = db.prepare('INSERT INTO subjects (name, teacher_id) VALUES (?, ?)');
      for (const subject of seed.subjects) insertSubject.run(subject.name.trim(), ids.get(subject.teacherLoginId));
    });
    run();
  }

  const counts = db.prepare("SELECT SUM(role = 'STUDENT') AS students, SUM(role = 'TEACHER') AS teachers FROM users").get();
  if (!counts.students || !counts.teachers || db.prepare('SELECT COUNT(*) AS count FROM subjects').get().count === 0) {
    throw new Error('초기 데이터에는 학생, 교사, 과목이 각각 하나 이상 필요합니다.');
  }
  const invalidStudent = db.prepare("SELECT s.login_id FROM users s LEFT JOIN users t ON t.id = s.homeroom_teacher_id WHERE s.role = 'STUDENT' AND (t.id IS NULL OR t.role <> 'TEACHER') LIMIT 1").get();
  if (invalidStudent) throw new Error(`학생 ${invalidStudent.login_id}의 담임교사 연결이 유효하지 않습니다.`);
  const invalidTeacher = db.prepare("SELECT login_id FROM users WHERE role = 'TEACHER' AND homeroom_teacher_id IS NOT NULL LIMIT 1").get();
  if (invalidTeacher) throw new Error(`교사 ${invalidTeacher.login_id}의 homeroom_teacher_id는 NULL이어야 합니다.`);
  const invalidSubject = db.prepare("SELECT s.name FROM subjects s LEFT JOIN users t ON t.id = s.teacher_id WHERE t.id IS NULL OR t.role <> 'TEACHER' LIMIT 1").get();
  if (invalidSubject) throw new Error(`과목 ${invalidSubject.name}의 담당 교사 연결이 유효하지 않습니다.`);
}
