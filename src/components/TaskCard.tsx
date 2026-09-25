import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlignLeft, Check, Hourglass, Users } from 'lucide-react'
import { toISODate } from '../lib/dates'
import type { Member, Task } from '../types'

type Props = {
  task: Task
  members: Member[]
  overlay?: boolean
  onToggle?: () => void
  onOpen?: () => void
}

const DAY_MS = 86_400_000

export default function TaskCard({ task, members, overlay, onToggle, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: overlay,
  })
  const who = members.find((m) => m.id === task.assignee)
  const today = toISODate(new Date())
  const lateDays =
    !task.done && task.due && task.due < today
      ? Math.round((Date.parse(today) - Date.parse(task.due)) / DAY_MS)
      : 0

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        boxShadow: overlay ? '0 8px 24px rgb(0 0 0 / 0.18)' : 'var(--card-shadow)',
      }}
      className={`group relative rounded-md bg-surface px-2.5 pb-2.5 pt-2 ${isDragging ? 'opacity-30' : ''} ${
        overlay ? 'rotate-1' : ''
      }`}
    >
      {/* Полоска как в референсе: цвет исполнителя, серая — «вместе». */}
      <span
        aria-hidden
        className="block h-[3px] w-9 rounded-full"
        style={{ background: who?.color ?? 'var(--ink-3)', opacity: who ? 1 : 0.4 }}
      />

      <div className="mt-1.5 flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          onClick={onOpen}
          className="min-w-0 flex-1 cursor-grab touch-manipulation text-left active:cursor-grabbing"
        >
          <span
            className={`block break-words text-sm leading-[1.35] ${task.done ? 'text-ink-3 line-through' : 'text-ink'}`}
          >
            {task.title}
          </span>
        </button>
        <button
          onClick={onToggle}
          aria-label={task.done ? 'Отметить как не сделано' : 'Отметить как сделано'}
          aria-pressed={task.done}
          className="-m-1.5 grid size-8 shrink-0 place-items-center"
        >
          <span
            className={`grid size-[18px] place-items-center rounded-full border-[1.5px] transition-colors ${
              task.done ? 'border-ok bg-ok text-white' : 'border-ink-3/50 group-hover:border-ink-3'
            }`}
          >
            {task.done && <Check size={11} strokeWidth={3.5} />}
          </span>
        </button>
      </div>

      {task.notes && (
        <button
          onClick={onOpen}
          tabIndex={-1}
          className="mt-2 flex max-w-full items-start gap-1.5 rounded-2xl border border-line px-2 py-1 text-left"
        >
          <AlignLeft size={13} className="mt-px shrink-0 text-ink-3" aria-hidden />
          <span className="line-clamp-2 whitespace-pre-line break-words text-xs leading-snug text-ink-2">
            {task.notes}
          </span>
        </button>
      )}

      <div className="mt-2 flex items-center gap-2">
        {who ? (
          <span
            title={who.name}
            className="grid size-6 place-items-center rounded-full text-[11px] font-bold text-white"
            style={{ background: who.color }}
          >
            {who.name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <span title="Вместе" className="grid size-6 place-items-center rounded-full bg-ink-3/15 text-ink-2">
            <Users size={13} aria-hidden />
          </span>
        )}

        {lateDays > 0 && (
          <span
            title={`Просрочено на ${lateDays} дн.`}
            className="ml-auto flex h-5 items-center gap-0.5 rounded bg-late px-1.5 text-[11px] font-bold text-white"
          >
            <Hourglass size={11} aria-hidden />
            {lateDays}д
          </span>
        )}
      </div>
    </div>
  )
}
