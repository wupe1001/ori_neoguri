import multer from 'multer';
import { AppError, badRequest } from '../errors.js';
import { config } from '../config.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: config.attachments.maxCount,
    fileSize: config.attachments.maxFileBytes,
  },
}).array('files');

export function mapMulterError(error) {
  if (error.code === 'LIMIT_FILE_COUNT') {
    return badRequest('ATTACHMENT_COUNT_EXCEEDED', `첨부파일은 최대 ${config.attachments.maxCount}개까지 업로드할 수 있습니다.`);
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(413, 'ATTACHMENT_FILE_TOO_LARGE', '첨부파일 하나의 크기가 제한을 초과했습니다.', {
      maxFileBytes: config.attachments.maxFileBytes,
    });
  }
  return badRequest('MULTIPART_INVALID', 'multipart/form-data 요청 형식이 올바르지 않습니다.');
}

export function validateParsedAttachments(files) {
  if (files.some((file) => file.buffer.length === 0)) {
    throw badRequest('ATTACHMENT_EMPTY', '빈 첨부파일은 업로드할 수 없습니다.');
  }
  const totalBytes = files.reduce((sum, file) => sum + file.buffer.length, 0);
  if (totalBytes > config.attachments.maxTotalBytes) {
    throw new AppError(413, 'ATTACHMENT_TOTAL_TOO_LARGE', '첨부파일 전체 크기가 제한을 초과했습니다.', {
      maxTotalBytes: config.attachments.maxTotalBytes,
    });
  }
}

export function multipartUpload(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return next(badRequest('MULTIPART_INVALID', 'Content-Type은 multipart/form-data여야 합니다.'));
  }
  parser(req, res, (error) => {
    if (error) return next(error instanceof multer.MulterError ? mapMulterError(error) : badRequest('MULTIPART_INVALID', 'multipart/form-data 요청을 해석할 수 없습니다.'));

    try {
      validateParsedAttachments(req.files || []);
    } catch (validationError) {
      return next(validationError);
    }
    next();
  });
}
