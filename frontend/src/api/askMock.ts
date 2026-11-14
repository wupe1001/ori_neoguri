import type { ImprovementTrail } from '../types/question'
import type { Student } from '../types/user'
import { askChatbot, improvementCandidates, improvementExample, improvementStuck, screenQuestion } from './ai'
import type { AskEngine, AskResult } from './askEngine'
import { newId } from './mock/db'
import { submitQuestion } from './questions'

// 목업 질문하기 엔진: 실제 백엔드와 같은 흐름을 브라우저 안에서 흉내 낸다.
// 검사(위기·욕설) → 공지·승인된 답으로 답 → 없으면 질문 개선 4단계 → 담임 선생님께 전송
export function createMockAskEngine(student: Student): AskEngine {
  // 보내기 전 질문은 이 탭의 메모리에만 둔다
  const drafts = new Map<string, { text: string; isAnonymous: boolean; trail: ImprovementTrail }>()

  const draft = (id: string) => {
    const d = drafts.get(id)
    if (!d) throw new Error('질문 정보가 없어요. 처음부터 다시 보내 주세요.')
    return d
  }

  // 1단계로 들어간다
  const startImprovement = async (id: string): Promise<AskResult> => {
    const d = draft(id)
    const { prompt, examples } = await improvementStuck(d.text)
    d.trail.stuckPrompt = prompt
    return { kind: 'stuck', questionId: id, prompt, examples }
  }

  return {
    supportsAnonymous: true,

    submit: async (text, isAnonymous) => {
      const screen = await screenQuestion(text)
      if (screen.kind === 'crisis') return { kind: 'crisis', text }
      if (screen.kind === 'blocked') return { kind: 'blocked', reason: screen.reason }

      const id = newId('draft')
      drafts.set(id, {
        text,
        isAnonymous,
        trail: { stuckPrompt: null, stuck: null, examplePrompt: null, example: null, finalQuestion: null },
      })
      const reply = await askChatbot(text)
      if (reply.answer) {
        return { kind: 'notice_answered', questionId: id, answer: reply.answer, sources: reply.sources, canEscalate: true }
      }
      return startImprovement(id)
    },

    escalate: startImprovement,

    answerStuck: async (id, answer) => {
      const d = draft(id)
      d.trail.stuck = answer
      const prompt = await improvementExample(answer)
      d.trail.examplePrompt = prompt
      return { kind: 'example', questionId: id, prompt }
    },

    answerExample: async (id, answer) => {
      const d = draft(id)
      d.trail.example = answer
      const { prompt, candidates } = await improvementCandidates(d.text, d.trail.stuck ?? '', answer)
      return { kind: 'pick', questionId: id, prompt, candidates }
    },

    // 건너뛰기: 원래 질문과 지금까지 답한 내용을 이어 붙여 질문 하나로 만든다
    skipToFinal: async (id) => {
      const d = draft(id)
      const parts = [d.text.replace(/[?？.!]+$/, ''), d.trail.stuck, d.trail.example].filter(Boolean)
      return { kind: 'suggested', questionId: id, suggestion: `${parts.join(' / ')} 이 부분을 알려 주세요.` }
    },

    finalize: async (id, content) => {
      const d = draft(id)
      d.trail.finalQuestion = content
      const question = await submitQuestion({
        student,
        isAnonymous: d.isAnonymous,
        originalText: d.text,
        improvement: d.trail,
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
