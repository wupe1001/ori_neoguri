import type { Answer, Attachment, ImprovementTrail, Question, QuestionCategory, QuestionStatus } from '../../types/question'
import { toSources } from '../ask'
import type {
  BackendAnswer,
  BackendAttachment,
  BackendImprovement,
  BackendQuestionStatus,
  RouteType,
  StudentQuestionDetail,
  StudentQuestionItem,
  TeacherQuestionDetail,
  TeacherQuestionItem,
} from './types'

// 백엔드 응답 → 프론트 Question 타입으로 바꾼다.
// 화면은 목업과 같은 Question만 보므로, 백엔드 모양이 바뀌면 이 파일만 고치면 된다.

// 백엔드 상태 9가지 → 화면 상태 3가지 (접수 → 전달됨 → 답변 완료)
// 학생에게 배정(ASSIGNED)은 "선생님께 전달됨", 교사에게는 "답할 질문(접수)"이다.
function toStatus(s: BackendQuestionStatus, viewer: 'student' | 'teacher'): QuestionStatus {
  if (s === 'ANSWERED' || s === 'NOTICE_ANSWERED') return 'answered'
  if (s === 'ASSIGNED') return viewer === 'student' ? 'forwarded' : 'received'
  return 'received'
}

// 학생 질문이 아직 선생님께 가지 않은 상태면 안내 문구
function toNote(s: BackendQuestionStatus): string | null {
  switch (s) {
    case 'PROCESSING':
    case 'GENERATING_IMPROVEMENT_STAGE_1':
    case 'GENERATING_IMPROVEMENT_STAGE_2':
    case 'GENERATING_IMPROVEMENT_STAGE_3':
    case 'GENERATING_FINAL_QUESTION_SUGGESTION':
      return 'AI가 질문을 처리하고 있어요'
    case 'AWAITING_IMPROVEMENT_STAGE_1':
      return '어디서 막혔는지 알려 줘야 선생님께 보낼 수 있어요'
    case 'AWAITING_IMPROVEMENT_STAGE_2':
      return '헷갈렸던 실제 예시를 알려 줘야 선생님께 보낼 수 있어요'
    case 'AWAITING_FINAL_QUESTION':
      return '질문 후보 중 하나를 골라 확정해야 선생님께 보낼 수 있어요'
    case 'NEEDS_SUBJECT_SELECTION':
      return '과목을 골라 줘야 선생님께 보낼 수 있어요'
    case 'PROCESSING_FAILED':
      return 'AI 처리에 실패했어요. 다시 시도해 주세요'
    default:
      return null
  }
}

// 학생이 이어서 해야 하는 상태 (내 질문에서 [이어서 하기])
const RESUMABLE = new Set<BackendQuestionStatus>([
  'AWAITING_IMPROVEMENT_STAGE_1',
  'AWAITING_IMPROVEMENT_STAGE_2',
  'AWAITING_FINAL_QUESTION',
  'NEEDS_SUBJECT_SELECTION',
  'PROCESSING_FAILED',
])

// 백엔드는 위기 감지에 걸린 질문만 담임에게 보낸다 (question-pipeline.js의 assignHomeroom).
// 그래서 routeType이 HOMEROOM이면 고민·위기 질문으로 본다.
const isCrisis = (r: RouteType | null) => r === 'HOMEROOM'

// 과목 질문함 → 교과, 담임 질문함 → 고민, 아직 배정 전 → 생활
const toCategory = (r: RouteType | null): QuestionCategory => (r === 'SUBJECT' ? '교과' : r === 'HOMEROOM' ? '고민' : '생활')

// 질문 개선 기록 → 막힌 곳 · 실제 사례 · 최종 질문
const toTrail = (i: BackendImprovement | null): ImprovementTrail | null =>
  i && (i.stage1.studentAnswer || i.stage4.finalQuestion)
    ? {
        stuckPrompt: i.stage1.prompt,
        stuck: i.stage1.studentAnswer,
        examplePrompt: i.stage2.prompt,
        example: i.stage2.studentAnswer,
        finalQuestion: i.stage4.finalQuestion,
      }
    : null

const toAttachments = (list: BackendAttachment[] | undefined): Attachment[] =>
  (list ?? []).map((f) => ({
    id: String(f.id),
    name: f.originalName,
    mimeType: f.mimeType,
    size: f.sizeBytes,
    url: f.downloadUrl,
  }))

function toAnswer(a: BackendAnswer | null, status: BackendQuestionStatus): Answer | null {
  if (!a) return null
  return {
    text: a.content,
    teacherName: '', // 백엔드가 교사 이름을 주지 않는다
    sources: toSources(a.sources ?? []),
    answeredAt: a.createdAt,
    recipients: 1,
    byAi: status === 'NOTICE_ANSWERED' || a.authorType !== 'TEACHER',
    attachments: toAttachments(a.attachments),
  }
}

// 공통 뼈대. 백엔드는 학생 이름·학년·반을 주지 않는다.
function base(id: number, studentId: string, nickname: string | null, createdAt: string): Question {
  return {
    id: String(id),
    studentId,
    isAnonymous: false,
    author: { grade: 0, classNo: 0, nickname },
    originalText: '',
    rewrittenText: '',
    category: '생활',
    status: 'received',
    assignee: { type: 'teacher', teacherId: '' },
    forwardReason: null,
    answer: null,
    createdAt,
  }
}

// GET /api/questions/ (학생 목록). 목록에는 답 내용이 없다.
export function fromStudentItem(q: StudentQuestionItem, studentId: string): Question {
  return {
    ...base(q.id, studentId, null, q.createdAt),
    originalText: q.content,
    rewrittenText: q.content,
    category: toCategory(q.routeType),
    crisis: isCrisis(q.routeType),
    noticeAnswered: q.status === 'NOTICE_ANSWERED',
    status: toStatus(q.status, 'student'),
    subjectName: q.subject?.name ?? null,
    note: toNote(q.status),
    resumable: RESUMABLE.has(q.status),
    attachmentCount: q.attachmentCount ?? 0,
  }
}

// GET /api/questions/:id (학생 상세)
export function fromStudentDetail(q: StudentQuestionDetail, studentId: string): Question {
  return {
    ...base(q.id, studentId, null, q.createdAt),
    originalText: q.originalContent,
    rewrittenText: q.finalContent,
    improvement: toTrail(q.improvement),
    category: toCategory(q.routeType),
    crisis: isCrisis(q.routeType),
    noticeAnswered: q.status === 'NOTICE_ANSWERED',
    status: toStatus(q.status, 'student'),
    answer: toAnswer(q.answer, q.status),
    attachments: toAttachments(q.attachments),
    subjectName: q.subject?.name ?? null,
    note: toNote(q.status),
    resumable: RESUMABLE.has(q.status),
  }
}

// GET /api/teacher/questions/ (교사 목록)
export function fromTeacherItem(q: TeacherQuestionItem): Question {
  return {
    ...base(q.id, String(q.studentId), `학생 #${q.studentId}`, q.createdAt),
    originalText: q.content,
    rewrittenText: q.content,
    category: toCategory(q.routeType),
    crisis: isCrisis(q.routeType),
    noticeAnswered: q.status === 'NOTICE_ANSWERED',
    status: toStatus(q.status, 'teacher'),
    subjectName: q.subject?.name ?? null,
    unread: q.teacherReadAt === null,
    attachmentCount: q.attachmentCount ?? 0,
  }
}

// GET /api/teacher/questions/:id (교사 상세). 보낸 답 내용은 오지 않는다.
export function fromTeacherDetail(q: TeacherQuestionDetail): Question {
  return {
    ...base(q.id, String(q.studentId), `학생 #${q.studentId}`, q.createdAt),
    originalText: q.originalContent,
    rewrittenText: q.finalContent,
    improvement: toTrail(q.improvement),
    category: toCategory(q.routeType),
    crisis: isCrisis(q.routeType),
    noticeAnswered: q.status === 'NOTICE_ANSWERED',
    status: toStatus(q.status, 'teacher'),
    subjectName: q.subject?.name ?? null,
    attachments: toAttachments(q.attachments),
  }
}
