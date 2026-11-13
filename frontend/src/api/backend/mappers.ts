import type { Answer, FiveW1H, Question, QuestionCategory, QuestionStatus } from '../../types/question'
import { toSources } from '../ask'
import type {
  BackendAnswer,
  BackendDetails,
  BackendQuestionStatus,
  RouteType,
  StudentQuestionDetail,
  StudentQuestionItem,
  TeacherQuestionDetail,
  TeacherQuestionItem,
} from './types'

// 백엔드 응답 → 프론트 Question 타입으로 바꾼다.
// 화면은 목업과 같은 Question만 보므로, 백엔드 모양이 바뀌면 이 파일만 고치면 된다.

const EMPTY: FiveW1H = { who: null, when: null, where: null, what: null, how: null, why: null }

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
    case 'REWRITING':
      return 'AI가 질문을 처리하고 있어요'
    case 'NEEDS_DETAILS':
      return '정보 보완이 필요해요 · 홈에서 다시 질문해 주세요'
    case 'AWAITING_CONFIRMATION':
      return '보낼 질문을 확인하지 않았어요 · 홈에서 다시 질문해 주세요'
    case 'NEEDS_SUBJECT_SELECTION':
      return '과목을 고르지 않았어요 · 홈에서 다시 질문해 주세요'
    case 'PROCESSING_FAILED':
      return 'AI 처리에 실패했어요 · 홈에서 다시 질문해 주세요'
    default:
      return null
  }
}

// 과목 질문함 → 교과, 담임 질문함(고민·위기 포함) → 생활
const toCategory = (r: RouteType | null): QuestionCategory => (r === 'SUBJECT' ? '교과' : '생활')

const toFiveW1H = (d: BackendDetails | null): FiveW1H =>
  d ? { who: d.who, when: d.when, where: d.where, what: d.what, how: d.how, why: d.why } : EMPTY

function toAnswer(a: BackendAnswer | null, status: BackendQuestionStatus): Answer | null {
  if (!a) return null
  return {
    text: a.content,
    teacherName: '', // 백엔드가 교사 이름을 주지 않는다
    sources: toSources(a.sources ?? []),
    answeredAt: a.createdAt,
    recipients: 1,
    byAi: status === 'NOTICE_ANSWERED' || a.authorType !== 'TEACHER',
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
    fiveW1H: EMPTY,
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
    status: toStatus(q.status, 'student'),
    subjectName: q.subject?.name ?? null,
    note: toNote(q.status),
  }
}

// GET /api/questions/:id (학생 상세)
export function fromStudentDetail(q: StudentQuestionDetail, studentId: string): Question {
  return {
    ...base(q.id, studentId, null, q.createdAt),
    originalText: q.originalContent,
    rewrittenText: q.finalContent,
    fiveW1H: toFiveW1H(q.details),
    category: toCategory(q.routeType),
    status: toStatus(q.status, 'student'),
    answer: toAnswer(q.answer, q.status),
    subjectName: q.subject?.name ?? null,
    note: toNote(q.status),
  }
}

// GET /api/teacher/questions/ (교사 목록)
export function fromTeacherItem(q: TeacherQuestionItem): Question {
  return {
    ...base(q.id, String(q.studentId), `학생 #${q.studentId}`, q.createdAt),
    originalText: q.content,
    rewrittenText: q.content,
    category: toCategory(q.routeType),
    status: toStatus(q.status, 'teacher'),
    subjectName: q.subject?.name ?? null,
    unread: q.teacherReadAt === null,
  }
}

// GET /api/teacher/questions/:id (교사 상세). 보낸 답 내용은 오지 않는다.
export function fromTeacherDetail(q: TeacherQuestionDetail): Question {
  return {
    ...base(q.id, String(q.studentId), `학생 #${q.studentId}`, q.createdAt),
    originalText: q.originalContent,
    rewrittenText: q.finalContent,
    fiveW1H: toFiveW1H(q.details),
    category: toCategory(q.routeType),
    status: toStatus(q.status, 'teacher'),
    subjectName: q.subject?.name ?? null,
  }
}
