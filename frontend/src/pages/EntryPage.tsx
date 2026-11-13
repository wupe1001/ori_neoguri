import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { enterAsStudent, enterAsTeacher, login } from '../api/auth'
import { USE_MOCK } from '../api/client'
import Button from '../components/Button'
import { cn } from '../components/cn'
import { Input } from '../components/TextField'
import { ROUTES } from '../routes'
import { useSession } from '../session/session'
import type { Session } from '../types/user'

const homeOf = (s: Session) => (s.role === 'student' ? ROUTES.STUDENT.HOME : ROUTES.TEACHER.HOME)

// 입장 화면
// - 실제 백엔드: 아이디 + 비밀번호 (학생·교사는 서버가 알려준다)
// - 목업: 회원가입 없이 학생은 닉네임 + 반 코드, 교사는 교사 코드
export default function EntryPage() {
  const { session, signIn } = useSession()
  const navigate = useNavigate()

  // 이미 입장했으면 바로 홈으로
  if (session) return <Navigate to={homeOf(session)} replace />

  const onEntered = (next: Session) => {
    signIn(next)
    navigate(homeOf(next), { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col justify-center gap-8 bg-surface px-6 py-12">
      <div className="text-center">
        <h1>오리너구리</h1>
        <p className="mt-1 text-muted">궁금한 건 언제든, 선생님께 바로</p>
      </div>
      {USE_MOCK ? <CodeEntryForm onEntered={onEntered} /> : <LoginForm onEntered={onEntered} />}
    </main>
  )
}

type FormProps = { onEntered: (session: Session) => void }

// 제출 중 상태와 에러 문구를 함께 관리한다
function useSubmit(task: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : '입장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }
  return { error, setError, loading, submit }
}

// 실제 백엔드: 아이디 + 비밀번호
function LoginForm({ onEntered }: FormProps) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const { error, loading, submit } = useSubmit(async () => onEntered(await login(loginId, password)))

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="아이디"
        placeholder="예: student01"
        value={loginId}
        onChange={(e) => setLoginId(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        autoFocus
      />
      <Input
        label="비밀번호"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      {error && <p className="text-caption text-danger">{error}</p>}
      <Button type="submit" fullWidth disabled={!loginId.trim() || !password || loading}>
        {loading ? '확인 중…' : '로그인'}
      </Button>
      <p className="text-center text-caption text-muted">학생과 선생님 모두 학교에서 받은 계정으로 로그인해요</p>
    </form>
  )
}

// 목업: 학생은 닉네임 + 반 코드, 교사는 교사 코드
function CodeEntryForm({ onEntered }: FormProps) {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [nickname, setNickname] = useState('')
  const [classCode, setClassCode] = useState('')
  const [teacherCode, setTeacherCode] = useState('')
  const { error, setError, loading, submit } = useSubmit(async () => {
    if (role === 'student') onEntered({ role: 'student', user: await enterAsStudent(nickname, classCode) })
    else onEntered({ role: 'teacher', user: await enterAsTeacher(teacherCode) })
  })

  const canSubmit = role === 'student' ? nickname.trim() && classCode.trim() : teacherCode.trim()

  return (
    <>
      {/* 학생 / 교사 전환 */}
      <div className="grid grid-cols-2 rounded-full bg-page p-1 text-caption font-semibold">
        {(['student', 'teacher'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r)
              setError(null)
            }}
            className={cn(
              'rounded-full py-2 transition-colors',
              role === r ? 'bg-surface text-primary-700 shadow-sm' : 'text-muted',
            )}
          >
            {r === 'student' ? '학생' : '교사'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {role === 'student' ? (
          <>
            <Input
              label="닉네임"
              placeholder="예: 오리"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              autoFocus
            />
            <Input
              label="반 코드"
              placeholder="선생님께 받은 코드"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              hint="익명으로 질문하면 닉네임 대신 학년·반만 보여요"
              autoCapitalize="characters"
            />
          </>
        ) : (
          <Input
            label="교사 코드"
            placeholder="학교에서 받은 코드"
            value={teacherCode}
            onChange={(e) => setTeacherCode(e.target.value)}
            autoCapitalize="characters"
            autoFocus
          />
        )}

        {error && <p className="text-caption text-danger">{error}</p>}

        <Button type="submit" fullWidth disabled={!canSubmit || loading}>
          {loading ? '확인 중…' : '입장하기'}
        </Button>
      </form>
    </>
  )
}
