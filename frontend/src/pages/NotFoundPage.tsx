import { Link } from 'react-router'
import { ROUTES } from '../routes'

export default function NotFoundPage() {
  return (
    <main className="role-select">
      <h1>페이지를 찾을 수 없어요</h1>
      <Link to={ROUTES.ROOT}>처음으로</Link>
    </main>
  )
}
