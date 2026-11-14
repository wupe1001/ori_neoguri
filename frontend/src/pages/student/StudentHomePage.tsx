import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { backendAskEngine } from '../../api/ask'
import type { AskResult } from '../../api/askEngine'
import { createMockAskEngine } from '../../api/askMock'
import { USE_MOCK } from '../../api/client'
import { requestCounseling } from '../../api/crisis'
import { newId } from '../../api/mock/db'
import { getUnreadAnswerCount } from '../../api/questions'
import { usePolling } from '../../lib/usePolling'
import { useStudent } from '../../session/session'
import { SentPhotos } from '../../components/Attachments'
import AiMessage, { TypingBubble, type ChatActions } from './chat/AiMessage'
import Composer, { type ChatMode } from './chat/Composer'
import HomeSections from './chat/HomeSections'
import TeacherThread from './chat/TeacherThread'
import type { AiContent, ChatItem } from './chat/types'

const SUGGESTIONS = ['체험학습 신청서 언제까지 내요?', '기말고사 시험 범위가 궁금해요', '이차함수 꼭짓점 구하는 법 알려주세요']

const questionIdOf = (c: AiContent) => ('questionId' in c ? c.questionId : null)

// 학생 홈 = 채팅 질문하기.
// 처음에는 인사말·큰 입력창·예시 질문과 공지를 보여주고, 질문을 보내면 대화 화면으로 바뀐다.
// 입력창의 [AI | 선생님] 토글로 AI 채팅과 선생님 대화(보낸 질문과 받은 답)를 오간다.
export default function StudentHomePage() {
  const student = useStudent()
  // 실제 백엔드면 백엔드 AI, 아니면 목업이 답한다
  const engine = useMemo(() => (USE_MOCK ? createMockAskEngine(student) : backendAskEngine), [student])

  // 공지 화면의 "이 공지 챗봇에게 묻기"에서 오면 공지 제목이 미리 채워진다.
  // 내 질문의 [이어서 하기]에서 오면 멈춘 질문을 그 단계부터 이어서 한다.
  const location = useLocation()
  const navigate = useNavigate()
  const navState = location.state as { initialText?: string; resumeQuestionId?: string } | null
  const initialText = navState?.initialText ?? ''
  const resumeId = engine.resume ? (navState?.resumeQuestionId ?? null) : null

  const [items, setItems] = useState<ChatItem[]>([])
  const [typing, setTyping] = useState<string | null>(resumeId ? '멈춘 질문을 불러오고 있어요…' : null) // AI가 처리 중일 때 문구
  const [text, setText] = useState(initialText)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [photos, setPhotos] = useState<File[]>([]) // 새 질문에 붙일 사진
  const [mode, setMode] = useState<ChatMode>('ai')
  // 아직 확인하지 않은 선생님 답 수 → 토글의 [선생님] 뱃지
  const unread = usePolling(useCallback(() => getUnreadAnswerCount(student.id), [student.id]), 0, 10000)
  const lastQuestionText = useRef('')
  const endRef = useRef<HTMLDivElement>(null)

  // [이어서 하기]: 멈춘 질문과 지금 해야 할 단계를 불러와 대화로 보여준다
  const resumed = useRef(false)
  useEffect(() => {
    if (!resumeId || !engine.resume || resumed.current) return
    resumed.current = true
    // 새로고침해도 다시 불러오지 않게 주소의 상태를 지운다
    navigate(location.pathname, { replace: true, state: null })
    engine
      .resume(resumeId)
      .then(({ question, result }) => {
        lastQuestionText.current = question
        setItems([
          { id: newId('u'), role: 'user', text: question },
          { id: newId('a'), role: 'ai', content: result, active: true },
        ])
      })
      .catch((err: Error) => {
        setItems([{ id: newId('a'), role: 'ai', content: { kind: 'error', message: err.message }, active: false }])
      })
      .finally(() => setTyping(null))
  }, [resumeId, engine, navigate, location.pathname])

  // 새 말풍선이 생기면 맨 아래로 스크롤
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items, typing])

  // 학생 말풍선을 추가하고(지난 AI 말풍선은 비활성), AI 처리 결과를 이어 붙인다.
  // 실패하면 방금까지 살아 있던 말풍선을 다시 살려서 한 번 더 시도할 수 있게 한다.
  const respond = async (
    userText: string | null,
    typingLabel: string,
    task: () => Promise<AiContent>,
    files?: File[],
  ) => {
    const activeId = items.find((i) => i.role === 'ai' && i.active)?.id ?? null
    setItems((prev) => [
      ...prev.map((i) => (i.role === 'ai' ? { ...i, active: false } : i)),
      ...(userText ? [{ id: newId('u'), role: 'user' as const, text: userText, files }] : []),
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

  // 질문 다듬기 1·2단계(막힌 곳, 실제 사례)는 아래 입력창으로 대화하듯 답한다
  const activeAi = items.find((i) => i.role === 'ai' && i.active)
  const awaiting =
    activeAi?.role === 'ai' && (activeAi.content.kind === 'stuck' || activeAi.content.kind === 'example')
      ? activeAi.content
      : null

  const send = (value = text) => {
    const message = value.trim()
    if (!message || typing) return
    setText('')
    // 선생님 대화에서 보내도 질문은 AI가 다듬어서 선생님께 전한다
    setMode('ai')
    if (awaiting?.kind === 'stuck') {
      respond(message, 'AI가 더 구체적으로 물어볼게요…', () => engine.answerStuck(awaiting.questionId, message))
      return
    }
    if (awaiting?.kind === 'example') {
      respond(message, 'AI가 질문 후보를 만들고 있어요…', () => engine.answerExample(awaiting.questionId, message))
      return
    }
    lastQuestionText.current = message
    const files = photos
    setPhotos([])
    respond(
      message,
      files.length ? '사진을 올리고 질문을 살펴보고 있어요…' : 'AI가 질문을 살펴보고 있어요…',
      () => engine.submit(message, isAnonymous, files),
      files.length ? files : undefined,
    )
  }

  // AI 말풍선 안의 버튼·입력칸이 하는 일
  const actionsFor = (content: AiContent): ChatActions => {
    const qid = questionIdOf(content) ?? ''
    const step = (userText: string, label: string, task: () => Promise<AskResult>) => respond(userText, label, task)
    return {
      getSubjects: engine.getSubjects,
      fillComposer: setText,
      skipToFinal: () => step('이 정도면 충분해요. 바로 정리해 주세요', 'AI가 질문을 정리하고 있어요…', () => engine.skipToFinal(qid)),
      finalize: (c) => step(c, '담당 선생님을 찾고 있어요…', () => engine.finalize(qid, c)),
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
    setPhotos([])
  }

  const anonymous = engine.supportsAnonymous ? { value: isAnonymous, onChange: setIsAnonymous } : undefined
  const modeToggle = { value: mode, onChange: setMode, badge: unread }
  // 사진은 새 질문을 보낼 때만 붙일 수 있다 (질문 다듬기 답에는 못 붙인다)
  const attach = awaiting ? undefined : { files: photos, onChange: setPhotos }

  // 선생님 대화: 보낸 질문과 받은 답 (보기 전용). 여기서 새로 보내면 AI 채팅으로 넘어간다
  if (mode === 'teacher') {
    return (
      <div key="teacher" className="page-in flex min-h-[calc(100svh-7rem)] flex-col">
        <p className="mb-3 font-semibold">선생님 대화</p>
        <div className="flex-1">
          <TeacherThread />
        </div>
        <div className="sticky bottom-16 bg-page pt-2 pb-3">
          <Composer
            value={text}
            onChange={setText}
            onSend={() => send()}
            disabled={!!typing}
            placeholder="새로 질문하면 AI가 다듬어서 선생님께 전해 줘요"
            mode={modeToggle}
            attach={attach}
          />
        </div>
      </div>
    )
  }

  // 첫 화면: 인사말 · 큰 입력창 · 예시 질문 · 공지
  if (items.length === 0 && !typing) {
    return (
      <div key="first" className="page-in flex flex-col gap-6">
        {/* 히어로: 연한 노랑→주황 그라데이션 위에 인사말과 입력창 */}
        <div className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[28px] bg-linear-to-br from-sun-50 via-sun-100 to-primary-100 px-5 pt-10 pb-6 text-ink">
          <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-sun-200/60 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-primary-200/50 blur-2xl" />
          <p className="relative text-caption font-semibold text-primary-700">오리너구리 AI 질문 도우미</p>
          <h1 className="relative mt-1 text-ink">
            {student.nickname}님,
            <br />
            무엇이 궁금한가요?
          </h1>
          <p className="relative mt-2 text-caption text-ink/70">
            AI가 공지에서 먼저 답을 찾고, 없으면 정리해서 담당 선생님께 전해 줘요
          </p>
          <div className="relative mt-5 text-body text-ink">
            <Composer
              value={text}
              onChange={setText}
              onSend={() => send()}
              size="large"
              anonymous={anonymous}
              mode={modeToggle}
              attach={attach}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-caption font-semibold text-muted">이런 질문을 많이 해요</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-line bg-surface px-3.5 py-2 text-caption text-ink shadow-card hover:-translate-y-px hover:border-primary-200 hover:text-primary-700 hover:shadow-md hover:shadow-navy/5"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <HomeSections onOpenTeacher={() => setMode('teacher')} />
      </div>
    )
  }

  // 대화 화면
  return (
    <div key="chat" className="page-in flex min-h-[calc(100svh-7rem)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">질문하기</p>
        <button type="button" onClick={reset} disabled={!!typing} className="text-caption text-muted enabled:hover:text-ink disabled:opacity-40">
          + 새 대화
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 pb-4">
        {items.map((item) =>
          item.role === 'user' ? (
            <div key={item.id} className="flex flex-col items-end gap-1.5">
              {item.files && <SentPhotos files={item.files} />}
              <p className="max-w-[85%] whitespace-pre-line rounded-[20px] rounded-tr-md bg-linear-to-br from-primary-500 to-primary-700 px-4 py-2.5 text-white shadow-sm shadow-primary-600/20">
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
      <div className="sticky bottom-16 bg-page pt-2 pb-3">
        <Composer
          value={text}
          onChange={setText}
          onSend={() => send()}
          disabled={!!typing}
          placeholder={
            awaiting?.kind === 'stuck'
              ? '어디서 막혔는지 적어 주세요'
              : awaiting?.kind === 'example'
                ? '헷갈렸던 실제 문장이나 문제를 적어 주세요'
                : '새로 궁금한 걸 물어보세요'
          }
          // 질문 다듬기 중에는 익명 토글을 숨긴다 (처음 보낼 때만 정한다)
          anonymous={awaiting ? undefined : anonymous}
          mode={modeToggle}
          attach={attach}
        />
      </div>
    </div>
  )
}
