import type {
  AnswerDraft,
  ChatbotReply,
  FiveW1H,
  Question,
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

// 어느 질문에나 나오는 말은 근거를 찾을 때 뺀다
const STOP_WORDS = ['있어', '궁금', '언제', '어떻', '어디', '무엇', '뭐예', '하면', '되나', '알고', '질문', '선생', '공지', '에서', '이번', '저는', '제가', '그리', '관련', '때문', '여쭤']

// 질문에서 비교할 단어 조각(앞 두 글자)을 뽑는다
function keywords(text: string) {
  const parts = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w.slice(0, 2))
  return [...new Set(parts)].filter((w) => !STOP_WORDS.includes(w))
}

const score = (words: string[], target: string) => words.filter((w) => target.includes(w)).length

// 답 근거 저장소(보낸 공지 + 승인된 답 + 수업 자료)에서 질문과 많이 겹치는 자료를 근거로 찾는다
function findSources(text: string): Source[] {
  const words = keywords(text)
  if (words.length === 0) return []
  const db = readDb()

  const fromNotices = db.notices.map((n) => ({
    source: { type: 'notice' as const, title: n.title, excerpt: n.body },
    score: score(words, `${n.title} ${n.body}`),
  }))
  // 승인된 답은 "질문"끼리 비교한다 (비슷한 질문의 답을 찾는다)
  const fromAnswers = db.questions
    .filter((q) => q.answer)
    .map((q) => ({
      source: { type: 'approved_answer' as const, title: q.rewrittenText, excerpt: q.answer!.text },
      score: score(words, `${q.originalText} ${q.rewrittenText}`),
    }))

  const fromMaterials = db.materials.map((m) => ({
    source: { type: 'material' as const, title: m.title, excerpt: m.body },
    score: score(words, `${m.title} ${m.body}`),
  }))

  // 같은 질문에 같은 답이 여러 번 저장돼 있을 수 있어서 (함께 보낸 답, 같은 질문 반복) 하나로 합친다
  const seen = new Set<string>()
  return [...fromAnswers, ...fromNotices, ...fromMaterials]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score) // 같은 점수면 승인된 답이 먼저
    .map((s) => s.source)
    .filter((s) => {
      const key = `${s.type}|${s.title}|${s.excerpt}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 3)
}

// TODO(백엔드): POST /api/ai/chatbot

// 챗봇 답: 근거가 있으면 출처를 붙여 답, 없으면 answer가 null
export async function askChatbot(text: string): Promise<ChatbotReply> {
  await delay(800)
  const sources = findSources(text)
  if (sources.length === 0) return { answer: null, sources: [] }
  const top = sources[0]
  const lead =
    top.type === 'approved_answer'
      ? '비슷한 질문에 선생님이 이렇게 답했어요.'
      : `'${top.title}' ${top.type === 'material' ? '수업 자료' : '공지'}에 따르면,`
  return { answer: `${lead} ${top.excerpt}`, sources }
}

// TODO(백엔드): GET /api/questions/:id/draft

// 교사용 AI 답 초안. 근거가 없으면 text가 빈 문자열 (교사가 직접 작성)
export async function getAnswerDraft(questionText: string): Promise<AnswerDraft> {
  await delay(800)
  const sources = findSources(questionText)
  if (sources.length === 0) return { text: '', sources: [] }
  const top = sources[0]
  // 비슷한 질문에 승인된 답이 있으면 그 답을 그대로 초안으로 쓴다
  if (top.type === 'approved_answer') return { text: top.excerpt, sources }
  return { text: `안녕하세요. ${top.excerpt} 더 궁금한 점이 있으면 다시 질문해 주세요.`, sources }
}

// TODO(백엔드): GET /api/questions/:id/similar

// 같은 담당에게 온, 아직 답하지 않은 비슷한 질문 (승인할 때 같은 답을 함께 보낸다)
export async function findSimilarQuestions(questionId: string): Promise<Question[]> {
  await delay(300)
  const all = readDb().questions
  const base = all.find((q) => q.id === questionId)
  if (!base) return []
  const words = keywords(`${base.originalText} ${base.rewrittenText}`)
  return all.filter(
    (q) =>
      q.id !== base.id &&
      q.status !== 'answered' &&
      JSON.stringify(q.assignee) === JSON.stringify(base.assignee) &&
      score(words, `${q.originalText} ${q.rewrittenText}`) >= 2,
  )
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

// 주제(개념) 목록. 위에 있을수록 먼저 묶인다. 실제로는 AI가 질문 내용을 보고 묶는다.
const TOPICS: [string, RegExp][] = [
  ['이차함수 꼭짓점·그래프', /이차함수|꼭짓점|포물선|판별식/],
  ['확률·경우의 수', /확률|경우의 수/],
  ['문법·맞춤법', /문법|품사|맞춤법|띄어쓰기/],
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

// TODO(백엔드): GET /api/teachers/:id/clusters

export type QuestionCluster = {
  topic: string
  questions: Question[]
  studentCount: number // 질문한 학생 수 (같은 학생이 여러 번 물어도 1명)
}

// 교사: 질문을 개념별로 묶는다. 어느 주제에도 안 맞는 질문은 unclustered로 돌려준다.
export async function getClusters(
  questions: Question[],
): Promise<{ clusters: QuestionCluster[]; unclustered: Question[] }> {
  await delay(600)
  const groups = new Map<string, Question[]>()
  const unclustered: Question[] = []
  for (const q of questions) {
    const text = `${q.originalText} ${q.rewrittenText}`
    const topic = TOPICS.find(([, pattern]) => pattern.test(text))?.[0]
    if (!topic) unclustered.push(q)
    else groups.set(topic, [...(groups.get(topic) ?? []), q])
  }
  const clusters = [...groups.entries()]
    .map(([topic, list]) => ({ topic, questions: list, studentCount: new Set(list.map((q) => q.studentId)).size }))
    .sort((a, b) => b.studentCount - a.studentCount || b.questions.length - a.questions.length)
  return { clusters, unclustered }
}

// TODO(백엔드): POST /api/ai/lesson-draft

// 교사: 묶음을 보고 다음 수업 보충 설명 초안을 쓴다
export async function getLessonDraft(cluster: QuestionCluster): Promise<string> {
  await delay(900)
  const examples = cluster.questions
    .slice(0, 2)
    .map((q) => `- "${q.originalText}"`)
    .join('\n')
  return [
    `[다음 수업 도입 5분] ${cluster.topic}`,
    '',
    `학생 ${cluster.studentCount}명이 이 부분에서 막혔어요. 자주 나온 질문:`,
    examples,
    '',
    '보충 설명 순서 제안',
    `1. ${cluster.topic}의 핵심 개념을 한 문장으로 다시 정리해요.`,
    '2. 학생들이 헷갈린 지점을 예제 하나로 직접 풀어 보여줘요.',
    '3. 비슷한 문제 하나를 짝과 함께 풀게 하고, 남은 질문을 받아요.',
  ].join('\n')
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
