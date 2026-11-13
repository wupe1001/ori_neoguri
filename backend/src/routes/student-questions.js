import { Router } from 'express';
import { AppError, conflict, notFound } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { store } from '../repositories/store.js';
import { questionPipeline } from '../services/question-pipeline.js';
import { nonEmptyString, pageBody, pagination, positiveId } from './helpers.js';

export const studentQuestionsRouter = Router();
studentQuestionsRouter.use(requireRole('STUDENT'));

function ownedQuestion(questionId, studentId) {
  const question = store.getOwnedQuestion(questionId, studentId);
  if (!question) throw notFound('질문을 찾을 수 없습니다.');
  return question;
}

studentQuestionsRouter.get('/unread-count', (req, res) => {
  /* #swagger.tags = ['Student Questions']
     #swagger.summary = '읽지 않은 답변 수 조회'
     #swagger.description = '현재 학생이 아직 확인하지 않은 교사 답변 수를 조회합니다. 공지사항 기반 AI 답변은 제외됩니다.'
     #swagger.responses[200] = { description: '읽지 않은 교사 답변 수를 반환합니다.' }
  */
  res.json({ count: store.studentUnreadCount(req.session.userId) });
});

studentQuestionsRouter.post('/', async (req, res) => {
  /* #swagger.tags = ['Student Questions']
     #swagger.summary = '질문 제출'
     #swagger.description = '학생 질문을 저장한 뒤 위기 감지, 공지 답변, 충분성 판단과 과목 분류 파이프라인을 동기적으로 실행합니다.'
     #swagger.responses[201] = { description: '질문 처리 결과와 현재 상태를 반환합니다.' }
     #swagger.responses[422] = { description: '질문이 모델 입력 한도를 초과했습니다.' }
     #swagger.responses[503] = { description: '외부 모델 처리에 실패했습니다.' }
  */
  /* #swagger.parameters['body'] = {
       in: 'body',
       required: true,
       schema: { $ref: '#/definitions/QuestionRequest' }
  } */
  const content = nonEmptyString(req.body?.content, 'content', 32000);
  if (content.length > 30000) throw new AppError(422, 'MODEL_INPUT_TOO_LARGE', '질문이 모델 입력 한도를 초과할 수 있습니다.', { maxCharacters: 30000 });
  const questionId = store.createQuestion(req.session.userId, content);
  const result = await questionPipeline.run(questionId);
  res.status(201).json(result);
});

studentQuestionsRouter.get('/', (req, res) => {
  /* #swagger.tags = ['Student Questions']
     #swagger.summary = '내 질문 목록 조회'
     #swagger.description = '현재 학생이 제출한 질문을 최신순으로 페이지 조회합니다. 목록 조회는 답변을 읽음 처리하지 않습니다.'
     #swagger.responses[200] = { description: '내 질문 목록과 페이지 정보를 반환합니다.' }
  */
  /* #swagger.parameters['page'] = { in: 'query', type: 'integer', minimum: 1, default: 1 }
     #swagger.parameters['limit'] = { in: 'query', type: 'integer', minimum: 1, maximum: 100, default: 20 }
  */
  const { page, limit, offset } = pagination(req.query);
  const items = store.listStudentQuestions(req.session.userId, limit, offset).map((item) => ({
    id: item.id,
    content: item.content,
    status: item.status,
    routeType: item.routeType,
    subject: item.subjectJson ? JSON.parse(item.subjectJson) : null,
    createdAt: item.createdAt,
    hasAnswer: Boolean(item.hasAnswer),
  }));
  res.json(pageBody(items, store.countStudentQuestions(req.session.userId), page, limit));
});

studentQuestionsRouter.post('/:questionId/details', async (req, res) => {
  /* #swagger.tags = ['Student Questions']
     #swagger.summary = '질문 보완 정보 제출'
     #swagger.description = 'NEEDS_DETAILS 상태인 본인 질문에 육하원칙 여섯 항목을 제출하고, AI가 재작성한 질문을 생성합니다.'
     #swagger.responses[200] = { description: 'AI가 재작성한 질문을 반환합니다.' }
     #swagger.responses[409] = { description: '질문이 보완 정보를 받을 수 있는 상태가 아닙니다.' }
     #swagger.responses[503] = { description: '외부 모델 처리에 실패했습니다.' }
  */
  /* #swagger.parameters['questionId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  /* #swagger.parameters['body'] = {
       in: 'body',
       required: true,
       schema: { $ref: '#/definitions/QuestionDetailsRequest' }
  } */
  const questionId = positiveId(req.params.questionId, 'questionId');
  const question = ownedQuestion(questionId, req.session.userId);
  if (question.status !== 'NEEDS_DETAILS') throw conflict('QUESTION_INVALID_STATE', '현재 질문 상태에서는 육하원칙을 제출할 수 없습니다.', { currentStatus: question.status });
  const details = Object.fromEntries(['who', 'when', 'where', 'what', 'how', 'why'].map((key) => [key, nonEmptyString(req.body?.[key], key, 2000)]));
  if (!store.submitDetails(questionId, details)) throw conflict('QUESTION_INVALID_STATE', '질문 상태가 이미 변경되었습니다.');
  res.json(await questionPipeline.rewrite(questionId));
});

studentQuestionsRouter.post('/:questionId/confirmation', async (req, res) => {
  /* #swagger.tags = ['Student Questions']
     #swagger.summary = '재작성 질문 확정'
     #swagger.description = 'AWAITING_CONFIRMATION 상태인 본인 질문의 최종 문장을 확정하고 전체 처리 파이프라인을 다시 실행합니다.'
     #swagger.responses[200] = { description: '확정된 질문의 처리 결과를 반환합니다.' }
     #swagger.responses[409] = { description: '질문을 확정할 수 있는 상태가 아닙니다.' }
     #swagger.responses[503] = { description: '외부 모델 처리에 실패했습니다.' }
  */
  /* #swagger.parameters['questionId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  /* #swagger.parameters['body'] = {
       in: 'body',
       required: true,
       schema: { $ref: '#/definitions/QuestionConfirmationRequest' }
  } */
  const questionId = positiveId(req.params.questionId, 'questionId');
  const question = ownedQuestion(questionId, req.session.userId);
  if (question.status !== 'AWAITING_CONFIRMATION') throw conflict('QUESTION_INVALID_STATE', '현재 질문 상태에서는 재작성 질문을 확정할 수 없습니다.', { currentStatus: question.status });
  const content = nonEmptyString(req.body?.content, 'content', 2000);
  if (!store.confirmQuestion(questionId, content)) throw conflict('QUESTION_INVALID_STATE', '질문 상태가 이미 변경되었습니다.');
  res.json(await questionPipeline.run(questionId));
});

studentQuestionsRouter.post('/:questionId/subject', (req, res) => {
  /* #swagger.tags = ['Student Questions']
     #swagger.summary = '질문 과목 직접 선택'
     #swagger.description = 'NEEDS_SUBJECT_SELECTION 상태인 본인 질문의 과목을 선택하여 해당 과목 담당 교사에게 배정합니다.'
     #swagger.responses[200] = { description: '과목과 담당 교사 배정 결과를 반환합니다.' }
     #swagger.responses[409] = { description: '과목을 선택할 수 있는 질문 상태가 아닙니다.' }
  */
  /* #swagger.parameters['questionId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  /* #swagger.parameters['body'] = {
       in: 'body',
       required: true,
       schema: { $ref: '#/definitions/SubjectSelectionRequest' }
  } */
  const questionId = positiveId(req.params.questionId, 'questionId');
  const question = ownedQuestion(questionId, req.session.userId);
  if (question.status !== 'NEEDS_SUBJECT_SELECTION') throw conflict('QUESTION_INVALID_STATE', '현재 질문 상태에서는 과목을 선택할 수 없습니다.', { currentStatus: question.status });
  const subject = store.getSubject(positiveId(req.body?.subjectId, 'subjectId'));
  if (!subject) throw notFound('과목을 찾을 수 없습니다.');
  if (!store.selectSubject(questionId, subject)) throw conflict('QUESTION_INVALID_STATE', '질문 상태가 이미 변경되었습니다.');
  res.json({ questionId, status: 'ASSIGNED', routeType: 'SUBJECT', subject: { id: subject.id, name: subject.name } });
});

studentQuestionsRouter.post('/:questionId/retry', async (req, res) => {
  /* #swagger.tags = ['Student Questions']
     #swagger.summary = '질문 처리 재시도'
     #swagger.description = 'PROCESSING_FAILED 상태인 본인 질문을 실패한 모델 처리 단계부터 다시 실행합니다.'
     #swagger.responses[200] = { description: '재시도한 질문 처리 결과를 반환합니다.' }
     #swagger.responses[409] = { description: '재시도할 수 있는 질문 상태가 아닙니다.' }
     #swagger.responses[503] = { description: '외부 모델 처리에 다시 실패했습니다.' }
  */
  /* #swagger.parameters['questionId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  const questionId = positiveId(req.params.questionId, 'questionId');
  const question = ownedQuestion(questionId, req.session.userId);
  if (question.status !== 'PROCESSING_FAILED') throw conflict('QUESTION_INVALID_STATE', '처리에 실패한 질문만 재시도할 수 있습니다.', { currentStatus: question.status });
  res.json(await questionPipeline.retry(questionId));
});

studentQuestionsRouter.get('/:questionId', (req, res) => {
  /* #swagger.tags = ['Student Questions']
     #swagger.summary = '내 질문 상세 조회'
     #swagger.description = '본인 질문의 처리 상태, 보완 정보, 답변과 공지 출처를 조회합니다. 교사 답변이 있으면 최초 조회 시 읽음 처리합니다.'
     #swagger.responses[200] = { description: '질문, 처리 상태와 답변 상세를 반환합니다.' }
     #swagger.responses[404] = { description: '본인 질문을 찾을 수 없습니다.' }
  */
  /* #swagger.parameters['questionId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  const questionId = positiveId(req.params.questionId, 'questionId');
  let detail = store.getStudentQuestionDetail(questionId, req.session.userId);
  if (!detail) throw notFound('질문을 찾을 수 없습니다.');
  if (detail.row.answer_id && !detail.row.student_read_at && detail.row.author_type === 'TEACHER') {
    store.markStudentRead(detail.row.answer_id);
    detail = store.getStudentQuestionDetail(questionId, req.session.userId);
  }
  const { row, sources } = detail;
  res.json({
    id: row.id,
    originalContent: row.original_content,
    finalContent: row.final_content,
    rewrittenContent: row.rewritten_content,
    status: row.status,
    routeType: row.route_type,
    subject: row.subject_id ? { id: row.subject_id, name: row.subject_name } : null,
    failedStage: row.failed_stage,
    retryStatus: row.retry_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    details: store.getDetails(row.id),
    answer: row.answer_id ? {
      id: row.answer_id, authorType: row.author_type, teacherId: row.answer_teacher_id,
      content: row.answer_content, studentReadAt: row.student_read_at, createdAt: row.answer_created_at, sources,
    } : null,
  });
});
