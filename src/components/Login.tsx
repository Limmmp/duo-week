import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const creds = { email: email.trim(), password }
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword(creds)
        : await supabase.auth.signUp({ ...creds, options: { emailRedirectTo: location.href } })
    setBusy(false)
    if (error) {
      setError(
        error.message.includes('Invalid login')
          ? 'Неверная почта или пароль.'
          : error.message.includes('not confirmed')
            ? 'Почта не подтверждена — проверь письмо от Supabase.'
            : error.message,
      )
    } else if (mode === 'up' && !data.session) {
      setInfo('Готово! Открой письмо и подтверди почту, потом войди.')
      setMode('in')
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6"
      >
        <h1 className="text-xl font-semibold">Неделя на двоих</h1>
        <p className="mt-1 text-sm text-ink-2">Общая доска дел по дням недели.</p>

        <label htmlFor="email" className="mt-6 block text-sm font-medium">
          Почта
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-ink"
        />

        <label htmlFor="password" className="mt-4 block text-sm font-medium">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-ink"
        />
        {mode === 'up' && <p className="mt-1.5 text-xs text-ink-3">Минимум 6 символов.</p>}

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
        {info && (
          <p aria-live="polite" className="mt-4 text-sm text-ink-2">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Секунду…' : mode === 'in' ? 'Войти' : 'Зарегистрироваться'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setError(null)
          }}
          className="mt-3 h-11 w-full rounded-xl text-sm text-ink-2 hover:bg-surface-2"
        >
          {mode === 'in' ? 'Первый раз? Создать аккаунт' : 'Уже есть аккаунт? Войти'}
        </button>
      </form>
    </div>
  )
}
