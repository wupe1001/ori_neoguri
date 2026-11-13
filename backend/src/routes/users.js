import { Router } from 'express';
import { notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../repositories/store.js';
import { positiveId } from './helpers.js';

export const usersRouter = Router();

usersRouter.get('/:userId', requireAuth, (req, res) => {
  /* #swagger.tags = ['Users']
     #swagger.summary = '사용자 계정 정보 조회'
     #swagger.description = '로그인한 사용자가 users 테이블의 ID로 계정 정보를 조회합니다. 비밀번호는 반환하지 않습니다.'
     #swagger.parameters['userId'] = { in: 'path', required: true, type: 'integer', minimum: 1 }
     #swagger.responses[200] = {
       description: '사용자 계정 정보를 반환합니다.',
       schema: { $ref: '#/definitions/UserResponse' }
     }
     #swagger.responses[401] = { description: '로그인이 필요합니다.' }
     #swagger.responses[404] = { description: '사용자를 찾을 수 없습니다.' }
  */
  const user = store.getPublicUser(positiveId(req.params.userId, 'userId'));
  if (!user) throw notFound('사용자를 찾을 수 없습니다.');
  res.json(user);
});
