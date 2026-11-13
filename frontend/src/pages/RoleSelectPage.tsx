import { Link } from 'react-router'
import { ROUTES } from '../routes'

// 시연용: 학생/교사 화면을 골라 들어간다.
export default function RoleSelectPage() {
  return (
    <main className="role-select">
      <h1>오리너구리</h1>
      <Link to={ROUTES.STUDENT.HOME}>학생으로 시작</Link>
      <Link to={ROUTES.TEACHER.HOME}>교사로 시작</Link>
    </main>
  )
}
