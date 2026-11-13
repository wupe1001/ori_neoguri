import Button from '../../components/Button'
import Card from '../../components/Card'
import { useSession, useTeacher } from '../../session/session'

export default function TeacherSettingsPage() {
  const teacher = useTeacher()
  const { signOut } = useSession()

  return (
    <div className="flex flex-col gap-4">
      <h1>설정</h1>
      <Card title="담당 (질문이 오는 기준)">
        <p className="font-semibold">{teacher.name} 선생님</p>
        <ul className="mt-1 text-caption text-muted">
          <li>담당 과목: {teacher.subjects.length ? teacher.subjects.join(', ') : '없음'}</li>
          <li>담임: {teacher.homeroom ? `${teacher.homeroom.grade}학년 ${teacher.homeroom.classNo}반` : '없음'}</li>
          <li>부서: {teacher.department ?? '없음'}</li>
        </ul>
      </Card>
      <Button variant="secondary" fullWidth onClick={signOut}>
        나가기
      </Button>
    </div>
  )
}
