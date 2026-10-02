import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Link2, UserPlus } from 'lucide-react'
import { extractKey } from '../lib/storage'
import type { Member } from '../types'
import { Avatar } from './ui'

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <rect x="7" y="8" width="5" height="16" rx="2" fill="#eb6834" />
      <rect x="13.5" y="8" width="5" height="10" rx="2" fill="var(--page)" />
      <rect x="20" y="8" width="5" height="13" rx="2" fill="#9085e9" />
    </svg>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-pop animate-rise">{children}</div>
    </main>
  )
}

/** Первый вход: доска открывается только по ссылке-приглашению. */
export function KeyScreen({ error, onKey }: { error?: string; onKey: (key: string) => void }) {
  const [value, setValue] = useState('')
  const [formatError, setFormatError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const key = extractKey(value)
    if (!key) {
      setFormatError('Это не похоже на ссылку-приглашение. Скопируй её целиком — вместе с #k=…')
      return
    }
    onKey(key)
  }

  const message = formatError ?? error
  return (
    <Screen>
      <Logo size={40} />
      <h1 className="mt-4 text-xl font-bold">Неделя на двоих</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        Доска открывается по ссылке-приглашению. Открой ссылку, которую тебе прислали, или вставь её сюда.
      </p>
      <form onSubmit={submit} className="mt-5">
        <label htmlFor="invite" className="text-sm font-medium">
          Ссылка или код
        </label>
        <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-focus">
          <Link2 size={16} className="shrink-0 text-ink-3" aria-hidden />
          <input
            id="invite"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setFormatError(null)
            }}
            placeholder="https://…#k=…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!message}
            aria-describedby={message ? 'invite-error' : undefined}
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        {message && (
          <p id="invite-error" role="alert" className="mt-2 text-sm text-danger">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={!value.trim()}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent transition-opacity disabled:opacity-40"
        >
          Открыть доску
          <ArrowRight size={16} aria-hidden />
        </button>
      </form>
    </Screen>
  )
}

/** «Кто ты?» — один раз на устройстве, чтобы новые дела по умолчанию были твоими. */
export function WhoAmI({
  boardName,
  members,
  onPick,
  onCreate,
}: {
  boardName: string
  members: Member[]
  onPick: (id: string) => void
  onCreate: (name: string) => void
}) {
  const [adding, setAdding] = useState(members.length === 0)
  const [name, setName] = useState('')

  return (
    <Screen>
      <Logo size={40} />
      <h1 className="mt-4 text-xl font-bold">Кто ты?</h1>
      <p className="mt-1.5 text-sm text-ink-2">
        Доска «{boardName}». Выбор запомнится на этом устройстве — новые дела будут твоими по умолчанию.
      </p>
      <div className="mt-5 space-y-2">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m.id)}
            className="flex h-14 w-full items-center gap-3 rounded-xl border border-line px-3 text-left transition-colors hover:border-ink-3 hover:bg-surface-2"
          >
            <Avatar member={m} size={32} />
            <span className="flex-1 text-[15px] font-medium">{m.name}</span>
            <ArrowRight size={16} className="text-ink-3" aria-hidden />
          </button>
        ))}
      </div>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) onCreate(name.trim())
          }}
          className="mt-4"
        >
          <label htmlFor="my-name" className="text-sm font-medium">
            Как тебя подписывать
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="my-name"
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-base text-ink outline-none focus:border-focus"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
            >
              Готово
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm text-ink-2 hover:bg-ink/[0.05]"
        >
          <UserPlus size={16} aria-hidden />
          Меня нет в списке
        </button>
      )}
    </Screen>
  )
}

export function StatusScreen({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <Screen>
      <Logo size={40} />
      <h1 className="mt-4 text-lg font-bold">{title}</h1>
      <p className="mt-1.5 text-sm text-ink-2">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </Screen>
  )
}
