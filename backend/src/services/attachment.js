import { createHash } from 'node:crypto';

export function prepareAttachments(files = []) {
  return files.map((file, displayOrder) => ({
    originalName: file.originalname,
    mimeType: file.mimetype || 'application/octet-stream',
    sizeBytes: file.buffer.length,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
    displayOrder,
    content: file.buffer,
  }));
}

export function attachmentMetadata(row) {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    downloadUrl: `/api/files/${row.id}`,
  };
}

export function safeMimeType(value) {
  const token = "[!#$%&'*+\\-.^_`|~0-9A-Za-z]+";
  return new RegExp(`^${token}/${token}$`).test(value || '') ? value : 'application/octet-stream';
}
