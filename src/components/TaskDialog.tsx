import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import {
  AlignLeft,
  CalendarDays,
  Check,
  CircleDot,
  Clock,
  Copy,
  Flag,
  Hash,
  ListChecks,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useBoard, type TaskDefaults } from '../board/BoardContext'
import { addDays, shortDate, toISODate } from '../lib/dates'
import { tagColor } from '../lib/colors'
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type ChecklistItem,
  type Priority,
  type Status,
  type Task,
  type TaskPatch,
} from '../types'
import { Avatar, StatusDot } from './ui'
import { cx } from '../lib/cx'

type Draft = {
  title: string
  notes: string
  due: string
  time: string
  assignee: string | null
  status: Status
  priority: Priority
  tags: string[]
  checklist: ChecklistItem[]
}

const NEXT_STATUS: Record<Status, Status> = { todo: 'doing', doing: 'done', done: 'todo' }

function toDraft(task?: Task, d?: TaskDefaults): Draft {
  return {
    title: task?.title ?? d?.title ?? '',
    notes: task?.notes ?? d?.notes ?? '',
    due: (task ? task.due : d?.due) ?? '',
    time: (task?.due_time ?? d?.due_time ?? '').slice(0, 5),
    assignee: task ? task.assignee : (d?.assignee ?? null),
    status: task?.status ?? d?.status ?? 'todo',
    priority: task?.priority ?? d?.priority ?? 0,
    tags: task?.tags ?? d?.tags ?? [],
    checklist: task?.checklist ?? d?.checklist ?? [],
  }
}

function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}

/** Полная карточка дела: и создание, и правка. Ctrl+Enter — сохранить, Esc — закрыть (с вопросом, если есть правки). */
export function TaskDialog({ task, defaults, onClose }: { task?: Task; defaults?: TaskDefaults; onClose: () => void }) {
  const { data, todayISO, addTask, updateTask, moveTask, removeTask, duplicateTask } = useBoard()
  const ref = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [initial] = useState(() => toDraft(task, defaults))
  const [draft, setDraft] = useState(initial)
  const [confirmClose, setConfirmClose] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  useAutosize(titleRef, draft.title)
  useAutosize(notesRef, draft.notes)

  useEffect(() => {
    ref.current?.showModal()
    if (!task) titleRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- окно открывается один раз
  }, [])

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setConfirmClose(false)
  }
  const close = () => ref.current?.close()
  const attemptClose = () => (dirty && !confirmClose ? setConfirmClose(true) : close())

  function save(e?: FormEvent) {
    e?.preventDefault()
    const title = draft.title.trim()
    if (!title) {
      titleRef.current?.focus()
      return
    }
    const fields = {
      title,
      notes: draft.notes.trim() || null,
      due: draft.due || null,
      due_time: draft.time || null,
      assignee: draft.assignee,
      status: draft.status,
      priority: draft.priority,
      tags: draft.tags,
      checklist: draft.checklist.filter((c) => c.text.trim()).map((c) => ({ ...c, text: c.text.trim() })),
    }
    if (!task) {
      addTask(fields)
    } else {
      // В базу уходят только изменённые поля (время из Postgres приходит как HH:MM:SS).
      const before = { ...task, due_time: task.due_time?.slice(0, 5) ?? null }
      const patch: TaskPatch = {}
      for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
        if (JSON.stringify(fields[key]) !== JSON.stringify(before[key])) Object.assign(patch, { [key]: fields[key] })
      }
      if ('due' in patch || 'status' in patch || 'assignee' in patch) moveTask(task, patch)
      else if (Object.keys(patch).length) updateTask(task.id, patch)
    }
    close()
  }

  const tomorrowISO = toISODate(addDays(new Date(), 1))
  const allTags = [...new Set(data.tasks.flatMap((t) => t.tags))].filter((t) => !draft.tags.includes(t))

  return (
    <dialog
      ref={ref}
      aria-labelledby="task-dialog-heading"
      onCancel={(e) => {
        e.preventDefault()
        attemptClose()
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) attemptClose()
      }}
      className="m-auto w-[min(640px,calc(100%-1.5rem))] max-w-none rounded-2xl bg-surface p-0 text-ink shadow-pop open:animate-pop max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none"
    >
      <form
        onSubmit={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            save()
          }
        }}
        className="flex max-h-[min(92dvh,880px)] flex-col"
      >
        <h2 id="task-dialog-heading" className="sr-only">
          {task ? 'Дело' : 'Новое дело'}
        </h2>
        <div className="flex items-start gap-3 px-5 pt-5">
          <button
            type="button"
            title={`${STATUS_LABEL[draft.status]} — нажми, чтобы сменить`}
            aria-label={`Статус: ${STATUS_LABEL[draft.status]}. Сменить`}
            onClick={() => set({ status: NEXT_STATUS[draft.status] })}
            className="-m-1 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full hover:bg-ink/[0.06]"
          >
            <StatusDot status={draft.status} size={20} />
          </button>
          <textarea
            ref={titleRef}
            rows={1}
            value={draft.title}
            maxLength={300}
            aria-label="Название"
            placeholder="Что нужно сделать?"
            onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault()
                save()
              }
            }}
            className={cx(
              'min-w-0 flex-1 resize-none bg-transparent text-lg font-medium leading-snug outline-none placeholder:text-ink-3',
              draft.status === 'done' && 'text-ink-2 line-through decoration-ink-3/50',
            )}
          />
          <button
            type="button"
            aria-label="Закрыть"
            onClick={attemptClose}
            className="-mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-ink/[0.06] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          <dl className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-sm sm:grid-cols-[104px_minmax(0,1fr)]">
            <Prop icon={<CircleDot size={14} />} label="Статус">
              <Choices
                label="Статус"
                value={draft.status}
                onChange={(status) => set({ status })}
                options={(['todo', 'doing', 'done'] as const).map((s) => ({
                  value: s,
                  label: (
                    <>
                      <StatusDot status={s} size={13} />
                      {STATUS_LABEL[s]}
                    </>
                  ),
                }))}
              />
            </Prop>

            <Prop icon={<User size={14} />} label="Кто">
              <Choices
                label="Кто делает"
                value={draft.assignee ?? 'both'}
                onChange={(v) => set({ assignee: v === 'both' ? null : v })}
                options={[
                  ...data.members.map((m) => ({
                    value: m.id,
                    label: (
                      <>
                        <Avatar member={m} size={18} />
                        {m.name}
                      </>
                    ),
                  })),
                  {
                    value: 'both',
                    label: (
                      <>
                        <Avatar member={null} size={18} />
                        Вместе
                      </>
                    ),
                  },
                ]}
              />
            </Prop>

            <Prop icon={<CalendarDays size={14} />} label="День">
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  value={draft.due}
                  onChange={(e) => set({ due: e.target.value })}
                  aria-label="Дата"
                  className="h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-ink outline-none focus:border-focus"
                />
                <QuickChip active={draft.due === todayISO} onClick={() => set({ due: todayISO })}>
                  Сегодня
                </QuickChip>
                <QuickChip active={draft.due === tomorrowISO} onClick={() => set({ due: tomorrowISO })}>
                  Завтра
                </QuickChip>
                <QuickChip active={!draft.due} onClick={() => set({ due: '' })}>
                  Без даты
                </QuickChip>
              </div>
            </Prop>

            <Prop icon={<Clock size={14} />} label="Время">
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => set({ time: e.target.value })}
                  aria-label="Время"
                  className="h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-ink outline-none focus:border-focus"
                />
                {draft.time && (
                  <QuickChip active={false} onClick={() => set({ time: '' })}>
                    Убрать
                  </QuickChip>
                )}
              </div>
            </Prop>

            <Prop icon={<Flag size={14} />} label="Важность">
              <Choices
                label="Важность"
                value={draft.priority}
                onChange={(priority) => set({ priority })}
                options={([0, 1, 2] as const).map((p) => ({
                  value: p,
                  label: (
                    <>
                      {p > 0 && (
                        <Flag
                          size={12}
                          fill="currentColor"
                          className={p === 2 ? 'text-danger' : 'text-warn'}
                          aria-hidden
                        />
                      )}
                      {PRIORITY_LABEL[p]}
                    </>
                  ),
                }))}
              />
            </Prop>

            <Prop icon={<Hash size={14} />} label="Теги">
              <TagInput tags={draft.tags} suggestions={allTags} onChange={(tags) => set({ tags })} />
            </Prop>
          </dl>

          <section className="mt-5">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
              <AlignLeft size={14} aria-hidden /> Заметка
            </h3>
            <textarea
              ref={notesRef}
              rows={3}
              value={draft.notes}
              maxLength={5000}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Подробности, ссылки, адрес…"
              aria-label="Заметка"
              className="block min-h-20 w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-focus"
            />
          </section>

          <Checklist items={draft.checklist} onChange={(checklist) => set({ checklist })} />
        </div>

        {confirmClose && (
          <div role="alert" className="flex flex-wrap items-center gap-2 border-t border-line bg-warn/10 px-5 py-2.5 text-sm">
            <span className="mr-auto">Есть несохранённые изменения.</span>
            <button type="button" onClick={close} className="h-8 rounded-lg px-2.5 text-ink-2 hover:bg-ink/[0.06]">
              Не сохранять
            </button>
            <button type="submit" className="h-8 rounded-lg bg-accent px-3 font-medium text-on-accent">
              Сохранить
            </button>
          </div>
        )}

        <footer className="flex items-center gap-1.5 border-t border-line px-5 py-3">
          {task && (
            <>
              <FooterIcon
                label="Удалить"
                danger
                onClick={() => {
                  removeTask(task)
                  close()
                }}
              >
                <Trash2 size={17} />
              </FooterIcon>
              <FooterIcon
                label="Дублировать"
                onClick={() => {
                  duplicateTask(task)
                  close()
                }}
              >
                <Copy size={17} />
              </FooterIcon>
              {task.created_at && (
                <span className="ml-1 hidden text-xs text-ink-3 sm:inline">
                  создано {shortDate(new Date(task.created_at))}
                </span>
              )}
            </>
          )}
          <span className="ml-auto hidden text-xs text-ink-3 md:inline">Ctrl+Enter — сохранить</span>
          <button
            type="button"
            onClick={attemptClose}
            className="ml-auto h-10 rounded-lg px-3 text-sm text-ink-2 hover:bg-ink/[0.06] md:ml-2"
          >
            Отмена
          </button>
          <button type="submit" className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent">
            {task ? 'Сохранить' : 'Добавить'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}

function Prop({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-1.5 self-start pt-2 text-[13px] text-ink-3">
        {icon}
        {label}
      </dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  )
}

function Choices<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors duration-150',
            value === o.value
              ? 'border-ink bg-ink/[0.06] font-medium text-ink'
              : 'border-line text-ink-2 hover:border-line-strong hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function QuickChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'h-9 rounded-lg px-2.5 text-[13px] transition-colors',
        active ? 'bg-ink/[0.08] font-medium text-ink' : 'text-ink-2 hover:bg-ink/[0.06] hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function FooterIcon({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'grid size-10 place-items-center rounded-lg hover:bg-ink/[0.06]',
        danger ? 'text-danger' : 'text-ink-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function TagInput({
  tags,
  suggestions,
  onChange,
}: {
  tags: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
}) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const tag = raw.trim().replace(/^#+/, '').toLowerCase()
    if (tag && !tags.includes(tag) && tags.length < 12) onChange([...tags, tag])
    setText('')
  }
  const matching = suggestions.filter((s) => s.startsWith(text.trim().replace(/^#+/, '').toLowerCase())).slice(0, 6)

  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 focus-within:border-focus">
        {tags.map((tag) => (
          <span key={tag} className="flex h-6 items-center gap-1 rounded-full bg-surface pl-2 pr-1 text-xs shadow-card">
            <span className="size-1.5 rounded-full" style={{ background: tagColor(tag) }} aria-hidden />
            {tag}
            <button
              type="button"
              aria-label={`Убрать тег ${tag}`}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="grid size-4 place-items-center rounded-full text-ink-3 hover:bg-ink/10 hover:text-ink"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value
            if (/[,\s]$/.test(v)) add(v.slice(0, -1))
            else setText(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            }
            if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1))
          }}
          onBlur={() => text && add(text)}
          placeholder={tags.length ? '' : 'дом, работа…'}
          aria-label="Новый тег"
          className="h-7 min-w-20 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      {matching.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-ink-3">
          {matching.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="flex h-6 items-center gap-1 rounded-full px-1.5 hover:bg-ink/[0.06] hover:text-ink"
            >
              <span className="size-1.5 rounded-full" style={{ background: tagColor(tag) }} aria-hidden />+{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Checklist({ items, onChange }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const [text, setText] = useState('')
  const addRef = useRef<HTMLInputElement>(null)
  const done = items.filter((i) => i.done).length
  const update = (id: string, patch: Partial<ChecklistItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  return (
    <section className="mt-5">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
        <ListChecks size={14} aria-hidden /> Чек-лист
        {items.length > 0 && (
          <span className="ml-1 font-normal tabular-nums text-ink-3">
            {done}/{items.length}
          </span>
        )}
      </h3>
      {items.length > 0 && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-done/20" aria-hidden>
          <div
            className="h-full rounded-full bg-done transition-[width] duration-300"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id} className="group/item flex items-center gap-2 rounded-lg px-1 hover:bg-ink/[0.03]">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={item.done ? 'Снять отметку' : 'Отметить пункт'}
              onClick={() => update(item.id, { done: !item.done })}
              className={cx(
                'grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors',
                item.done ? 'border-done bg-done text-white' : 'border-ink-3/60 hover:border-ink-2',
              )}
            >
              {item.done && <Check size={12} strokeWidth={3} aria-hidden />}
            </button>
            <input
              value={item.text}
              onChange={(e) => update(item.id, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRef.current?.focus()
                }
                if (e.key === 'Backspace' && !item.text) {
                  e.preventDefault()
                  onChange(items.filter((i) => i.id !== item.id))
                  addRef.current?.focus()
                }
              }}
              aria-label="Пункт чек-листа"
              className={cx(
                'h-8 min-w-0 flex-1 bg-transparent text-sm outline-none',
                item.done ? 'text-ink-3 line-through' : 'text-ink',
              )}
            />
            <button
              type="button"
              aria-label="Удалить пункт"
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
              className="grid size-7 place-items-center rounded-md text-ink-3 opacity-0 hover:bg-ink/[0.07] hover:text-ink focus-visible:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-center gap-2 px-1">
        <Plus size={16} className="shrink-0 text-ink-3" aria-hidden />
        <input
          ref={addRef}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (!text.trim()) return
              onChange([...items, { id: crypto.randomUUID(), text: text.trim(), done: false }])
              setText('')
            }
          }}
          placeholder="Добавить пункт — Enter"
          aria-label="Новый пункт чек-листа"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
      </div>
    </section>
  )
}
