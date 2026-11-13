// 실제 백엔드 응답 모양 (2026-11-13 테스트 서버에서 직접 확인한 값 기준)
// 화면에서는 이 타입을 직접 쓰지 않고, api 함수에서 프론트 타입(types/question.ts)으로 바꿔서 쓴다.

export type BackendQuestionStatus =
  | 'PROCESSING'
  | 'NEEDS_DETAILS' // 육하원칙 보완 필요
  | 'REWRITING'
  | 'AWAITING_CONFIRMATION' // AI가 다시 쓴 질문 확인 대기
  | 'NEEDS_SUBJECT_SELECTION' // 과목을 학생이 직접 골라야 함
  | 'ASSIGNED' // 선생님께 배정됨
  | 'ANSWERED' // 선생님 답변 완료
  | 'NOTICE_ANSWERED' // 공지로 AI가 답함
  | 'PROCESSING_FAILED' // AI 처리 실패 → 재시도 가능

export type RouteType = 'SUBJECT' | 'HOMEROOM' // 과목 선생님 / 담임 (고민·위기 신호 포함)

export type Subject = { id: number; name: string }

export type Paginated<T> = {
  items: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// POST /api/questions/, /details, /confirmation, /subject, /retry 의 응답.
// status에 따라 함께 오는 값이 다르다.
export type PipelineResponse = {
  questionId: number
  status: BackendQuestionStatus
  requiredFields?: string[] // NEEDS_DETAILS
  rewrittenContent?: string // AWAITING_CONFIRMATION
  routeType?: RouteType // ASSIGNED
  subject?: Subject | null // ASSIGNED (과목 배정)
  message?: string // ASSIGNED + HOMEROOM (위기 신호 안내 문구)
  answer?: { content: string; sources: AnswerSource[] } // NOTICE_ANSWERED
}

// 공지로 답했을 때 근거 공지
export type AnswerSource = { id: number; title: string }

export type BackendDetails = {
  who: string
  when: string
  where: string
  what: string
  how: string
  why: string
  createdAt: string
}

export type BackendAnswer = {
  id: number
  authorType: string // 'TEACHER' 또는 'AI_NOTICE'
  teacherId: number | null
  content: string
  studentReadAt: string | null
  createdAt: string
  sources: AnswerSource[] // 공지로 답했을 때 근거 공지
}

// GET /api/questions/ (학생 목록)
export type StudentQuestionItem = {
  id: number
  content: string
  status: BackendQuestionStatus
  routeType: RouteType | null
  subject: Subject | null
  createdAt: string
  hasAnswer: boolean
}

// GET /api/questions/:id (학생 상세)
export type StudentQuestionDetail = {
  id: number
  originalContent: string
  finalContent: string
  rewrittenContent: string | null
  status: BackendQuestionStatus
  routeType: RouteType | null
  subject: Subject | null
  failedStage: string | null
  retryStatus: string | null
  createdAt: string
  updatedAt: string
  details: BackendDetails | null
  answer: BackendAnswer | null
}

// GET /api/teacher/questions/ (교사 목록)
export type TeacherQuestionItem = {
  id: number
  content: string
  status: BackendQuestionStatus
  routeType: RouteType
  teacherReadAt: string | null
  createdAt: string
  studentId: number
  subject: Subject | null
}

// GET /api/teacher/questions/:id (교사 상세). 답변 내용은 오지 않는다.
export type TeacherQuestionDetail = {
  id: number
  studentId: number
  originalContent: string
  finalContent: string
  status: BackendQuestionStatus
  routeType: RouteType
  subject: Subject | null
  teacherReadAt: string | null
  createdAt: string
  updatedAt: string
  details: BackendDetails | null
}

// POST /api/teacher/questions/:id/answer
export type AnswerCreated = { id: number; questionId: number; content: string; createdAt: string }

// GET /api/notices/ (목록에는 내용이 없다)
export type NoticeItem = { id: number; title: string; authorId: number; createdAt: string }

// GET /api/notices/:id, POST /api/notices/
export type NoticeDetail = NoticeItem & { content: string }
