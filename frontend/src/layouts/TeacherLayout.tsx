import { ROUTES } from '../routes'
import MobileLayout, { type Tab } from './MobileLayout'

// 메뉴가 6개라 설정은 탭바 대신 상단 오른쪽에 둔다.
const tabs: Tab[] = [
  { to: ROUTES.TEACHER.HOME, label: '홈', end: true },
  { to: ROUTES.TEACHER.INBOX, label: '질문함' },
  { to: ROUTES.TEACHER.CLUSTERS, label: '질문 묶음' },
  { to: ROUTES.TEACHER.NOTICES, label: '공지' },
  { to: ROUTES.TEACHER.KNOWLEDGE, label: '저장소' },
]

export default function TeacherLayout() {
  return <MobileLayout tabs={tabs} settingsTo={ROUTES.TEACHER.SETTINGS} />
}
