import { Link } from 'react-router'
import { ROUTES } from '../routes'

export default function NotFoundPage() {
  return (
    <main className="flex flex-col items-center gap-4 px-4 py-20">
      <h1>페이지를 찾을 수 없어요</h1>
      <Link to={ROUTES.ROOT} className="text-primary-700">
        처음으로
      </Link>
    </main>
  )
}
