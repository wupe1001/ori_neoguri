// 백엔드 제한과 같다 (backend/src/config.js의 attachments)
export const ATTACH_LIMIT = { count: 5, fileBytes: 10 * 1024 * 1024, totalBytes: 25 * 1024 * 1024 }

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`

// 새로 고른 사진을 지금 목록에 붙인다. 제한을 넘으면 붙이지 않고 이유를 돌려준다.
export function addImages(current: File[], picked: File[]): { files: File[]; error: string | null } {
  const images = picked.filter((f) => f.type.startsWith('image/'))
  if (images.length < picked.length) return { files: current, error: '사진 파일만 올릴 수 있어요.' }
  const next = [...current, ...images]
  if (next.length > ATTACH_LIMIT.count) return { files: current, error: `사진은 ${ATTACH_LIMIT.count}장까지 올릴 수 있어요.` }
  if (images.some((f) => f.size === 0)) return { files: current, error: '빈 파일은 올릴 수 없어요.' }
  if (images.some((f) => f.size > ATTACH_LIMIT.fileBytes))
    return { files: current, error: `사진 한 장은 ${mb(ATTACH_LIMIT.fileBytes)}까지 올릴 수 있어요.` }
  if (next.reduce((sum, f) => sum + f.size, 0) > ATTACH_LIMIT.totalBytes)
    return { files: current, error: `사진은 모두 합쳐 ${mb(ATTACH_LIMIT.totalBytes)}까지 올릴 수 있어요.` }
  return { files: next, error: null }
}
