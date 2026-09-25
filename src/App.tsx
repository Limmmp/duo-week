import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Board from './components/Board'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [isMember, setIsMember] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setIsMember(undefined)
    supabase.rpc('is_member').then(({ data }) => setIsMember(Boolean(data)))
  }, [session?.user.id])

  if (session === undefined || (session && isMember === undefined)) {
    return <div className="grid min-h-dvh place-items-center text-ink-3">Загрузка…</div>
  }
  if (!session) return <Login />
  if (!isMember) {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold">Нет доступа к доске</h1>
          <p className="mt-2 text-sm text-ink-2">
            Адрес <b>{session.user.email}</b> пока не добавлен в участники. Попроси владельца доски
            добавить его.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-5 h-11 w-full rounded-xl border border-line text-sm font-medium hover:bg-surface-2"
          >
            Выйти
          </button>
        </div>
      </div>
    )
  }
  return <Board userEmail={session.user.email ?? ''} />
}
