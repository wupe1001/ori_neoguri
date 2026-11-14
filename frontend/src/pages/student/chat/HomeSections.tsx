import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getNoticesFor } from '../../../api/notices'
import { getUnreadAnswerCount, subscribeQuestions } from '../../../api/questions'
import Card from '../../../components/Card'
import { timeAgo } from '../../../lib/format'
import { ROUTES } from '../../../routes'
import { useStudent } from '../../../session/session'
import type { Notice } from '../../../types/question'

// 홈 첫 화면에서 입력창 아래에 보여주는 것들: 새로 온 답, 꼭 볼 공지, 도움이 필요해요
// onOpenTeacher: "선생님 답이 왔어요" 카드를 누르면 선생님 대화로 바꾼다
export default function HomeSections({ onOpenTeacher }: { onOpenTeacher: () => void }) {
  const student = useStudent()
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [unread, setUnread] = useState(0)

  // 공지와 아직 안 본 답을 불러오고, 다른 탭(교사)에서 답하면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [noticeList, count] = await Promise.all([getNoticesFor(student), getUnreadAnswerCount(student.id)])
      if (cancelled) return
      setNotices([...noticeList].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 2))
      setUnread(count)
    }
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [student])

  return (
    <div className="flex flex-col gap-5">
      {/* 새로 온 답 */}
      {/* 답 내용은 열어볼 때 읽음 처리되므로, 홈에서는 개수만 알려주고 내 질문으로 보낸다 */}
      {unread > 0 && (
        <button type="button" onClick={onOpenTeacher} className="text-left">
          <Card className="flex items-center justify-between border-success bg-success-soft">
            <p className="font-semibold text-success">선생님 답이 {unread}개 왔어요</p>
            <span className="text-caption text-muted">선생님 대화 보기 →</span>
          </Card>
        </button>
      )}

      {/* 꼭 볼 공지 */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">꼭 볼 공지</h2>
          <Link to={ROUTES.STUDENT.NOTICES} className="text-caption text-muted hover:text-ink">
            전체 보기
          </Link>
        </div>
        {notices === null ? (
          <p className="text-caption text-muted">불러오고 있어요…</p>
        ) : notices.length === 0 ? (
          <p className="text-caption text-muted">새 공지가 없어요</p>
        ) : (
          notices.map((n) => (
            <Card key={n.id} className="card-grow">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{n.title}</p>
                <span className="shrink-0 text-caption text-muted">{timeAgo(n.sentAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-caption text-muted">{n.body}</p>
            </Card>
          ))
        )}
      </section>

      {/* 도움이 필요해요 */}
      <Link to={ROUTES.STUDENT.HELP}>
        <Card className="border-danger/30 bg-linear-to-br from-danger-soft via-danger-soft/70 to-warning-soft">
          <p className="font-semibold text-ink">도움이 필요해요</p>
          <p className="mt-1 text-caption text-muted">고민이 있으면 상담 선생님께 바로 연결해 줄게요</p>
        </Card>
      </Link>
    </div>
  )
}
