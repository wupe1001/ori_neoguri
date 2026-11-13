import type { Notice, Question } from '../types/question'
import type { ClassRef, Teacher } from '../types/user'
import { delay, newId, readDb, writeDb } from './mock/db'
import { CLASS_CODES } from './mock/seed'

const sameClass = (a: ClassRef, b: ClassRef) => a.grade === b.grade && a.classNo === b.classNo

// TODO(백엔드): GET /api/notices?grade=&classNo=

// 학생: 우리 반이 받은 공지 (최신순)
export async function getNoticesFor(classRef: ClassRef): Promise<Notice[]> {
  await delay()
  return readDb()
    .notices.filter((n) => n.target.some((t) => sameClass(t, classRef)))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

// TODO(백엔드): GET /api/notices

// 교사: 보낸 공지 전체 (최신순)
export async function getAllNotices(): Promise<Notice[]> {
  await delay()
  return [...readDb().notices].sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

// TODO(백엔드): GET /api/classes

// 공지를 받을 수 있는 반 목록
export async function getClasses(): Promise<ClassRef[]> {
  await delay(200)
  return Object.values(CLASS_CODES)
}

// TODO(백엔드): POST /api/notices

// 교사: 공지 일괄 전송. 보낸 공지는 답 근거 저장소에 쌓여 챗봇·AI 초안의 근거가 된다.
export async function sendNotice(teacher: Teacher, title: string, body: string, target: ClassRef[]): Promise<Notice> {
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

// TODO(백엔드): GET /api/faq?grade=&classNo=

// 학생: 자주 묻는 질문 = 우리 반에서 선생님이 승인한 답 (최신순)
export async function getApprovedAnswers(classRef: ClassRef): Promise<Question[]> {
  await delay()
  return readDb()
    .questions.filter((q) => q.answer && sameClass(q.author, classRef))
    .sort((a, b) => (b.answer?.answeredAt ?? '').localeCompare(a.answer?.answeredAt ?? ''))
}
