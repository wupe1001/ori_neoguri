import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../repositories/store.js';

export const subjectsRouter = Router();
subjectsRouter.get('/', requireAuth, (_req, res) => {
  /* #swagger.tags = ['Subjects']
     #swagger.summary = '과목 목록 조회'
     #swagger.description = '로그인한 사용자가 질문의 직접 과목 선택에 사용할 수 있는 전체 과목을 조회합니다.'
     #swagger.responses[200] = { description: '전체 과목 목록을 반환합니다.' }
     #swagger.responses[401] = { description: '로그인이 필요합니다.' }
  */
  res.json({ items: store.listSubjects().map(({ id, name }) => ({ id, name })) });
});
