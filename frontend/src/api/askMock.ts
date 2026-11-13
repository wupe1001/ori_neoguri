import type { FiveW1H } from '../types/question'
import type { Student } from '../types/user'
import { askChatbot, refineQuestion, rewriteQuestion, screenQuestion } from './ai'
import type { AskEngine, AskResult } from './askEngine'
import { newId } from './mock/db'
import { submitQuestion } from './questions'

// 목업 질문하기 엔진: 실제 백엔드와 같은 흐름을 브라우저 안에서 흉내 낸다.
// 검사(위기·욕설) → 공지·승인된 답으로 답 → 없으면 육하원칙 정리 → 다시 쓰기 → 담임 선생님께 전송
export function createMockAskEngine(student: Student): AskEngine {
  // 보내기 전 질문은 이 탭의 메모리에만 둔다
  const drafts = new Map<string, { text: string; isAnonymous: boolean; fiveW1H: FiveW1H | null }>()

  const draft = (id: string) => {
    const d = drafts.get(id)
    if (!d) throw new Error('질문 정보가 없어요. 처음부터 다시 보내 주세요.')
    return d
  }

  const refine = async (id: string): Promise<AskResult> => {
    const d = draft(id)
    const prefill = await refineQuestion(d.text, student, d.isAnonymous)
    return { kind: 'needs_details', questionId: id, prefill, askedAgain: false }
  }

  return {
    requireAllDetails: false,
    supportsAnonymous: true,

    submit: async (text, isAnonymous) => {
      const screen = await screenQuestion(text)
      if (screen.kind === 'crisis') return { kind: 'crisis', text }
      if (screen.kind === 'blocked') return { kind: 'blocked', reason: screen.reason }

      const id = newId('draft')
      drafts.set(id, { text, isAnonymous, fiveW1H: null })
      const reply = await askChatbot(text)
      if (reply.answer) {
        return { kind: 'notice_answered', questionId: id, answer: reply.answer, sources: reply.sources, canEscalate: true }
      }
      return refine(id)
    },

    escalate: refine,

    details: async (id, f) => {
      const d = draft(id)
      d.fiveW1H = f
      return { kind: 'confirm', questionId: id, rewritten: await rewriteQuestion(d.text, f) }
    },

    confirm: async (id, content) => {
      const d = draft(id)
      const question = await submitQuestion({
        student,
        isAnonymous: d.isAnonymous,
        originalText: d.text,
        fiveW1H: d.fiveW1H ?? { who: null, when: null, where: null, what: null, how: null, why: null },
        rewrittenText: content,
      })
      drafts.delete(id)
      return { kind: 'assigned', questionId: question.id, toLabel: '담임 선생님', crisisMessage: null }
    },

    // 목업은 과목 선택·처리 실패가 생기지 않는다
    chooseSubject: async () => {
      throw new Error('목업에서는 과목 선택을 지원하지 않아요.')
    },
    retry: async () => {
      throw new Error('목업에서는 다시 시도할 일이 없어요.')
    },
    getSubjects: async () => [],
  }
}
