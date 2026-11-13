import { createContext, useContext } from 'react'
import type { Session, Student, Teacher } from '../types/user'

// 입장 정보는 sessionStorage에 저장한다.
// 탭마다 따로 저장되므로 한 탭은 학생, 다른 탭은 교사로 동시에 시연할 수 있다.
const KEY = 'neoguri-session'

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session))
    else sessionStorage.removeItem(KEY)
  } catch {
    // 저장 실패는 무시 (이번 탭에서만 유지된다)
  }
}

type SessionContextValue = {
  session: Session | null
  signIn: (session: Session) => void
  signOut: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('SessionProvider 안에서만 쓸 수 있어요.')
  return value
}

// 학생 화면(StudentLayout 안)에서 쓴다. 레이아웃이 입장 여부를 확인하므로 항상 값이 있다.
export function useStudent(): Student {
  const { session } = useSession()
  if (session?.role !== 'student') throw new Error('학생으로 입장하지 않았어요.')
  return session.user
}

// 교사 화면(TeacherLayout 안)에서 쓴다.
export function useTeacher(): Teacher {
  const { session } = useSession()
  if (session?.role !== 'teacher') throw new Error('교사로 입장하지 않았어요.')
  return session.user
}
