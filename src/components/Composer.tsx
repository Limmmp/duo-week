import { useMemo, useRef, useState } from 'react'
import { CalendarDays, Clock, Flag, Maximize2 } from 'lucide-react'
import { useBoard, type TaskDefaults } from '../board/BoardContext'
import { tagColor } from '../lib/colors'
import { addDays, relativeDay, startOfWeek, toISODate } from '../lib/dates'
import { parseQuickAdd } from '../lib/parse'
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status } from '../types'
import { Avatar, MenuChip, MenuChipRow, MenuItem, MenuLabel, MenuSeparator, StatusDot } from './ui'

/**
 * Новое дело во всплывающем меню: сверху название, ниже — те же настройки, что в меню карточки.
 * Всё выбирается до добавления. В названии работают и метки быстрого ввода: @имя, #тег, !, завтра, 18:30.
 */
export function Composer({ defaults, onDone }: { defaults: TaskDefaults; onDone: () => void }) {
  const { data, today, todayISO, weekStart, addTask, openNew } = useBoard()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(defaults.title ?? '')
  const [status, setStatus] = useState<Status>(defaults.status ?? 'todo')
  const [due, setDue] = useState<string | null>(defaults.due ?? null)
  const [assignee, setAssignee] = useState<string | null>(defaults.assignee ?? null)
  const [priority, setPriority] = useState<Priority>(defaults.priority ?? 0)

  const base = weekStart > today ? weekStart : today
  const parsed = useMemo(
    () => parseQuickAdd(text, { today, base, members: data.members }),
    [text, today, base, data.members],
  )
  // Метка в тексте важнее кнопки: напечатал «@Max» — подсветится Max.
  const effDue = parsed.due !== undefined ? parsed.due : due
  const effAssignee = parsed.assignee !== undefined ? parsed.assignee : assignee
  const effPriority = parsed.priority ?? priority

  const draft = () => ({
    title: parsed.title,
    status,
    due: effDue,
    assignee: effAssignee,
    priority: effPriority,
    tags: parsed.tags,
    due_time: parsed.time ?? null,
  })

  function submit() {
    if (!parsed.title) {
      inputRef.current?.focus()
      return
    }
    addTask(draft())
    onDone()
  }

  const tomorrow = toISODate(addDays(today, 1))
  const nextMonday = toISODate(addDays(startOfWeek(today), 7))
  const dayValues = [...new Set([defaults.due ?? undefined, effDue ?? undefined, todayISO, tomorrow, nextMonday])]
    .filter((v): v is string => v !== undefined)
    .sort()
  const dayLabel = (v: string) => (v === nextMonday && v !== defaults.due ? 'След. пн' : relativeDay(v, todayISO))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="px-1 pt-1">
        <textarea
          ref={inputRef}
          data-autofocus
          rows={2}
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Что нужно сделать?"
          aria-label="Название нового дела"
          className="block w-full select-text resize-none rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm leading-snug text-ink outline-none placeholder:text-ink-3 focus:border-focus"
        />
        {(parsed.time || parsed.tags.length > 0) && (
          <div className="flex flex-wrap gap-1 pt-1.5">
            {parsed.time && (
              <span className="flex h-5 items-center gap-1 rounded-full bg-ink/[0.06] px-1.5 text-[11px] text-ink-2">
                <Clock size={11} aria-hidden />
                {parsed.time}
              </span>
            )}
            {parsed.tags.map((tag) => (
              <span key={tag} className="flex h-5 items-center gap-1 rounded-full bg-ink/[0.06] px-1.5 text-[11px] text-ink-2">
                <span className="size-1.5 rounded-full" style={{ background: tagColor(tag) }} aria-hidden />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <MenuLabel>Статус</MenuLabel>
      {(['todo', 'doing', 'done'] as Status[]).map((s) => (
        <MenuItem
          key={s}
          icon={<StatusDot status={s} size={14} />}
          label={STATUS_LABEL[s]}
          checked={status === s}
          onClick={() => setStatus(s)}
        />
      ))}

      <MenuLabel>День</MenuLabel>
      <MenuChipRow>
        {dayValues.map((v) => (
          <MenuChip key={v} active={effDue === v} onClick={() => setDue(v)}>
            {dayLabel(v)}
          </MenuChip>
        ))}
        <MenuChip active={effDue === null} onClick={() => setDue(null)}>
          Без даты
        </MenuChip>
        <span className="relative">
          <MenuChip
            active={false}
            onClick={() => {
              const input = dateRef.current
              if (!input) return
              try {
                input.showPicker()
              } catch {
                input.focus()
              }
            }}
          >
            <CalendarDays size={12} aria-hidden />
            Другая
          </MenuChip>
          {/* Невидимое поле даты под кнопкой — к нему привязывается системный календарь. */}
          <input
            ref={dateRef}
            type="date"
            tabIndex={-1}
            aria-label="Другая дата"
            value={effDue ?? ''}
            onChange={(e) => setDue(e.target.value || null)}
            className="pointer-events-none absolute inset-0 opacity-0"
          />
        </span>
      </MenuChipRow>

      <MenuLabel>Кто делает</MenuLabel>
      <MenuChipRow>
        {[...data.members, null].map((m) => (
          <MenuChip key={m?.id ?? 'both'} active={effAssignee === (m?.id ?? null)} onClick={() => setAssignee(m?.id ?? null)}>
            <Avatar member={m} size={16} />
            {m?.name ?? 'Вместе'}
          </MenuChip>
        ))}
      </MenuChipRow>

      <MenuLabel>Важность</MenuLabel>
      <MenuChipRow>
        {([0, 1, 2] as Priority[]).map((p) => (
          <MenuChip key={p} active={effPriority === p} onClick={() => setPriority(p)}>
            {p > 0 && <Flag size={11} fill="currentColor" className={p === 2 ? 'text-danger' : 'text-warn'} aria-hidden />}
            {PRIORITY_LABEL[p]}
          </MenuChip>
        ))}
      </MenuChipRow>

      <MenuSeparator />
      <div className="flex items-center gap-1.5 px-1 pb-0.5 pt-1">
        <button
          type="button"
          title="Заметка, чек-лист, время, теги"
          onClick={() => {
            onDone()
            openNew(draft())
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-ink/[0.06] hover:text-ink"
        >
          <Maximize2 size={14} aria-hidden />
          Подробнее
        </button>
        <button
          type="submit"
          disabled={!parsed.title}
          className="ml-auto h-9 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-35"
        >
          Добавить
        </button>
      </div>
    </form>
  )
}
