import type { ClassRef, Department } from './user'

// 질문 유형 (교사 질문함 필터 기준)
export type QuestionCategory = '교과' | '수행평가' | '생활' | '고민'

// 진행 상태: 접수 → 전달됨 → 답변 완료
export type QuestionStatus = 'received' | 'forwarded' | 'answered'

// 육하원칙. null이면 빈칸 (학생이 채움)
export type FiveW1H = {
  who: string | null
  when: string | null
  where: string | null
  what: string | null
  how: string | null
  why: string | null
}

// 답의 근거 자료
export type Source = {
  type: 'notice' | 'approved_answer' | 'schedule'
  title: string
  excerpt: string
}

export type Answer = {
  text: string
  teacherName: string
  sources: Source[]
  answeredAt: string // ISO 날짜
}

// 담당: 교사 개인 질문함 또는 부서 질문함
export type Assignee =
  | { type: 'teacher'; teacherId: string }
  | { type: 'department'; department: Department }

export type Question = {
  id: string
  studentId: string
  isAnonymous: boolean
  // 익명이면 nickname은 null, 학년·반만 보인다
  author: ClassRef & { nickname: string | null }

  originalText: string // 학생이 처음 쓴 질문
  fiveW1H: FiveW1H
  rewrittenText: string // AI가 다시 쓴 (또는 학생이 고친) 최종 질문

  category: QuestionCategory
  status: QuestionStatus
  assignee: Assignee
  forwardReason: string | null // 다른 부서로 넘길 때 남긴 사유

  answer: Answer | null
  createdAt: string // ISO 날짜
}

// 보내기 전 검사 결과
export type ScreenResult =
  | { kind: 'ok' }
  | { kind: 'crisis' } // 고민·위기 신호 → 상담 연결
  | { kind: 'blocked'; reason: string } // 욕설·비방 → 보내지 않음

// AI 답 초안 (교사 질문 상세)
export type AnswerDraft = {
  text: string
  sources: Source[]
}

// 챗봇 답 (근거가 없으면 answer가 null → 선생님께 넘기기 제안)
export type ChatbotReply = {
  answer: string | null
  sources: Source[]
}

export type Notice = {
  id: string
  title: string
  body: string
  target: ClassRef[] // 받는 반
  sentAt: string
}
