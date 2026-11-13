import type {
  AnswerDraft,
  ChatbotReply,
  FiveW1H,
  QuestionCategory,
  ScreenResult,
  Source,
} from '../types/question'
import type { ClassRef } from '../types/user'
import { delay, readDb } from './mock/db'

// AI가 하는 일들의 목업. 실제로는 백엔드가 AI를 호출한 결과를 돌려준다.
// 지금은 키워드 규칙으로 흉내만 낸다.

// TODO(백엔드): POST /api/ai/screen

const CRISIS_WORDS = ['죽고 싶', '자해', '사라지고 싶', '괴롭힘', '때려', '힘들어 죽']
const BLOCKED_WORDS = ['시발', '씨발', '병신', '꺼져', '닥쳐']

// 보내기 전 검사: 위기 신호 → 욕설·비방 순서
export async function screenQuestion(text: string): Promise<ScreenResult> {
  await delay(300)
  if (CRISIS_WORDS.some((w) => text.includes(w))) return { kind: 'crisis' }
  if (BLOCKED_WORDS.some((w) => text.includes(w))) {
    return { kind: 'blocked', reason: '상대를 존중하지 않는 표현이 들어 있어요. 표현을 바꿔서 다시 보내 주세요.' }
  }
  return { kind: 'ok' }
}

// TODO(백엔드): POST /api/ai/refine

// 육하원칙으로 정리. 알 수 없는 칸은 null (학생이 채움)
export async function refineQuestion(text: string, author: ClassRef, isAnonymous: boolean): Promise<FiveW1H> {
  await delay(800)
  return {
    who: `${author.grade}학년 ${author.classNo}반 학생${isAnonymous ? ' (익명)' : ''}`,
    when: null,
    where: null,
    what: text.replace(/[?？]\s*$/, ''),
    how: null,
    why: null,
  }
}

// TODO(백엔드): POST /api/ai/rewrite

// 채운 육하원칙으로 질문을 다시 쓴다 ("이렇게 보낼까요?")
export async function rewriteQuestion(original: string, f: FiveW1H): Promise<string> {
  await delay(800)
  const context = [f.when, f.where, f.why].filter(Boolean).join(', ')
  const how = f.how ? ` ${f.how}(으)로 하면 되나요?` : ''
  return `${context ? `${context} 상황입니다. ` : ''}${f.what ?? original}에 대해 알고 싶어요.${how}`
}

// TODO(백엔드): 분류는 질문 전송 시 백엔드에서 처리

export function classify(text: string): QuestionCategory {
  if (/수행|보고서|발표|과제/.test(text)) return '수행평가'
  if (/시험|문제|개념|수업|공식/.test(text)) return '교과'
  if (/고민|걱정|친구|힘들/.test(text)) return '고민'
  return '생활'
}

// 저장소(공지)에서 질문과 겹치는 단어가 있는 자료를 근거로 찾는다
function findSources(text: string): Source[] {
  const words = text.split(/\s+/).filter((w) => w.length >= 2)
  return readDb()
    .notices.filter((n) => words.some((w) => n.title.includes(w.slice(0, 2)) || n.body.includes(w.slice(0, 2))))
    .map((n) => ({ type: 'notice' as const, title: n.title, excerpt: n.body }))
}

// TODO(백엔드): POST /api/ai/chatbot

// 챗봇 답: 근거가 있으면 출처를 붙여 답, 없으면 answer가 null
export async function askChatbot(text: string): Promise<ChatbotReply> {
  await delay(800)
  const sources = findSources(text)
  if (sources.length === 0) return { answer: null, sources: [] }
  return { answer: `공지에 따르면, ${sources[0].excerpt}`, sources }
}

// TODO(백엔드): GET /api/questions/:id/draft

// 교사용 AI 답 초안
export async function getAnswerDraft(questionText: string): Promise<AnswerDraft> {
  await delay(800)
  const sources = findSources(questionText)
  if (sources.length === 0) {
    return { text: '관련 공지나 승인된 답을 찾지 못했어요. 직접 답을 작성해 주세요.', sources: [] }
  }
  return { text: `안녕하세요. ${sources[0].excerpt} 더 궁금한 점이 있으면 다시 질문해 주세요.`, sources }
}
