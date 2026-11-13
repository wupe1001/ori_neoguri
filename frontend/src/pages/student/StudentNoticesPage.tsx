import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getApprovedAnswers, getNoticesFor } from '../../api/notices'
import { subscribeQuestions } from '../../api/questions'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { cn } from '../../components/cn'
import Loading from '../../components/Loading'
import { timeAgo } from '../../lib/format'
import { ROUTES } from '../../routes'
import { useStudent } from '../../session/session'
import type { Notice, Question } from '../../types/question'

type Tab = 'notices' | 'faq'

export default function StudentNoticesPage() {
  const student = useStudent()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('notices')
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [faq, setFaq] = useState<Question[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // 공지와 자주 묻는 질문을 불러오고, 다른 탭(교사)에서 공지를 보내면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [noticeList, answered] = await Promise.all([getNoticesFor(student), getApprovedAnswers(student)])
      if (cancelled) return
      setNotices(noticeList)
      setFaq(answered)
    }
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [student])

  if (!notices || !faq) return <Loading message="공지를 불러오고 있어요…" />

  // 공지 제목을 붙여서 질문하기 화면으로 보낸다
  const askAbout = (n: Notice) =>
    navigate(ROUTES.STUDENT.ASK, { state: { initialText: `'${n.title}' 공지에서 궁금한 게 있어요. ` } })

  return (
    <div className="flex flex-col gap-4">
      <h1>공지</h1>

      <div className="grid grid-cols-2 rounded-full bg-page p-1 text-caption font-semibold">
        {(
          [
            ['notices', '받은 공지'],
            ['faq', '자주 묻는 질문'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'rounded-full py-2 transition-colors',
              tab === value ? 'bg-surface text-primary-700 shadow-sm' : 'text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'notices' ? (
        notices.length === 0 ? (
          <p className="py-16 text-center text-muted">받은 공지가 없어요</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notices.map((n) => {
              const open = openId === n.id
              return (
                <li key={n.id}>
                  <Card>
                    <button type="button" onClick={() => setOpenId(open ? null : n.id)} className="w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{n.title}</p>
                        <span className="shrink-0 text-caption text-muted">{timeAgo(n.sentAt)}</span>
                      </div>
                      <p className={cn('mt-1 text-caption text-ink', !open && 'line-clamp-2')}>{n.body}</p>
                      <p className="mt-2 text-caption text-muted">{n.senderName ?? '선생님'}</p>
                    </button>
                    {open && (
                      <Button size="sm" variant="secondary" className="mt-3" onClick={() => askAbout(n)}>
                        이 공지 챗봇에게 묻기
                      </Button>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )
      ) : faq.length === 0 ? (
        <p className="py-16 text-center text-muted">아직 선생님이 승인한 답이 없어요</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {faq.map((q) => (
            <li key={q.id}>
              <Card>
                <p className="font-semibold">Q. {q.rewrittenText}</p>
                <p className="mt-2 whitespace-pre-line">{q.answer?.text}</p>
                <p className="mt-2 text-caption text-muted">{q.answer?.teacherName} 선생님이 승인한 답</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
