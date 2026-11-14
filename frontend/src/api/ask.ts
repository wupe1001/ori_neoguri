import type { QuestionCandidate, Source } from '../types/question'
import type { AskEngine, AskResult } from './askEngine'
import type { Candidate, PipelineResponse, StudentQuestionDetail, Subject } from './backend/types'
import { ApiError, formData, get, post } from './client'

// 실제 백엔드 질문하기 엔진.
// 질문을 보내면 백엔드 AI가 위기 감지 → 공지로 답하기 → 정보가 충분한지 판단 → 과목 분류를 차례로 한다.
// 정보가 부족하면 질문 개선 4단계(막힌 곳 → 실제 사례 → 질문 후보 → 최종 질문)로 다듬은 뒤 다시 분류한다.

const getDetail = (id: string) => get<StudentQuestionDetail>(`/api/questions/${id}`)

// 근거 공지 → 출처 목록. 백엔드는 { id, title }만 준다 (내용이 오면 함께 쓴다)
export function toSources(raw: unknown[]): Source[] {
  return raw.map((item) => {
    const s = (item ?? {}) as Record<string, unknown>
    const notice = (s.notice ?? s) as Record<string, unknown>
    const title = String(notice.title ?? s.title ?? '공지')
    const excerpt = String(notice.content ?? notice.body ?? s.excerpt ?? s.content ?? '')
    return { type: 'notice' as const, title, excerpt }
  })
}

export const toCandidates = (list: Candidate[] = []): QuestionCandidate[] =>
  list.map((c) => ({ id: c.id, question: c.question, type: c.type, level: c.bloomLevel }))

async function toResult(res: PipelineResponse): Promise<AskResult> {
  const questionId = String(res.questionId)
  switch (res.status) {
    case 'AWAITING_IMPROVEMENT_STAGE_1':
      return { kind: 'stuck', questionId, prompt: res.prompt ?? '어떤 부분에서 막혔나요?', examples: res.exampleAnswers ?? [] }
    case 'AWAITING_IMPROVEMENT_STAGE_2':
      return { kind: 'example', questionId, prompt: res.prompt ?? '실제로 헷갈렸던 문장이나 문제를 알려 주세요.' }
    case 'AWAITING_FINAL_QUESTION':
      // 건너뛰기 응답이면 추천 질문 하나, 아니면 3단계 후보 목록
      if (res.suggestedQuestion) return { kind: 'suggested', questionId, suggestion: res.suggestedQuestion }
      return {
        kind: 'pick',
        questionId,
        prompt: res.prompt ?? '마음에 드는 질문을 골라 고쳐 보세요.',
        candidates: toCandidates(res.candidates),
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
      // 응답에 답이 바로 오지만, 없으면 상세에서 가져온다
      const answer = res.answer ?? (await getDetail(questionId)).answer
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

// AI 처리가 실패하면(503) 백엔드는 질문을 PROCESSING_FAILED로 저장하고 에러에 questionId를 담아 준다.
// 다시 시도할 수 있는 실패면 에러 대신 'failed' 결과로 바꿔서 채팅에 [다시 시도하기]를 보여준다.
async function call(path: string, body?: unknown): Promise<AskResult> {
  try {
    return await toResult(await post<PipelineResponse>(path, body))
  } catch (err) {
    const questionId = err instanceof ApiError ? err.details.questionId : undefined
    if (err instanceof ApiError && err.status === 503 && questionId != null && err.details.retryable !== false) {
      return { kind: 'failed', questionId: String(questionId) }
    }
    throw err
  }
}

// 멈춘 질문의 현재 상태 → 이어서 할 단계 (GET /api/questions/:id)
async function resume(questionId: string): Promise<{ question: string; result: AskResult }> {
  const d = await getDetail(questionId)
  const question = d.originalContent
  const imp = d.improvement
  switch (d.status) {
    case 'AWAITING_IMPROVEMENT_STAGE_1':
      return {
        question,
        result: { kind: 'stuck', questionId, prompt: imp?.stage1.prompt ?? '어떤 부분에서 막혔나요?', examples: imp?.stage1.exampleAnswers ?? [] },
      }
    case 'AWAITING_IMPROVEMENT_STAGE_2':
      return {
        question,
        result: { kind: 'example', questionId, prompt: imp?.stage2.prompt ?? '실제로 헷갈렸던 문장이나 문제를 알려 주세요.' },
      }
    case 'AWAITING_FINAL_QUESTION':
      // 건너뛰기로 왔으면 후보 없이 추천 질문만 있다
      if (imp?.stage4.suggestedQuestion && !imp.stage3.candidates.length) {
        return { question, result: { kind: 'suggested', questionId, suggestion: imp.stage4.suggestedQuestion } }
      }
      return {
        question,
        result: {
          kind: 'pick',
          questionId,
          prompt: imp?.stage3.prompt ?? '마음에 드는 질문을 골라 고쳐 보세요.',
          candidates: toCandidates(imp?.stage3.candidates),
        },
      }
    case 'NEEDS_SUBJECT_SELECTION':
      return { question, result: { kind: 'needs_subject', questionId } }
    case 'PROCESSING_FAILED':
      return { question, result: { kind: 'failed', questionId } }
    default:
      return { question, result: { kind: 'other', questionId } }
  }
}

export const backendAskEngine: AskEngine = {
  supportsAnonymous: false,

  // POST /api/questions/ (multipart/form-data: content, files[])
  submit: (text, _isAnonymous, files = []) => call('/api/questions/', formData({ content: text }, files)),

  // POST /api/questions/:id/improvement/stage-1 (막힌 곳)
  answerStuck: (id, answer) => call(`/api/questions/${id}/improvement/stage-1`, { answer }),

  // POST /api/questions/:id/improvement/stage-2 (실제 사례)
  answerExample: (id, answer) => call(`/api/questions/${id}/improvement/stage-2`, { answer }),

  // POST /api/questions/:id/improvement/final-suggestion (남은 단계 건너뛰기 → 추천 질문 하나)
  skipToFinal: (id) => call(`/api/questions/${id}/improvement/final-suggestion`),

  // POST /api/questions/:id/improvement/final (최종 질문 확정 → 과목 분류·배정)
  finalize: (id, content) => call(`/api/questions/${id}/improvement/final`, { content }),

  // POST /api/questions/:id/subject
  chooseSubject: (id, subjectId) => call(`/api/questions/${id}/subject`, { subjectId }),

  // POST /api/questions/:id/retry (실패한 단계부터 다시)
  retry: (id) => call(`/api/questions/${id}/retry`),

  resume,

  // GET /api/subjects/
  getSubjects: async () => (await get<{ items: Subject[] }>('/api/subjects/')).items,
}
