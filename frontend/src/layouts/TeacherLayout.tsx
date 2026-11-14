import { useCallback } from 'react'
import { getTeacherUnreadCount } from '../api/questions'
import { usePolling } from '../lib/usePolling'
import { ROUTES } from '../routes'
import { useTeacher } from '../session/session'
import MobileLayout, { type Tab } from './MobileLayout'

// 메뉴가 6개라 설정은 탭바 대신 상단 오른쪽에 둔다.
export default function TeacherLayout() {
  const teacher = useTeacher()
  // 아직 열어보지 않은 배정 질문 수 → "홈" 뱃지 (질문함이 홈에 있다)
  const unread = usePolling(useCallback(() => getTeacherUnreadCount(teacher), [teacher]), 0)

  const tabs: Tab[] = [
    { to: ROUTES.TEACHER.HOME, label: '홈', end: true, badge: unread },
    { to: ROUTES.TEACHER.CLUSTERS, label: '질문 묶음' },
    { to: ROUTES.TEACHER.NOTICES, label: '공지' },
    { to: ROUTES.TEACHER.KNOWLEDGE, label: '저장소' },
  ]
  return <MobileLayout tabs={tabs} settingsTo={ROUTES.TEACHER.SETTINGS} />
}
