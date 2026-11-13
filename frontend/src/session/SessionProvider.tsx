import { useState, type ReactNode } from 'react'
import type { Session } from '../types/user'
import { loadSession, saveSession, SessionContext } from './session'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)

  const signIn = (next: Session) => {
    saveSession(next)
    setSession(next)
  }

  const signOut = () => {
    saveSession(null)
    setSession(null)
  }

  return <SessionContext.Provider value={{ session, signIn, signOut }}>{children}</SessionContext.Provider>
}
