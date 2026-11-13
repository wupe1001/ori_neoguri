import { db } from '../db/database.js';

export const now = () => new Date().toISOString();

export const store = {
  findUserByCredentials(loginId, password) {
    return db.prepare('SELECT id, role, nickname FROM users WHERE login_id = ? AND password = ?').get(loginId, password);
  },
  getUser(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
  getPublicUser(id) {
    return db.prepare(`SELECT id, login_id AS loginId, nickname, role,
      homeroom_teacher_id AS homeroomTeacherId, created_at AS createdAt
      FROM users WHERE id = ?`).get(id);
  },
  listSubjects() {
    return db.prepare('SELECT id, name, teacher_id AS teacherId FROM subjects ORDER BY id').all();
  },
  getSubject(id) {
    return db.prepare('SELECT id, name, teacher_id AS teacherId FROM subjects WHERE id = ?').get(id);
  },
  listAllNotices() {
    return db.prepare('SELECT id, title, content, author_id AS authorId, created_at AS createdAt FROM notices ORDER BY created_at DESC').all();
  },
  listNotices(limit, offset) {
    return db.prepare('SELECT id, title, content, author_id AS authorId, created_at AS createdAt FROM notices ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  },
  countNotices() { return db.prepare('SELECT COUNT(*) AS count FROM notices').get().count; },
  getNotice(id) {
    return db.prepare('SELECT id, title, content, author_id AS authorId, created_at AS createdAt FROM notices WHERE id = ?').get(id);
  },
  createNotice(title, content, authorId) {
    const createdAt = now();
    const result = db.prepare('INSERT INTO notices (title, content, author_id, created_at) VALUES (?, ?, ?, ?)').run(title, content, authorId, createdAt);
    return { id: Number(result.lastInsertRowid), title, content, authorId, createdAt };
  },
  createQuestion(studentId, content) {
    const time = now();
    const result = db.prepare("INSERT INTO questions (student_id, original_content, final_content, status, created_at, updated_at) VALUES (?, ?, ?, 'PROCESSING', ?, ?)").run(studentId, content, content, time, time);
    return Number(result.lastInsertRowid);
  },
  getQuestion(id) { return db.prepare('SELECT * FROM questions WHERE id = ?').get(id); },
  getOwnedQuestion(id, studentId) { return db.prepare('SELECT * FROM questions WHERE id = ? AND student_id = ?').get(id, studentId); },
  updateQuestion(id, fields, expectedStatus) {
    const entries = Object.entries({ ...fields, updated_at: now() });
    const set = entries.map(([key]) => `${key} = ?`).join(', ');
    const params = entries.map(([, value]) => value);
    const where = expectedStatus ? 'id = ? AND status = ?' : 'id = ?';
    params.push(id, ...(expectedStatus ? [expectedStatus] : []));
    return db.prepare(`UPDATE questions SET ${set} WHERE ${where}`).run(...params).changes;
  },
  assignHomeroom(question) {
    const teacher = db.prepare("SELECT homeroom_teacher_id AS id FROM users WHERE id = ? AND role = 'STUDENT'").get(question.student_id);
    if (!teacher?.id) throw new Error('학생의 담임교사 연결이 없습니다.');
    this.updateQuestion(question.id, { status: 'ASSIGNED', route_type: 'HOMEROOM', subject_id: null, assigned_teacher_id: teacher.id, failed_stage: null, retry_status: null });
  },
  assignSubject(questionId, subject) {
    this.updateQuestion(questionId, { status: 'ASSIGNED', route_type: 'SUBJECT', subject_id: subject.id, assigned_teacher_id: subject.teacherId, failed_stage: null, retry_status: null });
  },
  logDecision(questionId, stage, result) {
    db.prepare('INSERT INTO model_decision_logs (question_id, stage, provider, model, model_version, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(questionId, stage, result.provider, result.model, result.modelVersion || null, JSON.stringify(result), now());
  },
  getLatestDecision(questionId, stage) {
    const row = db.prepare('SELECT result_json AS resultJson FROM model_decision_logs WHERE question_id = ? AND stage = ? ORDER BY id DESC LIMIT 1').get(questionId, stage);
    return row ? JSON.parse(row.resultJson) : null;
  },
  createNoticeAnswer(questionId, content, noticeIds) {
    const run = db.transaction(() => {
      const time = now();
      const result = db.prepare("INSERT INTO answers (question_id, author_type, content, student_read_at, created_at) VALUES (?, 'AI_NOTICE', ?, ?, ?)").run(questionId, content, time, time);
      const answerId = Number(result.lastInsertRowid);
      const source = db.prepare('INSERT INTO answer_notice_sources (answer_id, notice_id) VALUES (?, ?)');
      for (const noticeId of noticeIds) source.run(answerId, noticeId);
      this.updateQuestion(questionId, { status: 'NOTICE_ANSWERED', failed_stage: null, retry_status: null });
      return answerId;
    });
    return run();
  },
  startImprovement(questionId) {
    return db.transaction(() => {
      const changed = this.updateQuestion(questionId, {
        status: 'GENERATING_IMPROVEMENT_STAGE_1', failed_stage: null, retry_status: null,
      }, 'PROCESSING');
      if (!changed) return false;
      db.prepare('INSERT INTO question_improvements (question_id, created_at) VALUES (?, ?)').run(questionId, now());
      return true;
    })();
  },
  ensureImprovement(questionId) {
    db.prepare('INSERT OR IGNORE INTO question_improvements (question_id, created_at) VALUES (?, ?)').run(questionId, now());
  },
  saveImprovementStage1(questionId, result) {
    return db.transaction(() => {
      if (db.prepare('SELECT status FROM questions WHERE id = ?').get(questionId)?.status !== 'GENERATING_IMPROVEMENT_STAGE_1') return false;
      const improvement = db.prepare('SELECT id FROM question_improvements WHERE question_id = ?').get(questionId);
      if (!improvement) return false;
      db.prepare('DELETE FROM question_improvement_suggestions WHERE improvement_id = ? AND stage = 1').run(improvement.id);
      db.prepare('UPDATE question_improvements SET stage1_prompt = ? WHERE id = ?').run(result.prompt, improvement.id);
      const insert = db.prepare(`INSERT INTO question_improvement_suggestions
        (improvement_id, stage, suggestion_text, question_type, bloom_level, display_order)
        VALUES (?, 1, ?, NULL, NULL, ?)`);
      result.exampleAnswers.forEach((answer, index) => insert.run(improvement.id, answer, index));
      return Boolean(this.updateQuestion(questionId, {
        status: 'AWAITING_IMPROVEMENT_STAGE_1', failed_stage: null, retry_status: null,
      }, 'GENERATING_IMPROVEMENT_STAGE_1'));
    })();
  },
  submitImprovementStage1(questionId, answer) {
    return db.transaction(() => {
      const saved = db.prepare(`UPDATE question_improvements SET stage1_student_answer = ?
        WHERE question_id = ? AND stage1_student_answer IS NULL
          AND EXISTS (SELECT 1 FROM questions WHERE id = ? AND status = 'AWAITING_IMPROVEMENT_STAGE_1')`)
        .run(answer, questionId, questionId).changes;
      if (!saved) return false;
      return Boolean(this.updateQuestion(questionId, { status: 'GENERATING_IMPROVEMENT_STAGE_2' }, 'AWAITING_IMPROVEMENT_STAGE_1'));
    })();
  },
  saveImprovementStage2(questionId, result) {
    return db.transaction(() => {
      if (db.prepare('SELECT status FROM questions WHERE id = ?').get(questionId)?.status !== 'GENERATING_IMPROVEMENT_STAGE_2') return false;
      const saved = db.prepare('UPDATE question_improvements SET stage2_prompt = ? WHERE question_id = ?').run(result.prompt, questionId).changes;
      if (!saved) return false;
      return Boolean(this.updateQuestion(questionId, {
        status: 'AWAITING_IMPROVEMENT_STAGE_2', failed_stage: null, retry_status: null,
      }, 'GENERATING_IMPROVEMENT_STAGE_2'));
    })();
  },
  submitImprovementStage2(questionId, answer) {
    return db.transaction(() => {
      const saved = db.prepare(`UPDATE question_improvements SET stage2_student_answer = ?
        WHERE question_id = ? AND stage2_student_answer IS NULL
          AND EXISTS (SELECT 1 FROM questions WHERE id = ? AND status = 'AWAITING_IMPROVEMENT_STAGE_2')`)
        .run(answer, questionId, questionId).changes;
      if (!saved) return false;
      return Boolean(this.updateQuestion(questionId, { status: 'GENERATING_IMPROVEMENT_STAGE_3' }, 'AWAITING_IMPROVEMENT_STAGE_2'));
    })();
  },
  saveImprovementStage3(questionId, result) {
    return db.transaction(() => {
      if (db.prepare('SELECT status FROM questions WHERE id = ?').get(questionId)?.status !== 'GENERATING_IMPROVEMENT_STAGE_3') return null;
      const improvement = db.prepare('SELECT id FROM question_improvements WHERE question_id = ?').get(questionId);
      if (!improvement) return null;
      db.prepare('DELETE FROM question_improvement_suggestions WHERE improvement_id = ? AND stage = 3').run(improvement.id);
      db.prepare('UPDATE question_improvements SET stage3_prompt = ? WHERE id = ?').run(result.prompt, improvement.id);
      const insert = db.prepare(`INSERT INTO question_improvement_suggestions
        (improvement_id, stage, suggestion_text, question_type, bloom_level, display_order)
        VALUES (?, 3, ?, ?, ?, ?)`);
      const candidates = result.candidates.map((candidate, index) => {
        const id = Number(insert.run(improvement.id, candidate.question, candidate.type, candidate.bloomLevel, index).lastInsertRowid);
        return { id: `candidate_${id}`, ...candidate };
      });
      const changed = this.updateQuestion(questionId, {
        status: 'AWAITING_FINAL_QUESTION', failed_stage: null, retry_status: null,
      }, 'GENERATING_IMPROVEMENT_STAGE_3');
      return changed ? candidates : null;
    })();
  },
  finalizeImprovement(questionId, content) {
    return db.transaction(() => {
      const time = now();
      const saved = db.prepare(`UPDATE question_improvements SET final_question = ?, completed_at = ?
        WHERE question_id = ? AND completed_at IS NULL
          AND EXISTS (SELECT 1 FROM questions WHERE id = ? AND status = 'AWAITING_FINAL_QUESTION')`)
        .run(content, time, questionId, questionId).changes;
      if (!saved) return false;
      return Boolean(this.updateQuestion(questionId, {
        status: 'PROCESSING', final_content: content, route_type: null, subject_id: null,
        assigned_teacher_id: null, teacher_read_at: null, failed_stage: null, retry_status: null,
      }, 'AWAITING_FINAL_QUESTION'));
    })();
  },
  selectSubject(questionId, subject) {
    return this.updateQuestion(questionId, {
      status: 'ASSIGNED', route_type: 'SUBJECT', subject_id: subject.id,
      assigned_teacher_id: subject.teacherId, failed_stage: null, retry_status: null,
    }, 'NEEDS_SUBJECT_SELECTION');
  },
  getImprovementRecord(questionId) {
    return db.prepare(`SELECT id, question_id AS questionId, stage1_prompt AS stage1Prompt,
      stage1_student_answer AS stage1StudentAnswer, stage2_prompt AS stage2Prompt,
      stage2_student_answer AS stage2StudentAnswer, stage3_prompt AS stage3Prompt,
      final_question AS finalQuestion, created_at AS createdAt, completed_at AS completedAt
      FROM question_improvements WHERE question_id = ?`).get(questionId) || null;
  },
  getImprovement(questionId) {
    const record = this.getImprovementRecord(questionId);
    if (!record) return null;
    const suggestions = db.prepare(`SELECT id, stage, suggestion_text AS suggestionText,
      question_type AS questionType, bloom_level AS bloomLevel
      FROM question_improvement_suggestions WHERE improvement_id = ? ORDER BY stage, display_order`).all(record.id);
    return {
      stage1: {
        prompt: record.stage1Prompt,
        exampleAnswers: suggestions.filter(({ stage }) => stage === 1).map(({ suggestionText }) => suggestionText),
        studentAnswer: record.stage1StudentAnswer,
      },
      stage2: { prompt: record.stage2Prompt, studentAnswer: record.stage2StudentAnswer },
      stage3: {
        prompt: record.stage3Prompt,
        candidates: suggestions.filter(({ stage }) => stage === 3).map((candidate) => ({
          id: `candidate_${candidate.id}`,
          question: candidate.suggestionText,
          type: candidate.questionType,
          bloomLevel: candidate.bloomLevel,
        })),
      },
      stage4: { finalQuestion: record.finalQuestion },
    };
  },
  listStudentQuestions(studentId, limit, offset) {
    return db.prepare(`SELECT q.id, COALESCE(q.final_content, q.original_content) AS content, q.status, q.route_type AS routeType,
      CASE WHEN q.subject_id IS NULL THEN NULL ELSE json_object('id', s.id, 'name', s.name) END AS subjectJson,
      q.created_at AS createdAt, EXISTS(SELECT 1 FROM answers a WHERE a.question_id = q.id) AS hasAnswer
      FROM questions q LEFT JOIN subjects s ON s.id = q.subject_id WHERE q.student_id = ? ORDER BY q.created_at DESC LIMIT ? OFFSET ?`).all(studentId, limit, offset);
  },
  countStudentQuestions(studentId) { return db.prepare('SELECT COUNT(*) AS count FROM questions WHERE student_id = ?').get(studentId).count; },
  getStudentQuestionDetail(questionId, studentId) {
    const row = db.prepare(`SELECT q.*, s.name AS subject_name, a.id AS answer_id, a.author_type, a.teacher_id AS answer_teacher_id,
      a.content AS answer_content, a.student_read_at, a.created_at AS answer_created_at
      FROM questions q LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN answers a ON a.question_id = q.id
      WHERE q.id = ? AND q.student_id = ?`).get(questionId, studentId);
    if (!row) return null;
    const sources = row.answer_id ? db.prepare(`SELECT n.id, n.title FROM answer_notice_sources ans JOIN notices n ON n.id = ans.notice_id WHERE ans.answer_id = ? ORDER BY n.id`).all(row.answer_id) : [];
    return { row, sources };
  },
  markStudentRead(answerId) { db.prepare('UPDATE answers SET student_read_at = ? WHERE id = ? AND student_read_at IS NULL').run(now(), answerId); },
  studentUnreadCount(studentId) {
    return db.prepare("SELECT COUNT(*) AS count FROM answers a JOIN questions q ON q.id = a.question_id WHERE q.student_id = ? AND a.author_type = 'TEACHER' AND a.student_read_at IS NULL").get(studentId).count;
  },
  teacherUnreadCount(teacherId) { return db.prepare('SELECT COUNT(*) AS count FROM questions WHERE assigned_teacher_id = ? AND teacher_read_at IS NULL').get(teacherId).count; },
  listTeacherQuestions(teacherId, filters, limit, offset) {
    const where = ['q.assigned_teacher_id = ?'];
    const params = [teacherId];
    if (filters.status) { where.push('q.status = ?'); params.push(filters.status); }
    if (filters.routeType) { where.push('q.route_type = ?'); params.push(filters.routeType); }
    if (filters.unread !== undefined) where.push(filters.unread ? 'q.teacher_read_at IS NULL' : 'q.teacher_read_at IS NOT NULL');
    const base = `FROM questions q JOIN users u ON u.id = q.student_id LEFT JOIN subjects s ON s.id = q.subject_id WHERE ${where.join(' AND ')}`;
    const items = db.prepare(`SELECT q.id, q.final_content AS content, q.status, q.route_type AS routeType, q.teacher_read_at AS teacherReadAt, q.created_at AS createdAt,
      q.student_id AS studentId, s.id AS subjectId, s.name AS subjectName ${base} ORDER BY q.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = db.prepare(`SELECT COUNT(*) AS count ${base}`).get(...params).count;
    return { items, total };
  },
  getTeacherQuestion(questionId, teacherId) {
    return db.prepare(`SELECT q.*, s.name AS subject_name FROM questions q LEFT JOIN subjects s ON s.id = q.subject_id WHERE q.id = ? AND q.assigned_teacher_id = ?`).get(questionId, teacherId);
  },
  markTeacherRead(questionId) { db.prepare('UPDATE questions SET teacher_read_at = ? WHERE id = ? AND teacher_read_at IS NULL').run(now(), questionId); },
  createTeacherAnswer(questionId, teacherId, content) {
    return db.transaction(() => {
      const question = db.prepare('SELECT status FROM questions WHERE id = ? AND assigned_teacher_id = ?').get(questionId, teacherId);
      if (!question) return { kind: 'NOT_FOUND' };
      if (question.status !== 'ASSIGNED') return { kind: 'INVALID_STATE', status: question.status };
      const time = now();
      let result;
      try {
        result = db.prepare("INSERT INTO answers (question_id, author_type, teacher_id, content, created_at) VALUES (?, 'TEACHER', ?, ?, ?)").run(questionId, teacherId, content, time);
      } catch (error) {
        if (error.code?.startsWith('SQLITE_CONSTRAINT')) return { kind: 'DUPLICATE' };
        throw error;
      }
      const changed = this.updateQuestion(questionId, { status: 'ANSWERED' }, 'ASSIGNED');
      if (!changed) throw new Error('답변 저장 중 질문 상태가 변경되었습니다.');
      return { kind: 'CREATED', id: Number(result.lastInsertRowid), content, createdAt: time };
    })();
  },
};
