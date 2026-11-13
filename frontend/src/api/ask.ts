import type { FiveW1H, Source } from '../types/question'
import type { AskEngine, AskResult } from './askEngine'
import type { PipelineResponse, StudentQuestionDetail, Subject } from './backend/types'
import { get, post } from './client'

// 실제 백엔드 질문하기 엔진.
// 질문을 보내면 백엔드 AI가 위기 감지 → 공지로 답하기 → 정보가 충분한지 판단 → 과목 분류를 차례로 하고,
// 그 결과(status)에 따라 다음 단계가 정해진다.

const getDetail = (id: string) => get<StudentQuestionDetail>(`/api/questions/${id}`)

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

const EMPTY: FiveW1H = { who: null, when: null, where: null, what: null, how: null, why: null }

async function toResult(res: PipelineResponse): Promise<AskResult> {
  const questionId = String(res.questionId)
  switch (res.status) {
    case 'NEEDS_DETAILS': {
      // 확정한 뒤 다시 보완을 요청받을 수 있어서, 전에 쓴 육하원칙이 있으면 채워 준다
      const { details } = await getDetail(questionId)
      if (!details) return { kind: 'needs_details', questionId, prefill: EMPTY, askedAgain: false }
      const { who, when, where, what, how, why } = details
      return { kind: 'needs_details', questionId, prefill: { who, when, where, what, how, why }, askedAgain: true }
    }
    case 'AWAITING_CONFIRMATION': {
      const rewritten = res.rewrittenContent ?? (await getDetail(questionId)).rewrittenContent ?? ''
      return { kind: 'confirm', questionId, rewritten }
    }
    case 'NEEDS_SUBJECT_SELECTION':
      return { kind: 'needs_subject', questionId }
    case 'ASSIGNED': {
      const homeroom = res.routeType === 'HOMEROOM'
      return {
        kind: 'assigned',
        questionId,
        toLabel: homeroom ? '담임 선생님' : `${res.subject?.name ?? '담당'} 선생님`,
        crisisMessage: homeroom ? (res.message ?? null) : null,
      }
    }
    case 'NOTICE_ANSWERED': {
      const { answer } = await getDetail(questionId)
      return {
        kind: 'notice_answered',
        questionId,
        answer: answer?.content ?? '공지에서 답을 찾았어요. 내 질문에서 확인해 주세요.',
        sources: toSources(answer?.sources ?? []),
        canEscalate: false, // 백엔드에 공지 답 이후 선생님께 넘기는 API가 없다
      }
    }
    case 'PROCESSING_FAILED':
      return { kind: 'failed', questionId }
    default:
      return { kind: 'other', questionId }
  }
}

const call = async (path: string, body?: unknown) => toResult(await post<PipelineResponse>(path, body))

export const backendAskEngine: AskEngine = {
  requireAllDetails: true,
  supportsAnonymous: false,

  // POST /api/questions/
  submit: (text) => call('/api/questions/', { content: text }),

  // POST /api/questions/:id/details (여섯 칸 모두 필수)
  details: (id, f) =>
    call(`/api/questions/${id}/details`, {
      who: f.who?.trim() ?? '',
      when: f.when?.trim() ?? '',
      where: f.where?.trim() ?? '',
      what: f.what?.trim() ?? '',
      how: f.how?.trim() ?? '',
      why: f.why?.trim() ?? '',
    }),

  // POST /api/questions/:id/confirmation
  confirm: (id, content) => call(`/api/questions/${id}/confirmation`, { content }),

  // POST /api/questions/:id/subject
  chooseSubject: (id, subjectId) => call(`/api/questions/${id}/subject`, { subjectId }),

  // POST /api/questions/:id/retry
  retry: (id) => call(`/api/questions/${id}/retry`),

  // GET /api/subjects/
  getSubjects: async () => (await get<{ items: Subject[] }>('/api/subjects/')).items,
}
