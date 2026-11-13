import type { FiveW1H, Question, Source } from '../types/question'
import type { Department, Student, Teacher } from '../types/user'
import { classify } from './ai'
import { delay, newId, readDb, subscribeDb, writeDb } from './mock/db'
import { TEACHER_CODES } from './mock/seed'

// 질문 관련 API의 목업

export type SubmitQuestionInput = {
  student: Student
  isAnonymous: boolean
  originalText: string
  fiveW1H: FiveW1H
  rewrittenText: string
}

// 반 담임 교사를 찾는다 (목업 분류 기준: 우리 반 담임에게 보낸다)
function findHomeroomTeacher(student: Student): Teacher | undefined {
  return Object.values(TEACHER_CODES).find(
    (t) => t.homeroom?.grade === student.grade && t.homeroom?.classNo === student.classNo,
  )
}

// TODO(백엔드): POST /api/questions

export async function submitQuestion(input: SubmitQuestionInput): Promise<Question> {
  await delay()
  const { student, isAnonymous } = input
  const teacher = findHomeroomTeacher(student)
  const question: Question = {
    id: newId('q'),
    studentId: student.id,
    isAnonymous,
    author: { grade: student.grade, classNo: student.classNo, nickname: isAnonymous ? null : student.nickname },
    originalText: input.originalText,
    fiveW1H: input.fiveW1H,
    rewrittenText: input.rewrittenText,
    category: classify(input.originalText),
    status: 'received',
    assignee: teacher ? { type: 'teacher', teacherId: teacher.id } : { type: 'department', department: '교무부' },
    forwardReason: null,
    answer: null,
    createdAt: new Date().toISOString(),
  }
  const db = readDb()
  db.questions.unshift(question)
  writeDb(db)
  return question
}

// TODO(백엔드): GET /api/students/:id/questions

// 학생: 내 질문 목록
export async function getMyQuestions(studentId: string): Promise<Question[]> {
  await delay()
  return readDb().questions.filter((q) => q.studentId === studentId)
}

// TODO(백엔드): GET /api/questions/:id

export async function getQuestion(id: string): Promise<Question> {
  await delay()
  const question = readDb().questions.find((q) => q.id === id)
  if (!question) throw new Error('질문을 찾을 수 없어요.')
  return question
}

// TODO(백엔드): GET /api/teachers/:id/inbox?box=mine|department

// 교사: 내 질문함 또는 부서 질문함
export async function getInbox(teacher: Teacher, box: 'mine' | 'department'): Promise<Question[]> {
  await delay()
  return readDb().questions.filter((q) =>
    box === 'mine'
      ? q.assignee.type === 'teacher' && q.assignee.teacherId === teacher.id
      : q.assignee.type === 'department' && q.assignee.department === teacher.department,
  )
}

function updateQuestion(id: string, update: (q: Question) => void): Question {
  const db = readDb()
  const question = db.questions.find((q) => q.id === id)
  if (!question) throw new Error('질문을 찾을 수 없어요.')
  update(question)
  writeDb(db)
  return question
}

// TODO(백엔드): POST /api/questions/:id/answer

// 교사: 답을 고쳐서 승인 → 답변 완료.
// alsoIds에 넣은 비슷한 질문들에도 같은 답을 보낸다.
export async function approveAnswer(
  id: string,
  teacher: Teacher,
  text: string,
  sources: Source[],
  alsoIds: string[] = [],
): Promise<Question> {
  await delay()
  const db = readDb()
  const targets = db.questions.filter((q) => q.id === id || alsoIds.includes(q.id))
  const main = targets.find((q) => q.id === id)
  if (!main) throw new Error('질문을 찾을 수 없어요.')
  const answer = {
    text,
    teacherName: teacher.name,
    sources,
    answeredAt: new Date().toISOString(),
    recipients: targets.length,
  }
  for (const q of targets) {
    q.status = 'answered'
    q.answer = { ...answer }
  }
  writeDb(db)
  return main
}

// TODO(백엔드): POST /api/questions/:id/forward

// 교사: 다른 부서로 넘기기 → 전달됨
export async function forwardQuestion(id: string, department: Department, reason: string): Promise<Question> {
  await delay()
  return updateQuestion(id, (q) => {
    q.status = 'forwarded'
    q.assignee = { type: 'department', department }
    q.forwardReason = reason
  })
}

// TODO(백엔드): 폴링(예: 5초마다 다시 불러오기) 또는 웹소켓으로 교체

// 질문 데이터가 바뀌면 onChange를 부른다. 반환값은 구독 해제 함수.
export function subscribeQuestions(onChange: () => void) {
  return subscribeDb(onChange)
}
