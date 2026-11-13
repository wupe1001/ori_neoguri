import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { store } from '../repositories/store.js';
import { nonEmptyString, pageBody, pagination, positiveId } from './helpers.js';

export const noticesRouter = Router();

noticesRouter.get('/', requireAuth, (req, res) => {
  /* #swagger.tags = ['Notices']
     #swagger.summary = '공지사항 목록 조회'
     #swagger.description = '로그인한 학생 또는 교사가 공지사항을 최신순으로 페이지 조회합니다. 이 요청은 읽음 상태를 변경하지 않습니다.'
     #swagger.responses[200] = { description: '공지사항 목록과 페이지 정보를 반환합니다.' }
     #swagger.responses[401] = { description: '로그인이 필요합니다.' }
  */
  /* #swagger.parameters['page'] = { in: 'query', type: 'integer', minimum: 1, default: 1 }
     #swagger.parameters['limit'] = { in: 'query', type: 'integer', minimum: 1, maximum: 100, default: 20 }
  */
  const { page, limit, offset } = pagination(req.query);
  res.json(pageBody(store.listNotices(limit, offset), store.countNotices(), page, limit));
});

noticesRouter.get('/:noticeId', requireAuth, (req, res) => {
  /* #swagger.tags = ['Notices']
     #swagger.summary = '공지사항 상세 조회'
     #swagger.description = '로그인한 학생 또는 교사가 지정한 공지사항의 제목, 본문, 작성자와 작성일을 조회합니다.'
     #swagger.responses[200] = { description: '공지사항 상세 정보를 반환합니다.' }
     #swagger.responses[404] = { description: '공지사항을 찾을 수 없습니다.' }
  */
  /* #swagger.parameters['noticeId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  const notice = store.getNotice(positiveId(req.params.noticeId, 'noticeId'));
  if (!notice) throw notFound('공지사항을 찾을 수 없습니다.');
  res.json(notice);
});

noticesRouter.post('/', requireRole('TEACHER'), (req, res) => {
  /* #swagger.tags = ['Notices']
     #swagger.summary = '공지사항 등록'
     #swagger.description = '교사가 새 공지사항을 등록합니다. 작성자는 현재 로그인한 교사로 자동 지정됩니다.'
     #swagger.responses[201] = { description: '공지사항을 등록했습니다.' }
     #swagger.responses[403] = { description: '교사만 등록할 수 있습니다.' }
  */
  /* #swagger.parameters['body'] = {
       in: 'body',
       required: true,
       schema: { $ref: '#/definitions/NoticeRequest' }
  } */
  const title = nonEmptyString(req.body?.title, 'title', 500);
  const content = nonEmptyString(req.body?.content, 'content', 20000);
  res.status(201).json(store.createNotice(title, content, req.session.userId));
});
