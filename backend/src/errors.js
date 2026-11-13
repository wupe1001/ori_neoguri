export class AppError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ModelError extends AppError {
  constructor(code, message, { retryable = true, details = {}, cause } = {}) {
    super(503, code, message, { ...details, retryable });
    this.retryable = retryable;
    this.cause = cause;
  }
}

export const badRequest = (code, message, details) => new AppError(400, code, message, details);
export const forbidden = (message = '이 요청을 수행할 권한이 없습니다.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = '요청한 리소스를 찾을 수 없습니다.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code, message, details) => new AppError(409, code, message, details);

export function mapModelHttpError(status, retryAfter) {
  const mapping = {
    400: ['MODEL_REQUEST_INVALID', false],
    401: ['MODEL_AUTH_FAILED', false],
    402: ['MODEL_CREDIT_EXHAUSTED', false],
    403: ['MODEL_ACCESS_DENIED', false],
    404: ['MODEL_NOT_FOUND', false],
    429: ['MODEL_RATE_LIMITED', true],
    500: ['MODEL_PROVIDER_UNAVAILABLE', true],
    502: ['MODEL_PROVIDER_UNAVAILABLE', true],
    503: ['MODEL_PROVIDER_UNAVAILABLE', true],
  };
  const [code, retryable] = mapping[status] || ['MODEL_PROVIDER_UNAVAILABLE', true];
  return new ModelError(code, '외부 모델을 호출하지 못했습니다.', {
    retryable,
    details: retryAfter ? { retryAfter } : {},
  });
}
