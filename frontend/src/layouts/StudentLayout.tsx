import { useCallback } from 'react'
import { getUnreadAnswerCount } from '../api/questions'
import { usePolling } from '../lib/usePolling'
import { ROUTES } from '../routes'
import { useStudent } from '../session/session'
import MobileLayout, { type Tab } from './MobileLayout'

export default function StudentLayout() {
  const student = useStudent()
  // 아직 확인하지 않은 선생님 답 수 → "내 질문" 뱃지
  const unread = usePolling(useCallback(() => getUnreadAnswerCount(student.id), [student.id]), 0)

  const tabs: Tab[] = [
    { to: ROUTES.STUDENT.HOME, label: '홈', end: true },
    { to: ROUTES.STUDENT.QUESTIONS, label: '내 질문', badge: unread },
    { to: ROUTES.STUDENT.NOTICES, label: '공지' },
    { to: ROUTES.STUDENT.SETTINGS, label: '설정' },
  ]
  return <MobileLayout tabs={tabs} />
}
