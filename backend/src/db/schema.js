export const schema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER')),
  homeroom_teacher_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  original_content TEXT NOT NULL,
  final_content TEXT,
  status TEXT NOT NULL CHECK (status IN ('PROCESSING','GENERATING_IMPROVEMENT_STAGE_1','AWAITING_IMPROVEMENT_STAGE_1','GENERATING_IMPROVEMENT_STAGE_2','AWAITING_IMPROVEMENT_STAGE_2','GENERATING_IMPROVEMENT_STAGE_3','AWAITING_FINAL_QUESTION','NEEDS_SUBJECT_SELECTION','ASSIGNED','ANSWERED','NOTICE_ANSWERED','PROCESSING_FAILED')),
  route_type TEXT CHECK (route_type IN ('SUBJECT','HOMEROOM')),
  subject_id INTEGER REFERENCES subjects(id),
  assigned_teacher_id INTEGER REFERENCES users(id),
  teacher_read_at TEXT,
  failed_stage TEXT,
  retry_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_improvements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL UNIQUE REFERENCES questions(id),
  stage1_prompt TEXT,
  stage1_student_answer TEXT,
  stage2_prompt TEXT,
  stage2_student_answer TEXT,
  stage3_prompt TEXT,
  final_question TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS question_improvement_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  improvement_id INTEGER NOT NULL REFERENCES question_improvements(id),
  stage INTEGER NOT NULL CHECK (stage IN (1, 3)),
  suggestion_text TEXT NOT NULL,
  question_type TEXT,
  bloom_level TEXT,
  display_order INTEGER NOT NULL,
  CHECK (
    (stage = 1 AND question_type IS NULL AND bloom_level IS NULL)
    OR
    (stage = 3 AND question_type IS NOT NULL AND bloom_level IS NOT NULL)
  ),
  UNIQUE (improvement_id, stage, display_order)
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL UNIQUE REFERENCES questions(id),
  author_type TEXT NOT NULL CHECK (author_type IN ('TEACHER','AI_NOTICE')),
  teacher_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  student_read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answer_notice_sources (
  answer_id INTEGER NOT NULL REFERENCES answers(id),
  notice_id INTEGER NOT NULL REFERENCES notices(id),
  PRIMARY KEY (answer_id, notice_id)
);

CREATE TABLE IF NOT EXISTS model_decision_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  stage TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  model_version TEXT,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_student ON questions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_teacher ON questions(assigned_teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_unread ON answers(student_read_at, author_type);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions ON question_improvement_suggestions(improvement_id, stage, display_order);
`;
