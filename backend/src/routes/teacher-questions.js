import { Router } from 'express';
import { AppError, badRequest, conflict, notFound } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { multipartUpload } from '../middleware/multipart-upload.js';
import { store } from '../repositories/store.js';
import { attachmentMetadata, prepareAttachments } from '../services/attachment.js';
import { nonEmptyString, pageBody, pagination, positiveId } from './helpers.js';

export const teacherQuestionsRouter = Router();
teacherQuestionsRouter.use(requireRole('TEACHER'));

const statuses = new Set(['PROCESSING','GENERATING_IMPROVEMENT_STAGE_1','AWAITING_IMPROVEMENT_STAGE_1','GENERATING_IMPROVEMENT_STAGE_2','AWAITING_IMPROVEMENT_STAGE_2','GENERATING_IMPROVEMENT_STAGE_3','GENERATING_FINAL_QUESTION_SUGGESTION','AWAITING_FINAL_QUESTION','NEEDS_SUBJECT_SELECTION','ASSIGNED','ANSWERED','NOTICE_ANSWERED','PROCESSING_FAILED']);

teacherQuestionsRouter.get('/unread-count', (req, res) => {
  /* #swagger.tags = ['Teacher Questions']
     #swagger.summary = '읽지 않은 배정 질문 수 조회'
     #swagger.description = '현재 교사에게 배정되었지만 아직 상세 조회하지 않은 과목 질문과 담임 질문 수를 조회합니다.'
     #swagger.responses[200] = { description: '읽지 않은 배정 질문 수를 반환합니다.' }
  */
  res.json({ count: store.teacherUnreadCount(req.session.userId) });
});

teacherQuestionsRouter.get('/', (req, res) => {
  /* #swagger.tags = ['Teacher Questions']
     #swagger.summary = '배정 질문 목록 조회'
     #swagger.description = '현재 교사에게 배정된 질문을 상태, 전달 유형, 단원 태그와 읽음 여부로 필터링하여 페이지 조회합니다. 목록 조회는 읽음 상태를 변경하지 않습니다.'
     #swagger.responses[200] = { description: '배정 질문 목록과 페이지 정보를 반환합니다.' }
  */
  /* #swagger.parameters['page'] = { in: 'query', type: 'integer', minimum: 1, default: 1 }
     #swagger.parameters['limit'] = { in: 'query', type: 'integer', minimum: 1, maximum: 100, default: 20 }
     #swagger.parameters['status'] = { in: 'query', type: 'string', enum: ['PROCESSING','GENERATING_IMPROVEMENT_STAGE_1','AWAITING_IMPROVEMENT_STAGE_1','GENERATING_IMPROVEMENT_STAGE_2','AWAITING_IMPROVEMENT_STAGE_2','GENERATING_IMPROVEMENT_STAGE_3','GENERATING_FINAL_QUESTION_SUGGESTION','AWAITING_FINAL_QUESTION','NEEDS_SUBJECT_SELECTION','ASSIGNED','ANSWERED','NOTICE_ANSWERED','PROCESSING_FAILED'] }
     #swagger.parameters['routeType'] = { in: 'query', type: 'string', enum: ['SUBJECT', 'HOMEROOM'] }
     #swagger.parameters['unread'] = { in: 'query', type: 'boolean' }
     #swagger.parameters['unitId'] = { in: 'query', type: 'integer', minimum: 1 }
  */
  const { page, limit, offset } = pagination(req.query);
  const filters = {};
  if (req.query.status !== undefined) {
    if (!statuses.has(req.query.status)) throw badRequest('VALIDATION_ERROR', 'status 필터 값이 올바르지 않습니다.');
    filters.status = req.query.status;
  }
  if (req.query.routeType !== undefined) {
    if (!['SUBJECT', 'HOMEROOM'].includes(req.query.routeType)) throw badRequest('VALIDATION_ERROR', 'routeType 필터 값이 올바르지 않습니다.');
    filters.routeType = req.query.routeType;
  }
  if (req.query.unread !== undefined) {
    if (!['true', 'false'].includes(req.query.unread)) throw badRequest('VALIDATION_ERROR', 'unread는 true 또는 false여야 합니다.');
    filters.unread = req.query.unread === 'true';
  }
  if (req.query.unitId !== undefined) filters.unitId = positiveId(req.query.unitId, 'unitId');
  const result = store.listTeacherQuestions(req.session.userId, filters, limit, offset);
  const items = result.items.map((item) => ({
    id: item.id, content: item.content, status: item.status, routeType: item.routeType,
    teacherReadAt: item.teacherReadAt, createdAt: item.createdAt, studentId: item.studentId,
    attachmentCount: item.attachmentCount,
    subject: item.subjectId ? { id: item.subjectId, name: item.subjectName } : null,
    unit: item.unitId ? { id: item.unitId, name: item.unitName } : null,
  }));
  res.json(pageBody(items, result.total, page, limit));
});

teacherQuestionsRouter.get('/:questionId', (req, res) => {
  /* #swagger.tags = ['Teacher Questions']
     #swagger.summary = '배정 질문 상세 조회'
     #swagger.description = '현재 교사에게 배정된 질문과 전체 질문 개선 이력을 조회합니다. 최초 상세 조회 시 질문을 읽음 처리합니다.'
     #swagger.responses[200] = { description: '배정 질문 상세를 반환하고 읽음 처리합니다.' }
     #swagger.responses[404] = { description: '현재 교사에게 배정된 질문을 찾을 수 없습니다.' }
  */
  /* #swagger.parameters['questionId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  const questionId = positiveId(req.params.questionId, 'questionId');
  let question = store.getTeacherQuestion(questionId, req.session.userId);
  if (!question) throw notFound('배정된 질문을 찾을 수 없습니다.');
  if (!question.teacher_read_at) {
    store.markTeacherRead(questionId);
    question = store.getTeacherQuestion(questionId, req.session.userId);
  }
  res.json({
    id: question.id, studentId: question.student_id, originalContent: question.original_content,
    finalContent: question.final_content, status: question.status, routeType: question.route_type,
    subject: question.subject_id ? { id: question.subject_id, name: question.subject_name } : null,
    unit: question.unit_id ? { id: question.unit_id, name: question.unit_name } : null,
    teacherReadAt: question.teacher_read_at, createdAt: question.created_at, updatedAt: question.updated_at,
    attachments: store.listQuestionAttachments(question.id).map(attachmentMetadata),
    improvement: store.getImprovement(question.id),
  });
});

teacherQuestionsRouter.post('/:questionId/answer', multipartUpload, (req, res) => {
  /* #swagger.tags = ['Teacher Questions']
     #swagger.summary = '교사 답변 등록'
     #swagger.description = 'ASSIGNED 상태로 현재 교사에게 배정된 질문에 답변을 한 번 등록하고 질문 상태를 ANSWERED로 변경합니다.'
     #swagger.responses[201] = { description: '교사 답변을 등록했습니다.' }
     #swagger.responses[409] = { description: '이미 답변했거나 답변할 수 있는 질문 상태가 아닙니다.' }
  */
  /* #swagger.parameters['questionId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  /* #swagger.consumes = ['multipart/form-data']
     #swagger.parameters['content'] = { in: 'formData', required: true, type: 'string' }
     #swagger.parameters['files'] = { in: 'formData', required: false, type: 'array', items: { type: 'file' }, collectionFormat: 'multi' }
  */
  const questionId = positiveId(req.params.questionId, 'questionId');
  const content = nonEmptyString(req.body?.content, 'content', 5000);
  const attachments = prepareAttachments(req.files);
  let result;
  try {
    result = store.createTeacherAnswer(questionId, req.session.userId, content, attachments);
  } catch (error) {
    if (!attachments.length) throw error;
    throw new AppError(500, 'ATTACHMENT_STORAGE_FAILED', '첨부파일을 저장하지 못했습니다.');
  }
  if (result.kind === 'NOT_FOUND') throw notFound('배정된 질문을 찾을 수 없습니다.');
  if (result.kind === 'DUPLICATE') throw conflict('ANSWER_ALREADY_EXISTS', '이 질문에는 이미 답변이 등록되었습니다.');
  if (result.kind === 'INVALID_STATE') throw conflict('QUESTION_INVALID_STATE', 'ASSIGNED 상태의 질문에만 답변할 수 있습니다.', { currentStatus: result.status });
  res.status(201).json({ id: result.id, questionId, content: result.content, createdAt: result.createdAt });
});
