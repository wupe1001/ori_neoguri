import { badRequest } from '../errors.js';

export function nonEmptyString(value, field, max = 5000) {
  if (typeof value !== 'string' || !value.trim()) throw badRequest('VALIDATION_ERROR', `${field}은(는) 비어 있지 않은 문자열이어야 합니다.`, { field });
  const result = value.trim();
  if (result.length > max) throw badRequest('VALIDATION_ERROR', `${field}은(는) ${max}자 이하여야 합니다.`, { field, max });
  return result;
}

export function positiveId(value, field = 'id') {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw badRequest('VALIDATION_ERROR', `${field}은(는) 양의 정수여야 합니다.`, { field });
  return number;
}

export function pagination(query) {
  const page = query.page === undefined ? 1 : positiveId(query.page, 'page');
  const limit = query.limit === undefined ? 20 : positiveId(query.limit, 'limit');
  if (limit > 100) throw badRequest('VALIDATION_ERROR', 'limit은 100 이하여야 합니다.', { field: 'limit', max: 100 });
  return { page, limit, offset: (page - 1) * limit };
}

export const pageBody = (items, total, page, limit) => ({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
