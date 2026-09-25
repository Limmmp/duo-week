import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import type { Member, Task } from '../types'

type Props = {
  /** Нет задачи — окно создаёт новое дело со значениями из defaults. */
  task?: Task
  defaults?: Pick<Task, 'due' | 'assignee'>
  members: Member[]
  onClose: () => void
  onSave: (changes: Partial<Task>) => void
  onDelete?: () => void
}

export default function TaskDialog({ task, defaults, members, onClose, onSave, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [due, setDue] = useState(task?.due ?? defaults?.due ?? '')
  const [assignee, setAssignee] = useState<string | null>(task ? task.assignee : (defaults?.assignee ?? null))
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    ref.current?.showModal()
    // showModal() сам фокусирует первую кнопку — для нового дела сразу ставим курсор в название.
    if (!task) titleRef.current?.focus()
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), notes: notes.trim() || null, due: due || null, assignee })
  }

  const options = [...members.map((m) => ({ id: m.id as string | null, name: m.name, color: m.color })), { id: null, name: 'Вместе', color: '' }]

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <form onSubmit={submit} className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{task ? 'Дело' : 'Новое дело'}</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="-mr-2 grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
            <X size={18} />
          </button>
        </div>

        <label htmlFor="t-title" className="mt-3 block text-sm font-medium">Название</label>
        <input
          id="t-title"
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={300}
          className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-ink"
        />

        <label htmlFor="t-notes" className="mt-4 block text-sm font-medium">Заметка</label>
        <textarea
          id="t-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2 text-base outline-none focus:border-ink"
        />

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Кто делает</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {options.map((o) => (
              <button
                key={o.id ?? 'both'}
                type="button"
                aria-pressed={assignee === o.id}
                onClick={() => setAssignee(o.id)}
                className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
                  assignee === o.id ? 'border-ink bg-accent text-on-accent' : 'border-line hover:bg-surface-2'
                }`}
              >
                {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} />}
                {o.name}
              </button>
            ))}
          </div>
        </fieldset>

        <label htmlFor="t-due" className="mt-4 block text-sm font-medium">День</label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="t-due"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-ink"
          />
          <button type="button" onClick={() => setDue('')} disabled={!due} className="h-11 rounded-xl border border-line px-3 text-sm hover:bg-surface-2 disabled:opacity-40">
            Без даты
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {!onDelete ? null : confirmDelete ? (
            <button type="button" onClick={onDelete} className="h-11 rounded-xl bg-danger px-4 text-sm font-semibold text-white">
              Точно удалить
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Удалить дело"
              className="grid size-11 place-items-center rounded-xl text-danger hover:bg-surface-2"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button type="submit" className="ml-auto h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent hover:opacity-90">
            {task ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
