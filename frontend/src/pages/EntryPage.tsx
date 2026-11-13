import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { enterAsStudent, enterAsTeacher } from '../api/auth'
import Button from '../components/Button'
import { cn } from '../components/cn'
import { Input } from '../components/TextField'
import { ROUTES } from '../routes'
import { useSession } from '../session/session'

type Role = 'student' | 'teacher'

// 입장 화면: 회원가입 없이 학생은 닉네임 + 반 코드, 교사는 교사 코드로 들어온다.
export default function EntryPage() {
  const { session, signIn } = useSession()
  const navigate = useNavigate()

  const [role, setRole] = useState<Role>('student')
  const [nickname, setNickname] = useState('')
  const [classCode, setClassCode] = useState('')
  const [teacherCode, setTeacherCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 이미 입장했으면 바로 홈으로
  if (session) {
    return <Navigate to={session.role === 'student' ? ROUTES.STUDENT.HOME : ROUTES.TEACHER.HOME} replace />
  }

  const canSubmit = role === 'student' ? nickname.trim() && classCode.trim() : teacherCode.trim()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (role === 'student') {
        const user = await enterAsStudent(nickname, classCode)
        signIn({ role: 'student', user })
        navigate(ROUTES.STUDENT.HOME, { replace: true })
      } else {
        const user = await enterAsTeacher(teacherCode)
        signIn({ role: 'teacher', user })
        navigate(ROUTES.TEACHER.HOME, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '입장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  const switchRole = (next: Role) => {
    setRole(next)
    setError(null)
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col justify-center gap-8 bg-surface px-6 py-12">
      <div className="text-center">
        <h1>오리너구리</h1>
        <p className="mt-1 text-muted">궁금한 건 언제든, 선생님께 바로</p>
      </div>

      {/* 학생 / 교사 전환 */}
      <div className="grid grid-cols-2 rounded-full bg-page p-1 text-caption font-semibold">
        {(['student', 'teacher'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => switchRole(r)}
            className={cn(
              'rounded-full py-2 transition-colors',
              role === r ? 'bg-surface text-primary-700 shadow-sm' : 'text-muted',
            )}
          >
            {r === 'student' ? '학생' : '교사'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
    </main>
  )
}
