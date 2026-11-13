import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { ROUTES } from '../routes'
import type { Session } from '../types/user'
import { useSession } from './session'

// 해당 역할로 입장하지 않았으면 입장 화면으로 보낸다.
export default function RequireRole({ role, children }: { role: Session['role']; children: ReactNode }) {
  const { session } = useSession()
  if (session?.role !== role) return <Navigate to={ROUTES.ROOT} replace />
  return children
}
