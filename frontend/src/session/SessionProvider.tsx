import { useEffect, useState, type ReactNode } from 'react'
import { logout } from '../api/auth'
import { UNAUTHORIZED_EVENT } from '../api/client'
import type { Session } from '../types/user'
import { loadSession, saveSession, SessionContext } from './session'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)

  const signIn = (next: Session) => {
    saveSession(next)
    setSession(next)
  }

  const clear = () => {
    saveSession(null)
    setSession(null)
  }

  // 나가기: 백엔드 세션도 함께 끝낸다
  const signOut = () => {
    logout()
    clear()
  }

  // 백엔드 로그인이 풀리면(401) 입장 화면으로 돌아간다
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, clear)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, clear)
  }, [])

  return <SessionContext.Provider value={{ session, signIn, signOut }}>{children}</SessionContext.Provider>
}
