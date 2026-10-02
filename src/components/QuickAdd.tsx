import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { CalendarDays, Clock, CornerDownLeft, Flag, HelpCircle, Plus } from 'lucide-react'
import { useBoard } from '../board/BoardContext'
import { addDays, relativeDay } from '../lib/dates'
import { tagColor } from '../lib/colors'
import { parseQuickAdd } from '../lib/parse'
import { PRIORITY_LABEL } from '../types'
import { Avatar, Kbd, Popover, type Anchor } from './ui'
import { cx } from '../lib/cx'

/** Строка быстрого добавления с разбором «завтра в 18:00 @Max #дом !» и живыми подсказками. */
export function QuickAdd({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const { data, today, todayISO, weekStart, me, filters, memberById, addTask, openNew } = useBoard()
  const [value, setValue] = useState('')
  const [help, setHelp] = useState<Anchor | null>(null)
  const helpButton = useRef<HTMLButtonElement>(null)

  const isCurrentWeek = today >= weekStart && today < addDays(weekStart, 7)
  const parsed = useMemo(
    () => parseQuickAdd(value, { today, base: isCurrentWeek ? today : weekStart, members: data.members }),
    [value, today, weekStart, isCurrentWeek, data.members],
  )
  const due = parsed.due !== undefined ? parsed.due : isCurrentWeek ? todayISO : null
  const assignee =
    parsed.assignee !== undefined ? parsed.assignee : filters.person !== 'all' ? filters.person : (me?.id ?? null)
  const who = assignee ? (memberById.get(assignee) ?? null) : null

  function submit(details: boolean) {
    if (!parsed.title) return
    const draft = {
      title: parsed.title,
      due,
      assignee,
      due_time: parsed.time ?? null,
      priority: parsed.priority ?? 0,
      tags: parsed.tags,
    }
    if (details) openNew(draft)
    else addTask(draft)
    setValue('')
  }

  return (
    <div className="rounded-xl bg-surface shadow-card transition-shadow focus-within:shadow-card-hover focus-within:ring-2 focus-within:ring-focus/30">
      <div className="flex items-center gap-2 pl-3 pr-1.5">
        <Plus size={18} className="shrink-0 text-ink-3" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          maxLength={300}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit(e.shiftKey)
            }
            if (e.key === 'Escape') {
              setValue('')
              e.currentTarget.blur()
            }
          }}
          aria-label="Быстро добавить дело"
          placeholder="Новое дело — например «Созвон завтра в 18:00 @Max #работа !»"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        {!value && (
          <span className="hidden items-center gap-1 text-xs text-ink-3 sm:flex">
            <Kbd>N</Kbd>
          </span>
        )}
        <button
          ref={helpButton}
          type="button"
          aria-label="Как писать быстро"
          title="Как писать быстро"
          onClick={(e) => setHelp(help ? null : e.currentTarget.getBoundingClientRect())}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-ink/[0.06] hover:text-ink"
        >
          <HelpCircle size={17} />
        </button>
        <button
          type="button"
          disabled={!parsed.title}
          onClick={() => submit(false)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-on-accent transition-opacity disabled:opacity-35"
        >
          Добавить
          <CornerDownLeft size={14} className="hidden opacity-70 sm:block" aria-hidden />
        </button>
      </div>

      {value.trim() && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2 animate-fade">
          <Chip explicit={parsed.due !== undefined} icon={<CalendarDays size={12} />}>
            {relativeDay(due, todayISO)}
          </Chip>
          {parsed.time && (
            <Chip explicit icon={<Clock size={12} />}>
              {parsed.time}
            </Chip>
          )}
          <Chip explicit={parsed.assignee !== undefined} icon={<Avatar member={who} size={16} />}>
            {who?.name ?? 'Вместе'}
          </Chip>
          {parsed.priority !== undefined && (
            <Chip
              explicit
              icon={<Flag size={12} fill="currentColor" className={parsed.priority === 2 ? 'text-danger' : 'text-warn'} />}
            >
              {PRIORITY_LABEL[parsed.priority]}
            </Chip>
          )}
          {parsed.tags.map((tag) => (
            <Chip key={tag} explicit icon={<span className="size-1.5 rounded-full" style={{ background: tagColor(tag) }} />}>
              {tag}
            </Chip>
          ))}
          <span className="ml-auto hidden text-xs text-ink-3 md:inline">
            Enter — добавить · Shift+Enter — подробнее
          </span>
        </div>
      )}

      {help && (
        <Popover
          anchor={help}
          onClose={() => setHelp(null)}
          ignoreRef={helpButton}
          label="Подсказка по быстрому вводу"
          width={320}
        >
          <div className="space-y-2 p-2 text-[13px] text-ink-2">
            <p className="font-medium text-ink">Пиши как в заметке — остальное разберу сам</p>
            <HelpRow code="@Max">кто делает, «@вместе» — общее</HelpRow>
            <HelpRow code="#дом">тег, можно несколько</HelpRow>
            <HelpRow code="! / !!">важно / срочно</HelpRow>
            <HelpRow code="завтра, пт, 12.10">день; «без даты» — в отдельную колонку</HelpRow>
            <HelpRow code="18:30">время</HelpRow>
            <p className="border-t border-line pt-2 text-xs text-ink-3">
              Enter — добавить, Shift+Enter — открыть полную форму. Клавиша N — сразу сюда.
            </p>
          </div>
        </Popover>
      )}
    </div>
  )
}

function Chip({ explicit, icon, children }: { explicit: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <span
      title={explicit ? 'Распознано из текста' : 'По умолчанию'}
      className={cx(
        'flex h-6 items-center gap-1.5 rounded-full px-2 text-xs',
        explicit ? 'bg-ink/[0.07] font-medium text-ink' : 'border border-dashed border-line-strong text-ink-3',
      )}
    >
      <span className="grid place-items-center">{icon}</span>
      {children}
    </span>
  )
}

function HelpRow({ code, children }: { code: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <code className="shrink-0 rounded bg-ink/[0.06] px-1.5 text-xs leading-5 text-ink">{code}</code>
      <span className="leading-5">{children}</span>
    </div>
  )
}
