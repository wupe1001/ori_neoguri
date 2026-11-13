import type { Notice } from '../types/question'
import type { ClassRef } from '../types/user'
import { delay, readDb } from './mock/db'

// TODO(백엔드): GET /api/notices?grade=&classNo=

// 학생: 우리 반이 받은 공지
export async function getNoticesFor(classRef: ClassRef): Promise<Notice[]> {
  await delay()
  return readDb().notices.filter((n) =>
    n.target.some((t) => t.grade === classRef.grade && t.classNo === classRef.classNo),
  )
}
