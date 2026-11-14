import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { schema } from './schema.js';

mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
export const db = new Database(config.sqlitePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function migrateLegacyQuestionImprovement(database = db) {
  const questionsTable = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'questions'").get();
  if (!questionsTable?.sql?.includes('NEEDS_DETAILS')) return;

  database.pragma('foreign_keys = OFF');
  try {
    database.transaction(() => {
      database.exec(`CREATE TABLE questions_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES users(id),
        original_content TEXT NOT NULL,
        final_content TEXT,
        status TEXT NOT NULL CHECK (status IN ('PROCESSING','GENERATING_IMPROVEMENT_STAGE_1','AWAITING_IMPROVEMENT_STAGE_1','GENERATING_IMPROVEMENT_STAGE_2','AWAITING_IMPROVEMENT_STAGE_2','GENERATING_IMPROVEMENT_STAGE_3','GENERATING_FINAL_QUESTION_SUGGESTION','AWAITING_FINAL_QUESTION','NEEDS_SUBJECT_SELECTION','ASSIGNED','ANSWERED','NOTICE_ANSWERED','PROCESSING_FAILED')),
        route_type TEXT CHECK (route_type IN ('SUBJECT','HOMEROOM')),
        subject_id INTEGER REFERENCES subjects(id),
        assigned_teacher_id INTEGER REFERENCES users(id),
        teacher_read_at TEXT,
        failed_stage TEXT,
        retry_status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      database.exec(`INSERT INTO questions_v2 (
          id, student_id, original_content, final_content, status, route_type, subject_id,
          assigned_teacher_id, teacher_read_at, failed_stage, retry_status, created_at, updated_at
        )
        SELECT id, student_id, original_content, final_content,
          CASE WHEN status IN ('NEEDS_DETAILS','REWRITING','AWAITING_CONFIRMATION') THEN 'PROCESSING_FAILED' ELSE status END,
          route_type, subject_id, assigned_teacher_id, teacher_read_at,
          CASE
            WHEN status IN ('NEEDS_DETAILS','REWRITING','AWAITING_CONFIRMATION') OR failed_stage = 'QUESTION_REWRITE'
              THEN 'IMPROVEMENT_STAGE_1_GENERATION'
            ELSE failed_stage
          END,
          CASE
            WHEN status IN ('NEEDS_DETAILS','REWRITING','AWAITING_CONFIRMATION') OR failed_stage = 'QUESTION_REWRITE'
              THEN 'GENERATING_IMPROVEMENT_STAGE_1'
            ELSE retry_status
          END,
          created_at, updated_at
        FROM questions`);
      database.exec('DROP TABLE questions');
      database.exec('ALTER TABLE questions_v2 RENAME TO questions');
      const details = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'question_details'").get();
      const legacyDetails = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'legacy_question_details'").get();
      if (details && !legacyDetails) database.exec('ALTER TABLE question_details RENAME TO legacy_question_details');
    })();
  } finally {
    database.pragma('foreign_keys = ON');
  }
  const foreignKeyError = database.prepare('PRAGMA foreign_key_check').get();
  if (foreignKeyError) throw new Error(`질문 개선 스키마 마이그레이션 후 외래 키가 유효하지 않습니다: ${foreignKeyError.table}`);
}

migrateLegacyQuestionImprovement();

export function migrateFinalSuggestionStatus(database = db) {
  const questionsTable = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'questions'").get();
  if (!questionsTable?.sql || questionsTable.sql.includes('GENERATING_FINAL_QUESTION_SUGGESTION')) return;

  database.pragma('foreign_keys = OFF');
  try {
    database.transaction(() => {
      database.exec(`CREATE TABLE questions_v3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES users(id),
        original_content TEXT NOT NULL,
        final_content TEXT,
        status TEXT NOT NULL CHECK (status IN ('PROCESSING','GENERATING_IMPROVEMENT_STAGE_1','AWAITING_IMPROVEMENT_STAGE_1','GENERATING_IMPROVEMENT_STAGE_2','AWAITING_IMPROVEMENT_STAGE_2','GENERATING_IMPROVEMENT_STAGE_3','GENERATING_FINAL_QUESTION_SUGGESTION','AWAITING_FINAL_QUESTION','NEEDS_SUBJECT_SELECTION','ASSIGNED','ANSWERED','NOTICE_ANSWERED','PROCESSING_FAILED')),
        route_type TEXT CHECK (route_type IN ('SUBJECT','HOMEROOM')),
        subject_id INTEGER REFERENCES subjects(id),
        assigned_teacher_id INTEGER REFERENCES users(id),
        teacher_read_at TEXT,
        failed_stage TEXT,
        retry_status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      database.exec(`INSERT INTO questions_v3
        SELECT id, student_id, original_content, final_content, status, route_type, subject_id,
          assigned_teacher_id, teacher_read_at, failed_stage, retry_status, created_at, updated_at
        FROM questions`);
      database.exec('DROP TABLE questions');
      database.exec('ALTER TABLE questions_v3 RENAME TO questions');
    })();
  } finally {
    database.pragma('foreign_keys = ON');
  }
  const foreignKeyError = database.prepare('PRAGMA foreign_key_check').get();
  if (foreignKeyError) throw new Error(`최종 질문 추천 상태 마이그레이션 후 외래 키가 유효하지 않습니다: ${foreignKeyError.table}`);
}

migrateFinalSuggestionStatus();
db.exec(schema);

export function migrateQuestionUnitColumn(database = db) {
  const columns = database.prepare('PRAGMA table_info(questions)').all();
  if (!columns.some(({ name }) => name === 'unit_id')) {
    database.exec('ALTER TABLE questions ADD COLUMN unit_id INTEGER REFERENCES subject_units(id)');
  }
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_questions_unit ON questions(unit_id, created_at DESC);
    CREATE TRIGGER IF NOT EXISTS validate_question_unit_insert
    BEFORE INSERT ON questions
    WHEN NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM subject_units su WHERE su.id = NEW.unit_id AND su.subject_id = NEW.subject_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'question unit must belong to subject');
    END;
    CREATE TRIGGER IF NOT EXISTS validate_question_unit_update
    BEFORE UPDATE OF subject_id, unit_id ON questions
    WHEN NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM subject_units su WHERE su.id = NEW.unit_id AND su.subject_id = NEW.subject_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'question unit must belong to subject');
    END;
    CREATE TRIGGER IF NOT EXISTS prevent_question_unit_change
    BEFORE UPDATE OF unit_id ON questions
    WHEN OLD.unit_id IS NOT NULL AND NEW.unit_id IS NOT OLD.unit_id
    BEGIN
      SELECT RAISE(ABORT, 'question unit is immutable');
    END;
  `);
}

migrateQuestionUnitColumn();

export function migrateFinalSuggestionColumn(database = db) {
  const columns = database.prepare('PRAGMA table_info(question_improvements)').all();
  if (!columns.some(({ name }) => name === 'final_suggestion')) {
    database.exec('ALTER TABLE question_improvements ADD COLUMN final_suggestion TEXT');
  }
}

migrateFinalSuggestionColumn();

function migrateUserNickname() {
  const columns = db.prepare('PRAGMA table_info(users)').all();
  if (columns.some(({ name }) => name === 'nickname')) return;

  db.exec("ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT ''");
  db.exec("UPDATE users SET nickname = login_id WHERE nickname = ''");
}

migrateUserNickname();

function readSeed() {
  try {
    return JSON.parse(readFileSync(config.seedPath, 'utf8'));
  } catch (error) {
    throw new Error(`시드 파일을 읽을 수 없습니다: ${config.seedPath} (${error.message})`);
  }
}

function accountNickname(account) {
  const nickname = typeof account.nickname === 'string' ? account.nickname.trim() : '';
  const loginId = typeof account.loginId === 'string' ? account.loginId.trim() : '';
  return nickname || loginId;
}

export function validateSeed(seed) {
  if (!seed || !Array.isArray(seed.teachers) || !seed.teachers.length || !Array.isArray(seed.students) || !seed.students.length || !Array.isArray(seed.subjects) || !seed.subjects.length) {
    throw new Error('시드에는 teachers, students, subjects의 비어 있지 않은 배열이 필요합니다.');
  }
  const loginIds = new Set();
  for (const account of [...seed.teachers, ...seed.students]) {
    const loginId = typeof account.loginId === 'string' ? account.loginId.trim() : '';
    const password = typeof account.password === 'string' ? account.password.trim() : '';
    const nickname = accountNickname(account);
    if (!loginId || !password || loginIds.has(loginId)) throw new Error('시드 계정의 loginId/password가 없거나 loginId가 중복됩니다.');
    if (!nickname || nickname.length > 100) throw new Error(`시드 계정 ${loginId}의 nickname은 1자 이상 100자 이하여야 합니다.`);
    loginIds.add(loginId);
  }
  const teacherIds = new Set(seed.teachers.map((teacher) => teacher.loginId.trim()));
  for (const student of seed.students) {
    const homeroomTeacherLoginId = typeof student.homeroomTeacherLoginId === 'string' ? student.homeroomTeacherLoginId.trim() : '';
    if (!teacherIds.has(homeroomTeacherLoginId)) throw new Error(`학생 ${student.loginId}의 담임교사가 유효하지 않습니다.`);
  }
  const subjectNames = new Set();
  for (const subject of seed.subjects) {
    const name = typeof subject.name === 'string' ? subject.name.trim() : '';
    const teacherLoginId = typeof subject.teacherLoginId === 'string' ? subject.teacherLoginId.trim() : '';
    if (!name || subjectNames.has(name) || !teacherIds.has(teacherLoginId)) throw new Error(`과목 ${name || '(이름 없음)'}의 이름 또는 담당 교사가 유효하지 않습니다.`);
    if (!Array.isArray(subject.units) || !subject.units.length) throw new Error(`과목 ${name}의 units는 비어 있지 않은 배열이어야 합니다.`);
    const unitNames = new Set();
    for (const unit of subject.units) {
      const unitName = typeof unit === 'string' ? unit.trim() : '';
      if (!unitName || unitNames.has(unitName)) throw new Error(`과목 ${name}의 단원 이름이 비어 있거나 중복됩니다.`);
      unitNames.add(unitName);
    }
    subjectNames.add(name);
  }
  const requiredSubjects = ['수학', '국어', '영어'];
  if (subjectNames.size !== requiredSubjects.length || requiredSubjects.some((name) => !subjectNames.has(name))) {
    throw new Error('과목은 수학, 국어, 영어로 정확히 구성해야 합니다.');
  }
}

export function seedDatabase() {
  const seed = readSeed();
  validateSeed(seed);

  if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0) {
    const run = db.transaction(() => {
      const now = new Date().toISOString();
      const insertUser = db.prepare('INSERT INTO users (login_id, password, nickname, role, homeroom_teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      const ids = new Map();
      for (const teacher of seed.teachers) ids.set(teacher.loginId.trim(), Number(insertUser.run(teacher.loginId.trim(), teacher.password, accountNickname(teacher), 'TEACHER', null, now).lastInsertRowid));
      for (const student of seed.students) insertUser.run(student.loginId.trim(), student.password, accountNickname(student), 'STUDENT', ids.get(student.homeroomTeacherLoginId.trim()), now);
      const insertSubject = db.prepare('INSERT INTO subjects (name, teacher_id) VALUES (?, ?)');
      const insertUnit = db.prepare('INSERT INTO subject_units (subject_id, name) VALUES (?, ?)');
      for (const subject of seed.subjects) {
        const subjectId = Number(insertSubject.run(subject.name.trim(), ids.get(subject.teacherLoginId.trim())).lastInsertRowid);
        for (const unit of subject.units) insertUnit.run(subjectId, unit.trim());
      }
    });
    run();
  } else {
    const allowedSubjects = new Set(seed.subjects.map(({ name }) => name.trim()));
    const extraSubject = db.prepare('SELECT name FROM subjects').all().find(({ name }) => !allowedSubjects.has(name));
    if (extraSubject) throw new Error(`DB 과목 ${extraSubject.name}이 시드에 없습니다.`);
    db.transaction(() => {
      const now = new Date().toISOString();
      const insertTeacher = db.prepare(`INSERT INTO users
        (login_id, password, nickname, role, homeroom_teacher_id, created_at)
        VALUES (?, ?, ?, 'TEACHER', NULL, ?)`);
      for (const teacher of seed.teachers) {
        const loginId = teacher.loginId.trim();
        const existing = db.prepare('SELECT role FROM users WHERE login_id = ?').get(loginId);
        if (!existing) insertTeacher.run(loginId, teacher.password, accountNickname(teacher), now);
        else if (existing.role !== 'TEACHER') throw new Error(`시드 교사 ${loginId}가 TEACHER 계정이 아닙니다.`);
      }

      const insertSubject = db.prepare('INSERT INTO subjects (name, teacher_id) VALUES (?, ?)');
      const insertUnit = db.prepare('INSERT INTO subject_units (subject_id, name) VALUES (?, ?)');
      for (const subjectSeed of seed.subjects) {
        const name = subjectSeed.name.trim();
        const teacherLoginId = subjectSeed.teacherLoginId.trim();
        const teacher = db.prepare("SELECT id FROM users WHERE login_id = ? AND role = 'TEACHER'").get(teacherLoginId);
        let subject = db.prepare(`SELECT s.id, t.login_id AS teacherLoginId
          FROM subjects s JOIN users t ON t.id = s.teacher_id WHERE s.name = ?`).get(name);
        if (!subject) {
          const subjectId = Number(insertSubject.run(name, teacher.id).lastInsertRowid);
          subject = { id: subjectId, teacherLoginId };
        }
        if (subject.teacherLoginId !== teacherLoginId) throw new Error(`과목 ${name}의 담당 교사가 시드와 일치하지 않습니다.`);

        const expectedUnits = subjectSeed.units.map((unit) => unit.trim());
        const actualUnits = db.prepare('SELECT name FROM subject_units WHERE subject_id = ? ORDER BY id').all(subject.id).map(({ name: unitName }) => unitName);
        if (!actualUnits.length) {
          for (const unitName of expectedUnits) insertUnit.run(subject.id, unitName);
        } else {
          const expectedSorted = [...expectedUnits].sort();
          const actualSorted = [...actualUnits].sort();
          if (expectedSorted.length !== actualSorted.length || expectedSorted.some((unitName, index) => unitName !== actualSorted[index])) {
            throw new Error(`과목 ${name}의 단원 목록이 시드와 일치하지 않습니다.`);
          }
        }
      }
    })();
  }

  const counts = db.prepare("SELECT SUM(role = 'STUDENT') AS students, SUM(role = 'TEACHER') AS teachers FROM users").get();
  if (!counts.students || !counts.teachers || db.prepare('SELECT COUNT(*) AS count FROM subjects').get().count === 0) {
    throw new Error('초기 데이터에는 학생, 교사, 과목이 각각 하나 이상 필요합니다.');
  }
  const invalidStudent = db.prepare("SELECT s.login_id FROM users s LEFT JOIN users t ON t.id = s.homeroom_teacher_id WHERE s.role = 'STUDENT' AND (t.id IS NULL OR t.role <> 'TEACHER') LIMIT 1").get();
  if (invalidStudent) throw new Error(`학생 ${invalidStudent.login_id}의 담임교사 연결이 유효하지 않습니다.`);
  const invalidTeacher = db.prepare("SELECT login_id FROM users WHERE role = 'TEACHER' AND homeroom_teacher_id IS NOT NULL LIMIT 1").get();
  if (invalidTeacher) throw new Error(`교사 ${invalidTeacher.login_id}의 homeroom_teacher_id는 NULL이어야 합니다.`);
  const invalidNickname = db.prepare("SELECT login_id FROM users WHERE length(trim(nickname)) = 0 OR length(trim(nickname)) > 100 LIMIT 1").get();
  if (invalidNickname) throw new Error(`계정 ${invalidNickname.login_id}의 nickname은 1자 이상 100자 이하여야 합니다.`);
  const invalidSubject = db.prepare("SELECT s.name FROM subjects s LEFT JOIN users t ON t.id = s.teacher_id WHERE t.id IS NULL OR t.role <> 'TEACHER' LIMIT 1").get();
  if (invalidSubject) throw new Error(`과목 ${invalidSubject.name}의 담당 교사 연결이 유효하지 않습니다.`);
  const actualSubjectNames = db.prepare('SELECT name FROM subjects').all().map(({ name }) => name).sort();
  const expectedSubjectNames = seed.subjects.map(({ name }) => name.trim()).sort();
  if (actualSubjectNames.length !== expectedSubjectNames.length || expectedSubjectNames.some((name, index) => name !== actualSubjectNames[index])) {
    throw new Error('DB 과목 목록이 시드와 일치하지 않습니다.');
  }
  const invalidUnit = db.prepare(`SELECT su.name FROM subject_units su
    LEFT JOIN subjects s ON s.id = su.subject_id WHERE s.id IS NULL LIMIT 1`).get();
  if (invalidUnit) throw new Error(`단원 ${invalidUnit.name}의 과목 연결이 유효하지 않습니다.`);
}
