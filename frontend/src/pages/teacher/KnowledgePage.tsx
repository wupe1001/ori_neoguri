import { useEffect, useState, type ReactNode } from 'react'
import { addMaterial, getKnowledge, type Knowledge } from '../../api/knowledge'
import { subscribeQuestions } from '../../api/questions'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { cn } from '../../components/cn'
import Loading from '../../components/Loading'
import { Input, TextArea } from '../../components/TextField'
import { timeAgo } from '../../lib/format'
import { useTeacher } from '../../session/session'

type Tab = 'answers' | 'notices' | 'materials'

export default function KnowledgePage() {
  const teacher = useTeacher()
  const [data, setData] = useState<Knowledge | null>(null)
  const [tab, setTab] = useState<Tab>('answers')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  // 처음 불러오고, 다른 탭에서 답·공지가 쌓이면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = () =>
      getKnowledge().then((k) => {
        if (!cancelled) setData(k)
      })
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  if (!data) return <Loading message="저장소를 불러오고 있어요…" />

  const q = search.trim()
  const match = (...texts: string[]) => !q || texts.some((t) => t.includes(q))
  const answers = data.answers.filter((a) => match(a.question.rewrittenText, a.question.answer?.text ?? ''))
  const notices = data.notices.filter((n) => match(n.title, n.body))
  const materials = data.materials.filter((m) => match(m.title, m.body))

  const tabs: [Tab, string, number][] = [
    ['answers', '승인된 답', answers.length],
    ['notices', '보낸 공지', notices.length],
    ['materials', '수업 자료', materials.length],
  ]

  const handleAdded = async (title: string, body: string) => {
    const material = await addMaterial(teacher, title, body)
    setData({ ...data, materials: [material, ...data.materials] })
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1>답 근거 저장소</h1>
        <p className="mt-1 text-caption text-muted">
          챗봇과 AI 답 초안은 여기 있는 자료에서 근거를 찾아요. 답을 승인하거나 공지를 보내면 자동으로 쌓여요.
        </p>
      </div>

      <Input placeholder="검색 (예: 체험학습)" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="grid grid-cols-3 rounded-full bg-page p-1 text-caption font-semibold">
        {tabs.map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'rounded-full py-2 transition-colors',
              tab === value ? 'bg-surface text-primary-700 shadow-sm' : 'text-muted',
            )}
          >
            {label} {count}
          </button>
        ))}
      </div>

      {tab === 'answers' && (
        <List empty="아직 승인된 답이 없어요">
          {answers.map(({ question, recipients }) => (
            <Card key={question.id}>
              <p className="font-semibold">Q. {question.rewrittenText}</p>
              <p className="mt-2 whitespace-pre-line">{question.answer?.text}</p>
              <p className="mt-2 text-caption text-muted">
                {question.answer?.teacherName} 선생님 · {timeAgo(question.answer?.answeredAt ?? '')}
                {recipients > 1 && ` · ${recipients}명에게 보냄`}
              </p>
            </Card>
          ))}
        </List>
      )}

      {tab === 'notices' && (
        <List empty="아직 보낸 공지가 없어요">
          {notices.map((n) => (
            <Card key={n.id}>
              <p className="font-semibold">{n.title}</p>
              <p className="mt-1 text-caption text-ink">{n.body}</p>
              <p className="mt-2 text-caption text-muted">
                {n.senderName ?? '선생님'} · {timeAgo(n.sentAt)}
              </p>
            </Card>
          ))}
        </List>
      )}

      {tab === 'materials' && (
        <>
          {adding ? (
            <MaterialForm onSubmit={handleAdded} onCancel={() => setAdding(false)} />
          ) : (
            <Button variant="secondary" fullWidth onClick={() => setAdding(true)}>
              + 수업 자료·루브릭 올리기
            </Button>
          )}
          <List empty="아직 올린 자료가 없어요">
            {materials.map((m) => (
              <Card key={m.id}>
                <p className="font-semibold">{m.title}</p>
                <p className="mt-1 line-clamp-4 whitespace-pre-line text-caption text-ink">{m.body}</p>
                <p className="mt-2 text-caption text-muted">
                  {m.teacherName} 선생님 · {timeAgo(m.createdAt)}
                </p>
              </Card>
            ))}
          </List>
        </>
      )}
    </div>
  )
}

function List({ empty, children }: { empty: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className="py-12 text-center text-muted">{empty}</p>
  return <div className="flex flex-col gap-3">{children}</div>
}

function MaterialForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string, body: string) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await onSubmit(title.trim(), body.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="수업 자료·루브릭 올리기">
      <div className="flex flex-col gap-3">
        <Input
          label="제목"
          placeholder="예: 수학 수행평가 보고서 루브릭"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="내용"
          placeholder="자료 내용을 붙여넣어 주세요"
          hint="파일 업로드는 백엔드 연동 후 지원해요. 지금은 내용을 붙여넣어 주세요."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
        />
        <Button fullWidth disabled={!title.trim() || !body.trim() || saving} onClick={submit}>
          {saving ? '올리는 중…' : '올리기'}
        </Button>
        <Button variant="ghost" fullWidth onClick={onCancel}>
          취소
        </Button>
      </div>
    </Card>
  )
}
