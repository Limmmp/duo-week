import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlignLeft, Clock, Flag, Hourglass, ListChecks, MoreHorizontal } from 'lucide-react'
import { useBoard } from '../board/BoardContext'
import { diffDays, formatTime, relativeDay } from '../lib/dates'
import { memberColor, tagColor } from '../lib/colors'
import { PRIORITY_LABEL, type Task } from '../types'
import { Avatar, StatusDot } from './ui'
import { cx } from '../lib/cx'

/** Пробел/Enter на кнопке внутри карточки не должны всплывать до карточки (там старт перетаскивания). */
const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation()

type BodyProps = {
  task: Task
  overlay?: boolean
  placeholder?: boolean
}

/** Внешний вид карточки. Без dnd-логики — тот же компонент рисуется и в DragOverlay. */
export function CardBody({ task, overlay, placeholder }: BodyProps) {
  const { memberById, todayISO, view, toggleDone, openCardMenu, setFilters, filters } = useBoard()
  const who = task.assignee ? (memberById.get(task.assignee) ?? null) : null
  const done = task.status === 'done'
  const lateDays = !done && task.due && task.due < todayISO ? diffDays(todayISO, task.due) : 0
  const time = formatTime(task.due_time)
  const checklistDone = task.checklist.filter((c) => c.done).length
  const showDay = view === 'status' || lateDays > 0

  return (
    <div
      className={cx(
        'group/card relative rounded-lg bg-surface px-2.5 pb-2.5 pt-2 text-left transition-shadow duration-150',
        overlay ? 'rotate-[1.5deg] cursor-grabbing shadow-lift' : 'shadow-card hover:shadow-card-hover',
        placeholder && 'bg-transparent shadow-none outline-2 outline-dashed outline-ink/20 *:invisible',
      )}
    >
      <div className="flex h-4 items-center gap-1.5">
        <span
          aria-hidden
          className="h-[3px] w-8 rounded-full"
          style={{ background: who ? memberColor(who.color) : 'var(--todo)' }}
        />
        {task.priority > 0 && (
          <span
            title={PRIORITY_LABEL[task.priority]}
            className={cx(
              'flex items-center gap-0.5 text-[11px] font-medium',
              task.priority === 2 ? 'text-danger' : 'text-warn',
            )}
          >
            <Flag size={11} strokeWidth={2.5} fill="currentColor" aria-hidden />
            <span className="text-ink-2">{PRIORITY_LABEL[task.priority]}</span>
          </span>
        )}
        <button
          type="button"
          aria-label="Действия с делом"
          onKeyDown={stopKeys}
          onClick={(e) => {
            e.stopPropagation()
            openCardMenu(task, e.currentTarget.getBoundingClientRect())
          }}
          className="-mr-1.5 ml-auto grid size-6 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-ink/[0.07] hover:text-ink focus-visible:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="mt-1 flex items-start gap-2">
        <p
          className={cx(
            'line-clamp-4 min-w-0 flex-1 break-words text-[13.5px] leading-[1.35]',
            done ? 'text-ink-3 line-through decoration-ink-3/60' : 'text-ink',
          )}
        >
          {task.title}
        </p>
        <button
          type="button"
          aria-label={done ? 'Вернуть в работу' : 'Отметить готовым'}
          aria-pressed={done}
          onKeyDown={stopKeys}
          onClick={(e) => {
            e.stopPropagation()
            toggleDone(task)
          }}
          className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-full hover:bg-ink/[0.05]"
        >
          <StatusDot status={task.status} />
        </button>
      </div>

      {task.notes && (
        <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-line px-2 py-1">
          <AlignLeft size={12} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
          <span className="line-clamp-2 whitespace-pre-line break-words text-xs leading-snug text-ink-2">
            {task.notes}
          </span>
        </div>
      )}

      {task.checklist.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-2" title="Чек-лист">
          <ListChecks size={13} className="text-ink-3" aria-hidden />
          <span className="tabular-nums">
            {checklistDone}/{task.checklist.length}
          </span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
            <span
              className="block h-full rounded-full bg-done transition-[width] duration-300"
              style={{ width: `${(checklistDone / task.checklist.length) * 100}%` }}
            />
          </span>
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              title={`Показать только #${tag}`}
              onKeyDown={stopKeys}
              onClick={(e) => {
                e.stopPropagation()
                setFilters({ ...filters, tag: filters.tag === tag ? null : tag })
              }}
              className="flex h-5 items-center gap-1 rounded-full bg-ink/[0.05] px-1.5 text-[11px] text-ink-2 hover:bg-ink/10"
            >
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: tagColor(tag) }} />
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1.5">
        <Avatar member={who} size={22} />
        {time && (
          <span className="flex h-5 items-center gap-1 rounded-full border border-line px-1.5 text-[11px] tabular-nums text-ink-2">
            <Clock size={11} aria-hidden />
            {time}
          </span>
        )}
        {showDay && lateDays === 0 && (
          <span className="h-5 rounded-full border border-line px-1.5 text-[11px] leading-[18px] text-ink-2">
            {relativeDay(task.due, todayISO)}
          </span>
        )}
        {view === 'week' && task.status === 'doing' && (
          <span className="flex h-5 items-center gap-1 rounded-full bg-doing/10 px-1.5 text-[11px] font-medium text-ink-2">
            <span aria-hidden className="size-1.5 rounded-full bg-doing" />В работе
          </span>
        )}
        {lateDays > 0 && (
          <span
            title={`Просрочено: план был на ${relativeDay(task.due, todayISO).toLowerCase()}`}
            className="ml-auto flex h-5 items-center gap-0.5 rounded bg-danger px-1.5 text-[11px] font-bold text-white"
          >
            <Hourglass size={11} aria-hidden />
            {lateDays}д
          </span>
        )}
      </div>
    </div>
  )
}

/** Карточка на доске: перетаскивается целиком, клик открывает, правый клик — меню. */
export const SortableCard = memo(function SortableCard({ task }: { task: Task }) {
  const { openTask, openCardMenu, wasDragging } = useBoard()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="перетаскиваемое дело"
      data-task-id={task.id}
      aria-label={task.title}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={() => {
        if (!wasDragging()) openTask(task)
      }}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === 'Enter' && !e.defaultPrevented && !isDragging && !wasDragging()) openTask(task)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        openCardMenu(task, { x: e.clientX, y: e.clientY })
      }}
      className="cursor-grab touch-manipulation rounded-lg outline-offset-2 active:cursor-grabbing"
    >
      <CardBody task={task} placeholder={isDragging} />
    </div>
  )
})
