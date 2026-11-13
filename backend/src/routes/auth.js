import { Router } from 'express';
import { AppError } from '../errors.js';
import { store } from '../repositories/store.js';
import { nonEmptyString } from './helpers.js';

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => {
  /* #swagger.tags = ['Auth']
     #swagger.summary = '로그인'
     #swagger.description = '로그인 ID와 비밀번호를 확인하고 학생 또는 교사 세션을 생성합니다. 이미 로그인한 세션은 새 사용자로 교체됩니다.'
     #swagger.responses[200] = { description: '로그인 성공. 사용자 ID와 역할을 반환합니다.' }
     #swagger.responses[401] = { description: '계정 정보가 일치하지 않습니다.' }
  */
  /* #swagger.parameters['body'] = {
       in: 'body',
       required: true,
       schema: { $ref: '#/definitions/LoginRequest' }
  } */
  try {
    const loginId = nonEmptyString(req.body?.loginId, 'loginId', 200);
    const password = nonEmptyString(req.body?.password, 'password', 500);
    const user = store.findUserByCredentials(loginId, password);
    if (!user) throw new AppError(401, 'LOGIN_FAILED', '계정 정보가 일치하지 않습니다.');
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      req.session.role = user.role;
      res.json({ userId: user.id, role: user.role, nickname: user.nickname });
    });
  } catch (error) { next(error); }
});

authRouter.post('/logout', (req, res, next) => {
  /* #swagger.tags = ['Auth']
     #swagger.summary = '로그아웃'
     #swagger.description = '현재 세션을 파기합니다. 로그인 여부와 관계없이 성공 처리합니다.'
     #swagger.responses[204] = { description: '세션을 파기했습니다.' }
  */
  if (!req.session) return res.status(204).end();
  req.session.destroy((error) => error ? next(error) : res.status(204).end());
});
