import { useEffect, useState } from 'react'
import { getTodayNoticeDraft } from '../../api/ai'
import { getAllNotices, getClasses, sendNotice } from '../../api/notices'
import Button from '../../components/Button'
import Card from '../../components/Card'
import Checkbox from '../../components/Checkbox'
import Loading from '../../components/Loading'
import { Input, TextArea } from '../../components/TextField'
import { timeAgo } from '../../lib/format'
import { useTeacher } from '../../session/session'
import type { Notice } from '../../types/question'
import type { ClassRef } from '../../types/user'

const classKey = (c: ClassRef) => `${c.grade}-${c.classNo}`
const classLabel = (c: ClassRef) => `${c.grade}학년 ${c.classNo}반`

export default function TeacherNoticesPage() {
  const teacher = useTeacher()

  const [classes, setClasses] = useState<ClassRef[] | null>(null)
  const [sent, setSent] = useState<Notice[] | null>(null)
  const [basis, setBasis] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targets, setTargets] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [justSent, setJustSent] = useState(false)

  // AI 초안, 반 목록, 보낸 공지를 불러온다. 대상은 담임 반을 기본으로 고른다.
  useEffect(() => {
    let cancelled = false
    Promise.all([getTodayNoticeDraft(), getClasses(), getAllNotices()]).then(([draft, classList, notices]) => {
      if (cancelled) return
      setBasis(draft.basis)
      setTitle(draft.title)
      setBody(draft.body)
      setClasses(classList)
      setTargets(teacher.homeroom ? [classKey(teacher.homeroom)] : [])
      setSent(notices)
    })
    return () => {
      cancelled = true
    }
  }, [teacher])

  if (!classes || !sent) return <Loading message="AI가 오늘 공지 초안을 쓰고 있어요…" />

  const toggleTarget = (key: string) =>
    setTargets((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const handleSend = async () => {
    setSending(true)
    try {
      const target = classes.filter((c) => targets.includes(classKey(c)))
      const notice = await sendNotice(teacher, title.trim(), body.trim(), target)
      setSent([notice, ...sent])
      setJustSent(true)
      setTitle('')
      setBody('')
      setBasis('')
    } finally {
      setSending(false)
    }
  }

  const canSend = title.trim() && body.trim() && targets.length > 0 && !sending

  return (
    <div className="flex flex-col gap-5">
      <h1>공지</h1>

      {justSent && (
        <p className="rounded-xl bg-success-soft p-3 text-caption text-success">
          공지를 보냈어요. 답 근거 저장소에도 쌓여서 챗봇이 이 공지로 답할 수 있어요.
        </p>
      )}

      {/* 작성: AI 초안 → 검토·수정 → 대상 골라 일괄 전송 */}
      <Card title={basis ? 'AI 공지 초안 · 검토하고 고쳐서 보내요' : '새 공지'}>
        <div className="flex flex-col gap-3">
          {basis && <p className="rounded-lg bg-primary-50 px-3 py-2 text-caption text-primary-700">근거: {basis}</p>}
          <Input label="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextArea label="내용" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />

          <div className="flex flex-col gap-2">
            <p className="text-caption font-semibold text-ink">받는 반</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {classes.map((c) => (
                <Checkbox
                  key={classKey(c)}
                  label={classLabel(c)}
                  checked={targets.includes(classKey(c))}
                  onChange={() => toggleTarget(classKey(c))}
                />
              ))}
            </div>
          </div>

          <Button fullWidth disabled={!canSend} onClick={handleSend}>
            {sending ? '보내는 중…' : `${targets.length}개 반에 보내기`}
          </Button>
        </div>
      </Card>

      {/* 보낸 공지 */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">보낸 공지</h2>
        {sent.length === 0 ? (
          <p className="text-caption text-muted">아직 보낸 공지가 없어요</p>
        ) : (
          sent.map((n) => (
            <Card key={n.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{n.title}</p>
                <span className="shrink-0 text-caption text-muted">{timeAgo(n.sentAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-caption text-ink">{n.body}</p>
              <p className="mt-2 text-caption text-muted">
                {n.senderName ?? '선생님'} · {n.target.map(classLabel).join(', ')}
              </p>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}
