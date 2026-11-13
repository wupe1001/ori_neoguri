import { ROUTES } from '../routes'
import MobileLayout, { type Tab } from './MobileLayout'

const tabs: Tab[] = [
  { to: ROUTES.STUDENT.HOME, label: '홈', end: true },
  { to: ROUTES.STUDENT.QUESTIONS, label: '내 질문' },
  { to: ROUTES.STUDENT.NOTICES, label: '공지' },
  { to: ROUTES.STUDENT.SETTINGS, label: '설정' },
]

export default function StudentLayout() {
  return <MobileLayout tabs={tabs} />
}
