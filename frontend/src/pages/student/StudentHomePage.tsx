import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { backendAskEngine } from '../../api/ask'
import type { AskResult } from '../../api/askEngine'
import { createMockAskEngine } from '../../api/askMock'
import { USE_MOCK } from '../../api/client'
import { requestCounseling } from '../../api/crisis'
import { newId } from '../../api/mock/db'
import { useStudent } from '../../session/session'
import type { FiveW1H } from '../../types/question'
import AiMessage, { TypingBubble, type ChatActions } from './chat/AiMessage'
import Composer from './chat/Composer'
import HomeSections from './chat/HomeSections'
import type { AiContent, ChatItem } from './chat/types'

const SUGGESTIONS = ['체험학습 신청서 언제까지 내요?', '기말고사 시험 범위가 궁금해요', '이차함수 꼭짓점 구하는 법 알려주세요']

const FIVE_LABELS: [keyof FiveW1H, string][] = [
  ['who', '누가'],
  ['when', '언제'],
  ['where', '어디서'],
  ['what', '무엇을'],
  ['how', '어떻게'],
  ['why', '왜'],
]

// 학생이 채운 육하원칙을 말풍선 한 개로 요약한다
const summarize = (f: FiveW1H) =>
  FIVE_LABELS.filter(([k]) => f[k]?.trim())
    .map(([k, label]) => `${label}: ${f[k]?.trim()}`)
    .join('\n') || '(비워 두었어요)'

const questionIdOf = (c: AiContent) => ('questionId' in c ? c.questionId : null)

// 학생 홈 = 채팅 질문하기.
// 처음에는 인사말·큰 입력창·예시 질문과 공지를 보여주고, 질문을 보내면 대화 화면으로 바뀐다.
export default function StudentHomePage() {
  const student = useStudent()
  // 실제 백엔드면 백엔드 AI, 아니면 목업이 답한다
  const engine = useMemo(() => (USE_MOCK ? createMockAskEngine(student) : backendAskEngine), [student])

  // 공지 화면의 "이 공지 챗봇에게 묻기"에서 오면 공지 제목이 미리 채워진다
  const location = useLocation()
  const initialText = (location.state as { initialText?: string } | null)?.initialText ?? ''

  const [items, setItems] = useState<ChatItem[]>([])
  const [typing, setTyping] = useState<string | null>(null) // AI가 처리 중일 때 문구
  const [text, setText] = useState(initialText)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const lastQuestionText = useRef('')
  const endRef = useRef<HTMLDivElement>(null)

  // 새 말풍선이 생기면 맨 아래로 스크롤
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items, typing])

  // 학생 말풍선을 추가하고(지난 AI 말풍선은 비활성), AI 처리 결과를 이어 붙인다.
  // 실패하면 방금까지 살아 있던 말풍선을 다시 살려서 한 번 더 시도할 수 있게 한다.
  const respond = async (userText: string | null, typingLabel: string, task: () => Promise<AiContent>) => {
    const activeId = items.find((i) => i.role === 'ai' && i.active)?.id ?? null
    setItems((prev) => [
      ...prev.map((i) => (i.role === 'ai' ? { ...i, active: false } : i)),
      ...(userText ? [{ id: newId('u'), role: 'user' as const, text: userText }] : []),
    ])
    setTyping(typingLabel)
    try {
      const content = await task()
      setItems((prev) => [...prev, { id: newId('a'), role: 'ai', content, active: true }])
    } catch (err) {
      const message = err instanceof Error ? err.message : '문제가 생겼어요. 다시 시도해 주세요.'
      setItems((prev) => [
        ...prev.map((i) => (i.role === 'ai' && i.id === activeId ? { ...i, active: true } : i)),
        { id: newId('a'), role: 'ai', content: { kind: 'error', message }, active: false },
      ])
    } finally {
      setTyping(null)
    }
  }

  const send = (value = text) => {
    const question = value.trim()
    if (!question || typing) return
    setText('')
    lastQuestionText.current = question
    respond(question, 'AI가 질문을 살펴보고 있어요…', () => engine.submit(question, isAnonymous))
  }

  // AI 말풍선 안의 버튼·입력칸이 하는 일
  const actionsFor = (content: AiContent): ChatActions => {
    const qid = questionIdOf(content) ?? ''
    const step = (userText: string, label: string, task: () => Promise<AskResult>) => respond(userText, label, task)
    return {
      requireAllDetails: engine.requireAllDetails,
      getSubjects: engine.getSubjects,
      submitDetails: (f) => step(summarize(f), 'AI가 질문을 다시 쓰고 있어요…', () => engine.details(qid, f)),
      confirm: (c) => step(c, '담당 선생님을 찾고 있어요…', () => engine.confirm(qid, c)),
      chooseSubject: (s) => step(s.name, '선생님께 보내고 있어요…', () => engine.chooseSubject(qid, s.id)),
      resolve: () => respond('해결됐어요', '', async () => ({ kind: 'resolved' })),
      escalate: engine.escalate
        ? () => step('선생님께 물어볼래요', 'AI가 질문을 정리하고 있어요…', () => engine.escalate!(qid))
        : undefined,
      retry: () => step('다시 시도해 주세요', '다시 시도하고 있어요…', () => engine.retry(qid)),
      requestCounseling: (reveal) =>
        respond(reveal ? '이름을 알리고 연락받을게요' : '익명으로 알릴게요', '선생님께 알리고 있어요…', async () => {
          await requestCounseling(student, lastQuestionText.current, reveal)
          return { kind: 'crisis_sent' }
        }),
    }
  }

  const reset = () => {
    setItems([])
    setText('')
  }

  const anonymous = engine.supportsAnonymous ? { value: isAnonymous, onChange: setIsAnonymous } : undefined

  // 첫 화면: 인사말 · 큰 입력창 · 예시 질문 · 공지
  if (items.length === 0 && !typing) {
    return (
      <div className="flex flex-col gap-6">
        <div className="pt-6">
          <h1>{student.nickname}님, 무엇이 궁금한가요?</h1>
          <p className="mt-1 text-caption text-muted">AI가 공지에서 먼저 답을 찾고, 없으면 정리해서 담당 선생님께 전해 줘요</p>
        </div>

        <div className="flex flex-col gap-3">
          <Composer value={text} onChange={setText} onSend={() => send()} size="large" anonymous={anonymous} />
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-caption text-ink transition-colors hover:border-primary-200 hover:bg-primary-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <HomeSections />
      </div>
    )
  }

  // 대화 화면
  return (
    <div className="flex min-h-[calc(100svh-7rem)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">질문하기</p>
        <button type="button" onClick={reset} disabled={!!typing} className="text-caption text-muted disabled:opacity-40">
          + 새 대화
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 pb-4">
        {items.map((item) =>
          item.role === 'user' ? (
            <div key={item.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-primary-600 px-3.5 py-2.5 text-white">
                {item.text}
              </p>
            </div>
          ) : (
            <AiMessage key={item.id} content={item.content} active={item.active && !typing} actions={actionsFor(item.content)} />
          ),
        )}
        {typing && <TypingBubble label={typing} />}
        <div ref={endRef} />
      </div>

      {/* 하단 입력창 (탭바 위에 붙는다) */}
      <div className="sticky bottom-16 bg-surface pt-2 pb-3">
        <Composer
          value={text}
          onChange={setText}
          onSend={() => send()}
          disabled={!!typing}
          placeholder="새로 궁금한 걸 물어보세요"
          anonymous={anonymous}
        />
      </div>
    </div>
  )
}
