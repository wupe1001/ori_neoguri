import type {
  AnswerDraft,
  ChatbotReply,
  FiveW1H,
  QuestionCategory,
  ScreenResult,
  Source,
} from '../types/question'
import type { Department, Student } from '../types/user'
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
// 익명이면 "2학년 3반 학생 (익명)", 아니면 "2학년 3반 오리"
export async function refineQuestion(text: string, author: Student, isAnonymous: boolean): Promise<FiveW1H> {
  await delay(800)
  const classLabel = `${author.grade}학년 ${author.classNo}반`
  return {
    who: isAnonymous ? `${classLabel} 학생 (익명)` : `${classLabel} ${author.nickname}`,
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
  const question = original.trim().replace(/[?？.]*$/, '?')
  const parts = [
    (f.when || f.where) && `${[f.when, f.where].filter(Boolean).join(', ')} 관련 질문이에요.`,
    f.why && `${f.why} 때문에 여쭤봐요.`,
    question,
    f.how && `${f.how}(으)로 하면 되는지도 궁금해요.`,
  ]
  return parts.filter(Boolean).join(' ')
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

// 교사용 AI 답 초안. 근거가 없으면 text가 빈 문자열 (교사가 직접 작성)
export async function getAnswerDraft(questionText: string): Promise<AnswerDraft> {
  await delay(800)
  const sources = findSources(questionText)
  if (sources.length === 0) return { text: '', sources: [] }
  return { text: `안녕하세요. ${sources[0].excerpt} 더 궁금한 점이 있으면 다시 질문해 주세요.`, sources }
}

// TODO(백엔드): GET /api/questions/:id/recommend-department

// 내 담당이 아닐 때 넘길 부서 추천
export async function recommendDepartment(text: string): Promise<{ department: Department; reason: string }> {
  await delay(300)
  if (/체험학습|출결|결석|시험|성적|수강/.test(text)) return { department: '교무부', reason: '학사·출결 관련 질문이에요' }
  if (/급식|교복|분실|납부|비용|돈/.test(text)) return { department: '행정실', reason: '비용·시설 관련 질문이에요' }
  if (/고민|걱정|친구|힘들/.test(text)) return { department: '상담실', reason: '고민 상담이 필요해 보여요' }
  return { department: '학생부', reason: '학교생활·규정 관련 질문이에요' }
}

// TODO(백엔드): GET /api/teachers/:id/top-questions

export type TopQuestion = {
  topic: string // 예: "체험학습 신청"
  count: number
  example: string // 대표 질문
}

const TOPICS: [string, RegExp][] = [
  ['체험학습 신청', /체험학습/],
  ['수행평가 기준', /수행|보고서/],
  ['시험 범위·일정', /시험|기말|중간/],
  ['급식·교복', /급식|교복/],
  ['출결', /결석|지각|조퇴|출결/],
]

// 교사: 많이 나온 질문 TOP 3 (주제별로 묶어서 센다)
export async function getTopQuestions(questions: { rewrittenText: string }[]): Promise<TopQuestion[]> {
  await delay(300)
  return TOPICS.map(([topic, pattern]) => {
    const matched = questions.filter((q) => pattern.test(q.rewrittenText))
    return { topic, count: matched.length, example: matched[0]?.rewrittenText ?? '' }
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}

// TODO(백엔드): GET /api/notices/draft

// 교사: 학사일정·가정통신문으로 만든 오늘의 공지 초안
export async function getTodayNoticeDraft(): Promise<{ title: string; body: string; basis: string }> {
  await delay(500)
  return {
    title: '기말고사 2주 전 안내',
    body: '기말고사가 12월 8일(화)에 시작합니다. 과목별 시험 범위는 다음 주 월요일까지 공지할 예정이니, 수행평가 제출 일정과 겹치지 않게 미리 확인해 주세요.',
    basis: '학사일정: 2학기 기말고사 (12월 8일~11일)',
  }
}
