import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check } from 'lucide-react'
import type { Member, Task } from '../types'

type Props = {
  task: Task
  members: Member[]
  overlay?: boolean
  onToggle?: () => void
  onOpen?: () => void
}

export default function TaskCard({ task, members, overlay, onToggle, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: overlay,
  })
  const who = members.find((m) => m.id === task.assignee)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative flex items-start gap-2 rounded-xl border border-line bg-surface p-2 pl-2.5 ${
        isDragging ? 'opacity-30' : ''
      } ${overlay ? 'rotate-1 shadow-lg' : 'hover:border-ink-3/40'}`}
    >
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[3px] rounded-full"
        style={{ background: who?.color ?? 'linear-gradient(var(--ink-3), var(--ink-3))', opacity: who ? 1 : 0.35 }}
      />
      <button
        onClick={onToggle}
        aria-label={task.done ? 'Отметить как не сделано' : 'Отметить как сделано'}
        aria-pressed={task.done}
        className="-m-1.5 grid size-8 shrink-0 place-items-center"
      >
        <span
          className={`grid size-[18px] place-items-center rounded-md border transition-colors ${
            task.done ? 'border-ink bg-ink text-bg' : 'border-ink-3/60 group-hover:border-ink-2'
          }`}
        >
          {task.done && <Check size={12} strokeWidth={3} />}
        </span>
      </button>

      <button
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className="min-w-0 flex-1 cursor-grab touch-manipulation text-left active:cursor-grabbing"
      >
        <span
          className={`block break-words text-sm leading-snug ${task.done ? 'text-ink-3 line-through' : ''}`}
        >
          {task.title}
        </span>
        {task.notes && (
          <span
            className={`mt-1 line-clamp-2 whitespace-pre-line break-words text-xs leading-snug ${
              task.done ? 'text-ink-3' : 'text-ink-2'
            }`}
          >
            {task.notes}
          </span>
        )}
        <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
          {who && <span aria-hidden className="size-1.5 rounded-full" style={{ background: who.color }} />}
          {who ? who.name : 'Вместе'}
        </span>
      </button>
    </div>
  )
}
