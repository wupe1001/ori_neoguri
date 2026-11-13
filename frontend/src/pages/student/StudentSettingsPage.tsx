import Button from '../../components/Button'
import Card from '../../components/Card'
import { classLabel } from '../../lib/format'
import { useSession, useStudent } from '../../session/session'

export default function StudentSettingsPage() {
  const student = useStudent()
  const { signOut } = useSession()

  return (
    <div className="flex flex-col gap-4">
      <h1>설정</h1>
      <Card title="내 정보">
        <p className="font-semibold">{student.nickname}</p>
        <p className="text-caption text-muted">
          {classLabel(student) ? `${classLabel(student)} · 익명으로 질문하면 학년·반만 보여요` : '로그인한 계정'}
        </p>
      </Card>
      <Button variant="secondary" fullWidth onClick={signOut}>
        나가기
      </Button>
    </div>
  )
}
