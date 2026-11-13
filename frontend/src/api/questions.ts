import { getSeenAnswerIds } from '../lib/seenAnswers'
import type { FiveW1H, Question, Source } from '../types/question'
import type { Department, Student, Teacher } from '../types/user'
import { classify } from './ai'
import { fromStudentDetail, fromStudentItem, fromTeacherDetail, fromTeacherItem } from './backend/mappers'
import type {
  AnswerCreated,
  Paginated,
  StudentQuestionDetail,
  StudentQuestionItem,
  TeacherQuestionDetail,
  TeacherQuestionItem,
} from './backend/types'
import { get, post, USE_MOCK } from './client'
import { delay, newId, readDb, subscribeDb, writeDb } from './mock/db'
import { TEACHER_CODES } from './mock/seed'

// 질문 API. USE_MOCK이면 브라우저 목업, 아니면 실제 백엔드를 쓴다.
// 화면은 어느 쪽이든 같은 Question 타입을 받는다.

// ─── 학생 ───

// 학생: 내 질문 목록 (최신순)
// 실제: GET /api/questions/?limit=100
export async function getMyQuestions(studentId: string): Promise<Question[]> {
  if (!USE_MOCK) {
    const res = await get<Paginated<StudentQuestionItem>>('/api/questions/?limit=100')
    return res.items.map((q) => fromStudentItem(q, studentId))
  }
  await delay()
  return readDb().questions.filter((q) => q.studentId === studentId)
}

// 학생: 내 질문 상세. 실제 백엔드는 처음 열 때 선생님 답을 읽음 처리한다.
// 실제: GET /api/questions/:id
export async function getStudentQuestion(id: string, studentId: string): Promise<Question> {
  if (!USE_MOCK) return fromStudentDetail(await get<StudentQuestionDetail>(`/api/questions/${id}`), studentId)
  const question = await getMockQuestion(id)
  // 다른 학생의 질문은 보여주지 않는다
  if (question.studentId !== studentId) throw new Error('질문을 찾을 수 없어요.')
  return question
}

// 학생: 아직 확인하지 않은 선생님 답 수 (홈의 "새로 온 답")
// 실제: GET /api/questions/unread-count
export async function getUnreadAnswerCount(studentId: string): Promise<number> {
  if (!USE_MOCK) return (await get<{ count: number }>('/api/questions/unread-count')).count
  await delay(200)
  const seen = getSeenAnswerIds(studentId)
  return readDb().questions.filter((q) => q.studentId === studentId && q.answer && !seen.includes(q.id)).length
}

// ─── 교사 ───

export type InboxBox = 'mine' | 'department'

// 질문함 탭 이름. 실제 백엔드는 과목 질문함 / 담임 질문함으로 나뉜다.
export function inboxLabels(teacher: Teacher): Record<InboxBox, string> {
  if (!USE_MOCK) return { mine: '과목 질문함', department: '담임 질문함' }
  return { mine: '내 질문함', department: `${teacher.department ?? '부서'} 질문함` }
}

// 교사: 질문함
// 실제: GET /api/teacher/questions/?routeType=SUBJECT|HOMEROOM&limit=100
export async function getInbox(teacher: Teacher, box: InboxBox): Promise<Question[]> {
  if (!USE_MOCK) {
    const routeType = box === 'mine' ? 'SUBJECT' : 'HOMEROOM'
    const res = await get<Paginated<TeacherQuestionItem>>(`/api/teacher/questions/?routeType=${routeType}&limit=100`)
    return res.items.map(fromTeacherItem)
  }
  await delay()
  return readDb().questions.filter((q) =>
    box === 'mine'
      ? q.assignee.type === 'teacher' && q.assignee.teacherId === teacher.id
      : q.assignee.type === 'department' && q.assignee.department === teacher.department,
  )
}

// 교사: 질문 상세. 실제 백엔드는 처음 열 때 읽음 처리한다.
// 실제: GET /api/teacher/questions/:id
export async function getTeacherQuestion(id: string): Promise<Question> {
  if (!USE_MOCK) return fromTeacherDetail(await get<TeacherQuestionDetail>(`/api/teacher/questions/${id}`))
  return getMockQuestion(id)
}

// 교사: 답을 고쳐서 승인 → 답변 완료.
// alsoIds에 넣은 비슷한 질문들에도 같은 답을 보낸다 (목업만. 실제 백엔드는 이 질문에만 답한다).
// 실제: POST /api/teacher/questions/:id/answer
export async function approveAnswer(
  id: string,
  teacher: Teacher,
  text: string,
  sources: Source[],
  alsoIds: string[] = [],
): Promise<Question> {
  if (!USE_MOCK) {
    const created = await post<AnswerCreated>(`/api/teacher/questions/${id}/answer`, { content: text })
    const question = await getTeacherQuestion(id)
    // 교사 상세에는 답 내용이 오지 않아서, 방금 보낸 답을 붙여서 돌려준다
    return {
      ...question,
      answer: { text: created.content, teacherName: teacher.name, sources: [], answeredAt: created.createdAt, recipients: 1 },
    }
  }

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

// 다른 부서로 넘기기는 실제 백엔드에 아직 없다
export const CAN_FORWARD = USE_MOCK

// 교사: 다른 부서로 넘기기 → 전달됨 (목업만)
export async function forwardQuestion(id: string, department: Department, reason: string): Promise<Question> {
  await delay()
  return updateQuestion(id, (q) => {
    q.status = 'forwarded'
    q.assignee = { type: 'department', department }
    q.forwardReason = reason
  })
}

// ─── 갱신 알림 ───

// 질문 데이터가 바뀌면 onChange를 부른다. 반환값은 구독 해제 함수.
// 목업: 다른 탭에서 저장소가 바뀌면 / 실제: 5초마다 다시 불러온다
export function subscribeQuestions(onChange: () => void) {
  if (!USE_MOCK) {
    const timer = window.setInterval(onChange, 5000)
    return () => window.clearInterval(timer)
  }
  return subscribeDb(onChange)
}

// ─── 목업 전용 ───

async function getMockQuestion(id: string): Promise<Question> {
  await delay()
  const question = readDb().questions.find((q) => q.id === id)
  if (!question) throw new Error('질문을 찾을 수 없어요.')
  return question
}

function updateQuestion(id: string, update: (q: Question) => void): Question {
  const db = readDb()
  const question = db.questions.find((q) => q.id === id)
  if (!question) throw new Error('질문을 찾을 수 없어요.')
  update(question)
  writeDb(db)
  return question
}

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

// 목업 질문하기 엔진(askMock.ts)이 마지막에 부른다. 실제 백엔드는 ask.ts를 쓴다.
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
