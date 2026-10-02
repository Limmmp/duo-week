import { useCallback, useMemo, useState } from 'react'
import { createSupabaseApi } from './api/supabase'
import { BoardRoot } from './components/Board'
import { KeyScreen } from './components/Onboarding'
import { ToastProvider } from './components/Toasts'
import { forgetBoardKey, initialBoardKey, rememberBoardKey } from './lib/storage'

export default function App() {
  const [key, setKey] = useState(() => initialBoardKey())
  const [denied, setDenied] = useState(false)
  const api = useMemo(() => (key ? createSupabaseApi(key) : null), [key])

  const onDenied = useCallback(() => {
    forgetBoardKey()
    setKey(null)
    setDenied(true)
  }, [])
  const onForget = useCallback(() => {
    forgetBoardKey()
    setKey(null)
    setDenied(false)
  }, [])

  if (!api) {
    return (
      <KeyScreen
        error={denied ? 'Доска по этой ссылке не найдена. Попроси прислать ссылку ещё раз.' : undefined}
        onKey={(k) => {
          rememberBoardKey(k)
          setDenied(false)
          setKey(k)
        }}
      />
    )
  }

  return (
    <ToastProvider>
      <BoardRoot key={key} api={api} onDenied={onDenied} onForget={onForget} />
    </ToastProvider>
  )
}
