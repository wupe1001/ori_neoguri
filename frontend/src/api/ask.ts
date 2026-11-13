import type { FiveW1H, Source } from '../types/question'
import type { PipelineResponse, RouteType, StudentQuestionDetail, Subject } from './backend/types'
import { get, post } from './client'

// 실제 백엔드 질문하기 흐름.
// 질문을 보내면 백엔드 AI가 위기 감지 → 공지로 답하기 → 정보가 충분한지 판단 → 과목 분류를 차례로 하고,
// 그 결과(status)에 따라 다음 단계가 정해진다. 화면은 아래 AskResult만 보고 단계를 바꾼다.

export type AskResult =
  | { kind: 'needs_details'; questionId: number; previous: FiveW1H | null } // 육하원칙 입력
  | { kind: 'confirm'; questionId: number; rewritten: string } // "이렇게 보낼까요?"
  | { kind: 'needs_subject'; questionId: number } // 과목 직접 선택
  | { kind: 'assigned'; questionId: number; routeType: RouteType; subjectName: string | null; message: string | null }
  | { kind: 'notice_answered'; questionId: number; answer: string; sources: Source[] } // 공지로 바로 답함
  | { kind: 'failed'; questionId: number } // AI 처리 실패 → 다시 시도
  | { kind: 'other'; questionId: number } // 그 밖의 상태 (처리 중, 이미 답변됨 등) → 내 질문에서 확인

const getDetail = (id: number) => get<StudentQuestionDetail>(`/api/questions/${id}`)

// 공지 출처는 모양을 아직 확인하지 못해서, 흔한 필드 이름을 차례로 찾아본다
export function toSources(raw: unknown[]): Source[] {
  return raw.map((item) => {
    const s = (item ?? {}) as Record<string, unknown>
    const notice = (s.notice ?? s) as Record<string, unknown>
    const title = String(notice.title ?? s.title ?? '공지')
    const excerpt = String(notice.content ?? notice.body ?? s.excerpt ?? s.content ?? '')
    return { type: 'notice' as const, title, excerpt }
  })
}

async function toResult(res: PipelineResponse): Promise<AskResult> {
  const questionId = res.questionId
  switch (res.status) {
    case 'NEEDS_DETAILS': {
      // 확정한 뒤 다시 보완을 요청받을 수 있어서, 전에 쓴 육하원칙이 있으면 채워 준다
      const { details } = await getDetail(questionId)
      const previous = details
        ? { who: details.who, when: details.when, where: details.where, what: details.what, how: details.how, why: details.why }
        : null
      return { kind: 'needs_details', questionId, previous }
    }
    case 'AWAITING_CONFIRMATION': {
      const rewritten = res.rewrittenContent ?? (await getDetail(questionId)).rewrittenContent ?? ''
      return { kind: 'confirm', questionId, rewritten }
    }
    case 'NEEDS_SUBJECT_SELECTION':
      return { kind: 'needs_subject', questionId }
    case 'ASSIGNED':
      return {
        kind: 'assigned',
        questionId,
        routeType: res.routeType ?? 'SUBJECT',
        subjectName: res.subject?.name ?? null,
        message: res.message ?? null,
      }
    case 'NOTICE_ANSWERED': {
      const { answer } = await getDetail(questionId)
      return {
        kind: 'notice_answered',
        questionId,
        answer: answer?.content ?? '공지에서 답을 찾았어요. 내 질문에서 확인해 주세요.',
        sources: toSources(answer?.sources ?? []),
      }
    }
    case 'PROCESSING_FAILED':
      return { kind: 'failed', questionId }
    default:
      return { kind: 'other', questionId }
  }
}

// POST /api/questions/
export async function submitAsk(content: string) {
  return toResult(await post<PipelineResponse>('/api/questions/', { content }))
}

// POST /api/questions/:id/details (여섯 칸 모두 필수)
export async function submitDetails(questionId: number, f: Record<keyof FiveW1H, string>) {
  return toResult(await post<PipelineResponse>(`/api/questions/${questionId}/details`, f))
}

// POST /api/questions/:id/confirmation
export async function confirmAsk(questionId: number, content: string) {
  return toResult(await post<PipelineResponse>(`/api/questions/${questionId}/confirmation`, { content }))
}

// POST /api/questions/:id/subject
export async function chooseSubject(questionId: number, subjectId: number) {
  return toResult(await post<PipelineResponse>(`/api/questions/${questionId}/subject`, { subjectId }))
}

// POST /api/questions/:id/retry
export async function retryAsk(questionId: number) {
  return toResult(await post<PipelineResponse>(`/api/questions/${questionId}/retry`))
}

// GET /api/subjects/
export async function getSubjects(): Promise<Subject[]> {
  return (await get<{ items: Subject[] }>('/api/subjects/')).items
}
