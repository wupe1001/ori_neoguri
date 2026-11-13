import { AppError } from '../errors.js';

export function notFoundHandler(_req, _res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', '요청한 API 경로를 찾을 수 없습니다.'));
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof SyntaxError && 'body' in error) {
    error = new AppError(400, 'INVALID_JSON', '요청 JSON 형식이 올바르지 않습니다.');
  }
  const status = error instanceof AppError ? error.status : 500;
  if (status === 500) console.error(error);
  res.status(status).json({
    error: {
      code: error instanceof AppError ? error.code : 'INTERNAL_SERVER_ERROR',
      message: error instanceof AppError ? error.message : '서버 내부 오류가 발생했습니다.',
      details: error instanceof AppError ? error.details : {},
    },
  });
}
