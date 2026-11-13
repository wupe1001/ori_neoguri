import type { Notice, Question } from '../types/question'
import type { ClassRef, Teacher } from '../types/user'
import type { NoticeDetail, NoticeItem, Paginated } from './backend/types'
import { get, post, USE_MOCK } from './client'
import { delay, newId, readDb, writeDb } from './mock/db'
import { CLASS_CODES } from './mock/seed'

// 공지 API. USE_MOCK이면 브라우저 목업, 아니면 실제 백엔드를 쓴다.
// 실제 백엔드는 공지를 모든 학생에게 보낸다 (반 선택 없음).

const sameClass = (a: ClassRef, b: ClassRef) => a.grade === b.grade && a.classNo === b.classNo

// 백엔드는 작성 교사 번호만 준다
const fromBackend = (n: NoticeDetail): Notice => ({
  id: String(n.id),
  title: n.title,
  body: n.content,
  senderName: '선생님',
  target: [],
  sentAt: n.createdAt,
})

// 공지 내용은 바뀌지 않으므로 한 번 불러온 상세는 기억해 둔다 (5초마다 다시 불러올 때 요청을 줄인다)
const detailCache = new Map<number, NoticeDetail>()

async function getNoticeDetail(id: number): Promise<NoticeDetail> {
  const cached = detailCache.get(id)
  if (cached) return cached
  const detail = await get<NoticeDetail>(`/api/notices/${id}`)
  detailCache.set(id, detail)
  return detail
}

// 실제: GET /api/notices/?limit=20 → 목록에는 내용이 없어서 상세(GET /api/notices/:id)도 불러온다
async function getBackendNotices(): Promise<Notice[]> {
  const list = await get<Paginated<NoticeItem>>('/api/notices/?limit=20')
  const details = await Promise.all(list.items.map((n) => getNoticeDetail(n.id)))
  return details.map(fromBackend)
}

// 학생: 우리 반이 받은 공지 (최신순)
export async function getNoticesFor(classRef: ClassRef): Promise<Notice[]> {
  if (!USE_MOCK) return getBackendNotices()
  await delay()
  return readDb()
    .notices.filter((n) => n.target.some((t) => sameClass(t, classRef)))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

// 교사: 보낸 공지 전체 (최신순)
export async function getAllNotices(): Promise<Notice[]> {
  if (!USE_MOCK) return getBackendNotices()
  await delay()
  return [...readDb().notices].sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

// 받는 반을 고를 수 있는지 (실제 백엔드는 전체 공지만 있다)
export const CAN_TARGET_CLASSES = USE_MOCK

// 공지를 받을 수 있는 반 목록 (목업만)
export async function getClasses(): Promise<ClassRef[]> {
  if (!USE_MOCK) return []
  await delay(200)
  return Object.values(CLASS_CODES)
}

// 교사: 공지 보내기. 보낸 공지는 답 근거 저장소에 쌓여 챗봇이 이 공지로 답할 수 있다.
// 실제: POST /api/notices/ (target은 무시된다)
export async function sendNotice(teacher: Teacher, title: string, body: string, target: ClassRef[]): Promise<Notice> {
  if (!USE_MOCK) {
    const created = await post<NoticeDetail>('/api/notices/', { title, content: body })
    detailCache.set(created.id, created)
    return { ...fromBackend(created), senderName: `${teacher.name} 선생님` }
  }
  await delay()
  const notice: Notice = {
    id: newId('n'),
    title,
    body,
    senderName: `${teacher.name} 선생님`,
    target,
    sentAt: new Date().toISOString(),
  }
  const db = readDb()
  db.notices.unshift(notice)
  writeDb(db)
  return notice
}

// 자주 묻는 질문(승인된 답 모아보기)은 실제 백엔드에 아직 없다
export const HAS_FAQ = USE_MOCK

// 학생: 자주 묻는 질문 = 우리 반에서 선생님이 승인한 답 (최신순, 목업만)
export async function getApprovedAnswers(classRef: ClassRef): Promise<Question[]> {
  if (!USE_MOCK) return []
  await delay()
  return readDb()
    .questions.filter((q) => q.answer && sameClass(q.author, classRef))
    .sort((a, b) => (b.answer?.answeredAt ?? '').localeCompare(a.answer?.answeredAt ?? ''))
}
