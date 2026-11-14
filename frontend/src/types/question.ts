import type { ClassRef, Department } from './user'

// 질문 유형 (교사 질문함 필터 기준)
export type QuestionCategory = '교과' | '수행평가' | '생활' | '고민'

// 진행 상태: 접수 → 전달됨 → 답변 완료
export type QuestionStatus = 'received' | 'forwarded' | 'answered'

// 답의 근거 자료
export type Source = {
  type: 'notice' | 'approved_answer' | 'schedule' | 'material'
  title: string
  excerpt: string
}

// 첨부파일 (사진 등). url은 로그인한 상태에서만 열린다
export type Attachment = {
  id: string
  name: string
  mimeType: string
  size: number // 바이트
  url: string
}

export type Answer = {
  text: string
  teacherName: string
  sources: Source[]
  answeredAt: string // ISO 날짜
  // 같은 답을 함께 받은 질문 수 (이 질문 포함). 1이면 혼자 받은 답
  recipients: number
  // 공지를 근거로 AI가 답했으면 true (실제 백엔드의 NOTICE_ANSWERED)
  byAi?: boolean
  attachments?: Attachment[] // 선생님이 답에 붙인 파일
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
  rewrittenText: string // 학생이 다듬어서 확정한 최종 질문
  improvement?: ImprovementTrail | null // 질문 개선 과정 (개선을 거친 질문만)

  category: QuestionCategory
  status: QuestionStatus
  assignee: Assignee
  forwardReason: string | null // 다른 부서로 넘길 때 남긴 사유

  answer: Answer | null
  createdAt: string // ISO 날짜
  attachments?: Attachment[] // 학생이 질문에 붙인 사진
  attachmentCount?: number // 목록에서는 개수만 온다

  // ─ 실제 백엔드에서만 오는 정보 ─
  subjectName?: string | null // 배정된 과목 (예: 수학)
  note?: string | null // 진행 안내 (예: "정보 보완이 필요해요")
  unread?: boolean // 교사가 아직 열어보지 않은 질문
  resumable?: boolean // 학생이 홈 채팅에서 이어서 해야 하는 질문 (육하원칙·확인·과목 선택·재시도)
  crisis?: boolean // 고민·위기 신호로 담임 선생님께 바로 간 질문 (백엔드 routeType이 HOMEROOM)
  noticeAnswered?: boolean // 선생님 대신 AI가 공지로 바로 답한 질문 (선생님 대화에는 넣지 않는다)
}

// 질문 개선 과정 기록: 막힌 곳 → 실제 사례 → 최종 질문 (선생님이 학생의 생각을 볼 수 있다)
export type ImprovementTrail = {
  stuckPrompt: string | null // AI: 어디서 막혔나요?
  stuck: string | null // 학생 답
  examplePrompt: string | null // AI: 실제 사례를 알려 주세요
  example: string | null // 학생 답
  finalQuestion: string | null // 학생이 후보를 보고 고친 최종 질문
}

// 3단계 질문 후보
export type QuestionCandidate = {
  id: string
  question: string
  type: string // 질문 유형 (예: 비교/선택 기준 질문)
  level: string // 블룸 단계 (예: 이해, 적용)
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
  senderName: string // 보낸 교사 또는 부서
  target: ClassRef[] // 받는 반
  sentAt: string
}

// 위기 신호 → 담임·상담 선생님께 바로 가는 연결 요청 (질문함·AI 답을 거치지 않는다)
export type CrisisAlert = {
  id: string
  studentId: string
  // 학생이 이름을 알리지 않기로 했으면 nickname은 null
  author: ClassRef & { nickname: string | null }
  text: string // 학생이 쓴 내용 (홈에서 바로 요청했으면 빈 문자열)
  handled: boolean // 교사가 확인했는지
  createdAt: string
}

// 교사가 올린 수업 자료·루브릭 (답 근거 저장소)
export type Material = {
  id: string
  title: string
  body: string
  teacherName: string
  createdAt: string
}
