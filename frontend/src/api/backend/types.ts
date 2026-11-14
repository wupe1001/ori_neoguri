// 실제 백엔드 응답 모양 (2026-11-13 테스트 서버 + 백엔드 코드 c963c89에서 확인한 값 기준)
// 화면에서는 이 타입을 직접 쓰지 않고, api 함수에서 프론트 타입(types/question.ts)으로 바꿔서 쓴다.

export type BackendQuestionStatus =
  | 'PROCESSING'
  // 질문 개선 4단계: 막힌 곳 찾기 → 구체화하기 → 질문 틀 보여주기 → 학생이 고르고 고치기
  | 'GENERATING_IMPROVEMENT_STAGE_1'
  | 'AWAITING_IMPROVEMENT_STAGE_1' // 1단계: 어디서 막혔는지 답해야 함
  | 'GENERATING_IMPROVEMENT_STAGE_2'
  | 'AWAITING_IMPROVEMENT_STAGE_2' // 2단계: 실제 사례를 답해야 함
  | 'GENERATING_IMPROVEMENT_STAGE_3'
  | 'GENERATING_FINAL_QUESTION_SUGGESTION' // 건너뛰기: AI가 최종 질문 추천을 만드는 중
  | 'AWAITING_FINAL_QUESTION' // 3단계(또는 건너뛰기): 최종 질문을 확정해야 함
  | 'NEEDS_SUBJECT_SELECTION' // 과목을 학생이 직접 골라야 함
  | 'ASSIGNED' // 선생님께 배정됨
  | 'ANSWERED' // 선생님 답변 완료
  | 'NOTICE_ANSWERED' // 공지로 AI가 답함
  | 'PROCESSING_FAILED' // AI 처리 실패 → 재시도 가능

export type RouteType = 'SUBJECT' | 'HOMEROOM' // 과목 선생님 / 담임 (고민·위기 신호 포함)

export type Subject = { id: number; name: string }

// GET /api/subjects/:subjectId/units → { items: Unit[] }. 이름은 "공통수학1 - 다항식"처럼 온다
export type Unit = { id: number; name: string }

export type Paginated<T> = {
  items: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// 3단계 질문 후보
export type Candidate = {
  id: string // 예: "candidate_6"
  question: string
  type: string // 예: "비교/선택 기준 질문"
  bloomLevel: string // 예: "이해", "적용"
}

// POST /api/questions/, /improvement/stage-1, /stage-2, /final, /subject, /retry 의 응답.
// status에 따라 함께 오는 값이 다르다.
export type PipelineResponse = {
  questionId: number
  status: BackendQuestionStatus
  prompt?: string // AWAITING_IMPROVEMENT_STAGE_1·2, AWAITING_FINAL_QUESTION: AI가 학생에게 하는 말
  exampleAnswers?: string[] // AWAITING_IMPROVEMENT_STAGE_1: 예시 답변
  candidates?: Candidate[] // AWAITING_FINAL_QUESTION: 질문 후보
  suggestedQuestion?: string // 건너뛰기(final-suggestion): AI가 추천한 최종 질문 하나
  subjects?: Subject[] // NEEDS_SUBJECT_SELECTION
  routeType?: RouteType // ASSIGNED
  subject?: Subject | null // ASSIGNED (과목 배정)
  message?: string // ASSIGNED + HOMEROOM (위기 신호 안내 문구)
  answer?: { content: string; sources: AnswerSource[] } // NOTICE_ANSWERED
}

// 공지로 답했을 때 근거 공지
export type AnswerSource = { id: number; title: string }

// 질문 개선 기록 (학생·교사 상세에 함께 온다)
export type BackendImprovement = {
  stage1: { prompt: string | null; exampleAnswers: string[]; studentAnswer: string | null } // 막힌 곳
  stage2: { prompt: string | null; studentAnswer: string | null } // 실제 사례
  stage3: { prompt: string | null; candidates: Candidate[] } // 질문 후보
  // suggestedQuestion: 건너뛰기로 AI가 추천한 질문 / finalQuestion: 학생이 확정한 최종 질문
  stage4: { suggestedQuestion?: string | null; finalQuestion: string | null }
}

// 첨부파일 정보. 내용은 downloadUrl(GET /api/files/:id)로 받는다
export type BackendAttachment = {
  id: number
  originalName: string
  mimeType: string
  sizeBytes: number
  downloadUrl: string
}

export type BackendAnswer = {
  id: number
  authorType: string // 'TEACHER' 또는 'AI_NOTICE'
  teacherId: number | null
  content: string
  studentReadAt: string | null
  createdAt: string
  sources: AnswerSource[] // 공지로 답했을 때 근거 공지
  attachments?: BackendAttachment[]
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
  attachmentCount?: number
}

// GET /api/questions/:id (학생 상세)
export type StudentQuestionDetail = {
  id: number
  originalContent: string
  finalContent: string
  status: BackendQuestionStatus
  routeType: RouteType | null
  subject: Subject | null
  failedStage: string | null
  retryStatus: string | null
  createdAt: string
  updatedAt: string
  attachments?: BackendAttachment[]
  improvement: BackendImprovement | null
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
  attachmentCount?: number
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
  attachments?: BackendAttachment[]
  improvement: BackendImprovement | null
}

// POST /api/teacher/questions/:id/answer
export type AnswerCreated = { id: number; questionId: number; content: string; createdAt: string }

// GET /api/notices/ (목록에는 내용이 없다)
export type NoticeItem = { id: number; title: string; authorId: number; createdAt: string }

// GET /api/notices/:id, POST /api/notices/
export type NoticeDetail = NoticeItem & { content: string }

// POST /api/auth/login
export type LoginResponse = { userId: number; role: 'STUDENT' | 'TEACHER'; nickname: string }
