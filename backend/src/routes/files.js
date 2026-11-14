import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../repositories/store.js';
import { safeMimeType } from '../services/attachment.js';
import { notFound } from '../errors.js';
import { positiveId } from './helpers.js';

export const filesRouter = Router();
filesRouter.use(requireAuth);

filesRouter.get('/:fileId', (req, res) => {
  /* #swagger.tags = ['Files']
     #swagger.summary = '첨부파일 다운로드'
     #swagger.description = '질문 작성 학생, 배정 교사 또는 답변 작성 교사에게만 첨부파일을 다운로드합니다. 권한이 없거나 파일이 없으면 404를 반환합니다.'
     #swagger.produces = ['application/octet-stream']
     #swagger.responses[200] = { description: '원본 첨부파일 바이너리' }
     #swagger.responses[404] = { description: '파일이 없거나 다운로드 권한이 없습니다.' }
  */
  /* #swagger.parameters['fileId'] = { in: 'path', required: true, type: 'integer', minimum: 1 } */
  const fileId = positiveId(req.params.fileId, 'fileId');
  const file = store.getAuthorizedFile(fileId, req.session.userId);
  if (!file) throw notFound('첨부파일을 찾을 수 없습니다.');

  res.attachment(file.originalName);
  res.type(safeMimeType(file.mimeType));
  res.set('Content-Length', String(file.sizeBytes));
  res.send(file.content);
});
