import { useState, type FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { shortDate, weekdayName } from '../lib/dates'
import type { Member, Task } from '../types'
import TaskCard from './TaskCard'

type Props = {
  id: string
  tasks: Task[]
  members: Member[]
  weekdayIndex?: number
  date?: Date
  isToday?: boolean
  onAdd: (title: string) => void
  onCreate: () => void
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
}

export default function Column({ id, tasks, members, weekdayIndex, date, isToday, onAdd, onCreate, onToggle, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const [draft, setDraft] = useState('')
  const isBacklog = weekdayIndex === undefined
  const title = isBacklog ? 'Без даты' : weekdayName(weekdayIndex)
  const weekend = weekdayIndex === 5 || weekdayIndex === 6
  const doneCount = tasks.filter((t) => t.done).length

  function submit(e: FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    onAdd(title)
    setDraft('')
  }

  return (
    <section
      aria-label={title}
      data-today={isToday || undefined}
      className={`flex scroll-mt-4 flex-col rounded-2xl border p-2 transition-colors ${
        isToday ? 'border-orange-400/70 bg-today' : isBacklog ? 'border-dashed border-line bg-surface-2' : 'border-line bg-surface'
      } ${isOver ? 'ring-2 ring-ink/20' : ''}`}
    >
      <header
        role="button"
        tabIndex={0}
        title="Новое дело на этот день"
        onClick={onCreate}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onCreate())}
        className="flex items-baseline gap-2 rounded-lg px-2 pb-2 pt-1 transition-colors hover:bg-ink/5"
      >
        <h2 className={`text-sm font-semibold ${weekend && !isToday ? 'text-ink-2' : ''}`}>{title}</h2>
        {date && <span className="text-xs text-ink-3">{shortDate(date)}</span>}
        {isToday && (
          <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">сегодня</span>
        )}
        {tasks.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-ink-3" title="Сделано">
            {doneCount}/{tasks.length}
          </span>
        )}
      </header>

      <div
        ref={setNodeRef}
        onClick={(e) => e.target === e.currentTarget && onCreate()}
        className="flex min-h-12 cursor-pointer flex-col gap-1.5"
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} members={members} onToggle={() => onToggle(t)} onOpen={() => onOpen(t)} />
          ))}
        </SortableContext>
      </div>

      <form onSubmit={submit} className="mt-1.5 flex items-center gap-1 rounded-xl px-1 focus-within:bg-surface-2">
        <Plus size={16} className="shrink-0 text-ink-3" aria-hidden />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Добавить дело"
          aria-label={`Новое дело: ${title}`}
          maxLength={300}
          className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-ink-3"
        />
      </form>
    </section>
  )
}
