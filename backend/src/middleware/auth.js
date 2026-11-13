import { AppError } from '../errors.js';

export function requireAuth(req, _res, next) {
  if (!req.session?.userId) return next(new AppError(401, 'AUTHENTICATION_REQUIRED', '로그인이 필요합니다.'));
  next();
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.session?.userId) return next(new AppError(401, 'AUTHENTICATION_REQUIRED', '로그인이 필요합니다.'));
    if (req.session.role !== role) return next(new AppError(403, 'ROLE_FORBIDDEN', '현재 사용자 역할로는 요청할 수 없습니다.'));
    next();
  };
}
