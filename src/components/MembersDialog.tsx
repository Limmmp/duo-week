import { useEffect, useRef, useState } from 'react'
import { Check, Copy, LogOut, Trash2, UserPlus, X } from 'lucide-react'
import { useBoard } from '../board/BoardContext'
import { PALETTE } from '../lib/colors'
import { inviteLink } from '../lib/storage'
import { useToast } from './toast-context'
import { Avatar } from './ui'
import { cx } from '../lib/cx'

/** Доска и участники: название, люди и их цвета, «это я», ссылка-приглашение. */
export function MembersDialog({
  boardKey,
  onSetMe,
  onForget,
  onClose,
}: {
  boardKey: string
  onSetMe: (id: string) => void
  onForget: () => void
  onClose: () => void
}) {
  const { data, me } = useBoard()
  const toast = useToast()
  const ref = useRef<HTMLDialogElement>(null)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const link = inviteLink(boardKey)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Не получилось скопировать — выдели ссылку и скопируй вручную')
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="members-heading"
      className="m-auto w-[min(520px,calc(100%-1.5rem))] max-w-none rounded-2xl bg-surface p-0 text-ink shadow-pop open:animate-pop"
    >
      <div className="flex max-h-[min(90dvh,760px)] flex-col">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="members-heading" className="text-base font-semibold">
            Доска и участники
          </h2>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => ref.current?.close()}
            className="-mr-2 grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-ink/[0.06] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-5 pt-4">
          <section>
            <label htmlFor="board-name" className="text-[13px] font-medium text-ink-2">
              Название доски
            </label>
            <input
              id="board-name"
              defaultValue={data.board?.name}
              maxLength={80}
              onBlur={(e) => {
                const name = e.target.value.trim()
                if (name && name !== data.board?.name) data.renameBoard(name)
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink outline-none focus:border-focus"
            />
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-ink-2">Участники</h3>
            <ul className="mt-2 space-y-2">
              {data.members.map((m) => (
                <li key={m.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar member={m} size={30} />
                    <input
                      defaultValue={m.name}
                      maxLength={40}
                      aria-label={`Имя участника ${m.name}`}
                      onBlur={(e) => {
                        const name = e.target.value.trim()
                        if (name && name !== m.name) data.updateMember(m.id, { name })
                        else e.target.value = m.name
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm font-medium text-ink outline-none hover:bg-ink/[0.04] focus:bg-surface-2"
                    />
                    {me?.id === m.id ? (
                      <span className="rounded-full bg-ink/[0.07] px-2 py-0.5 text-xs font-medium text-ink-2">это ты</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetMe(m.id)}
                        className="h-7 rounded-full px-2 text-xs text-ink-3 hover:bg-ink/[0.06] hover:text-ink"
                      >
                        это я
                      </button>
                    )}
                    {confirmDelete === m.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          data.deleteMember(m.id)
                          setConfirmDelete(null)
                        }}
                        className="h-8 rounded-lg bg-danger px-2.5 text-xs font-semibold text-white"
                      >
                        Удалить?
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Удалить ${m.name}`}
                        title="Удалить участника — его дела станут общими"
                        onClick={() => setConfirmDelete(m.id)}
                        className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-ink/[0.06] hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div role="radiogroup" aria-label={`Цвет ${m.name}`} className="mt-2.5 flex flex-wrap gap-1.5 pl-10">
                    {PALETTE.map((p) => (
                      <button
                        key={p.light}
                        type="button"
                        role="radio"
                        aria-checked={m.color === p.light}
                        aria-label={p.name}
                        title={p.name}
                        onClick={() => data.updateMember(m.id, { color: p.light })}
                        style={{ background: `light-dark(${p.light}, ${p.dark})` }}
                        className={cx(
                          'grid size-6 place-items-center rounded-full text-white transition-transform hover:scale-110',
                          m.color === p.light && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
                        )}
                      >
                        {m.color === p.light && <Check size={12} strokeWidth={3} aria-hidden />}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newName.trim()) return
                data.createMember(newName.trim())
                setNewName('')
              }}
              className="mt-2 flex gap-2"
            >
              <input
                value={newName}
                maxLength={40}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Имя нового участника"
                aria-label="Имя нового участника"
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-focus"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-on-accent disabled:opacity-40"
              >
                <UserPlus size={15} aria-hidden />
                Добавить
              </button>
            </form>
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-ink-2">Ссылка-приглашение</h3>
            <p className="mt-1 text-xs text-ink-3">Кто откроет её — увидит и сможет менять доску. Отправляй только своим.</p>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Ссылка-приглашение"
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-xs text-ink-2 outline-none"
              />
              <button
                type="button"
                onClick={copy}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-ink/[0.05]"
              >
                {copied ? <Check size={15} className="text-done" aria-hidden /> : <Copy size={15} aria-hidden />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </section>

          <section className="border-t border-line pt-4">
            <button
              type="button"
              onClick={onForget}
              className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-ink-2 hover:bg-ink/[0.05] hover:text-danger"
            >
              <LogOut size={15} aria-hidden />
              Забыть доску на этом устройстве
            </button>
          </section>
        </div>
      </div>
    </dialog>
  )
}
