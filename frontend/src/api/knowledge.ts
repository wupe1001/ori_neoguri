import type { Material, Notice, Question } from '../types/question'
import type { Teacher } from '../types/user'
import { delay, newId, readDb, writeDb } from './mock/db'

// 답 근거 저장소: 보낸 공지 + 승인된 답 + 수업 자료. 챗봇과 AI 답 초안은 여기서 근거를 찾는다.

export type ApprovedAnswer = {
  question: Question // 대표 질문
  recipients: number // 이 답을 함께 받은 질문 수
}

export type Knowledge = {
  notices: Notice[]
  answers: ApprovedAnswer[]
  materials: Material[]
}

// TODO(백엔드): GET /api/knowledge

export async function getKnowledge(): Promise<Knowledge> {
  await delay()
  const db = readDb()

  // 비슷한 질문에 함께 보낸 답은 질문마다 복사돼 있으므로 하나로 묶는다
  const byAnswer = new Map<string, ApprovedAnswer>()
  for (const q of db.questions) {
    if (!q.answer) continue
    const key = `${q.answer.answeredAt}|${q.answer.text}`
    if (!byAnswer.has(key)) byAnswer.set(key, { question: q, recipients: q.answer.recipients ?? 1 })
  }

  const newest = <T,>(list: T[], date: (x: T) => string) => [...list].sort((a, b) => date(b).localeCompare(date(a)))
  return {
    notices: newest(db.notices, (n) => n.sentAt),
    answers: newest([...byAnswer.values()], (a) => a.question.answer?.answeredAt ?? ''),
    materials: newest(db.materials, (m) => m.createdAt),
  }
}

// TODO(백엔드): POST /api/materials (파일 업로드는 백엔드에서 글자를 뽑아 저장)

// 교사: 수업 자료·루브릭 올리기. 지금은 제목과 내용을 붙여넣는다.
export async function addMaterial(teacher: Teacher, title: string, body: string): Promise<Material> {
  await delay()
  const material: Material = {
    id: newId('m'),
    title,
    body,
    teacherName: teacher.name,
    createdAt: new Date().toISOString(),
  }
  const db = readDb()
  db.materials.unshift(material)
  writeDb(db)
  return material
}
