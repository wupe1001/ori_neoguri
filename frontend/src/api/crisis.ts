import type { CrisisAlert } from '../types/question'
import type { Student, Teacher } from '../types/user'
import { USE_MOCK } from './client'
import { delay, newId, readDb, writeDb } from './mock/db'

// TODO(백엔드): POST /api/crisis

// 학생: 담임·상담 선생님께 연결 요청. revealName이 false면 학년·반만 알린다.
export async function requestCounseling(student: Student, text: string, revealName: boolean): Promise<CrisisAlert> {
  await delay()
  const alert: CrisisAlert = {
    id: newId('c'),
    studentId: student.id,
    author: { grade: student.grade, classNo: student.classNo, nickname: revealName ? student.nickname : null },
    text,
    handled: false,
    createdAt: new Date().toISOString(),
  }
  const db = readDb()
  db.crisisAlerts.unshift(alert)
  writeDb(db)
  return alert
}

// TODO(백엔드): GET /api/teachers/:id/crisis

// 교사: 우리 반 학생의 알림 (상담실 소속이면 전체)
// 실제 백엔드는 위기 신호 질문을 담임 질문함(HOMEROOM)으로 보내고 따로 알림 API가 없어서 비워 둔다
export async function getCrisisAlerts(teacher: Teacher): Promise<CrisisAlert[]> {
  if (!USE_MOCK) return []
  await delay()
  return readDb().crisisAlerts.filter(
    (a) =>
      !a.handled &&
      (teacher.department === '상담실' ||
        (teacher.homeroom?.grade === a.author.grade && teacher.homeroom?.classNo === a.author.classNo)),
  )
}

// TODO(백엔드): POST /api/crisis/:id/handled

// 교사: 확인 처리 (홈 위기 알림에서 사라진다)
export async function markCrisisHandled(id: string): Promise<void> {
  await delay(200)
  const db = readDb()
  const alert = db.crisisAlerts.find((a) => a.id === id)
  if (alert) alert.handled = true
  writeDb(db)
}
