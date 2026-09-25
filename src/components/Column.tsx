import { useState, type FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { shortDate, weekdayName, weekdayShort } from '../lib/dates'
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

  const allDone = tasks.length > 0 && doneCount === tasks.length

  return (
    <section
      aria-label={title}
      data-today={isToday || undefined}
      className={`flex min-w-0 scroll-mt-4 flex-col border-line py-3 max-lg:border-t max-lg:first:border-t-0 lg:min-w-[160px] lg:flex-1 lg:basis-0 lg:border-l lg:px-2 lg:first:border-l-0 xl:px-2.5 ${
        isOver ? 'bg-ink/[0.03]' : ''
      }`}
    >
      <header
        role="button"
        tabIndex={0}
        title="Новое дело на этот день"
        onClick={onCreate}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onCreate())}
        className="-mx-1 mb-2 flex min-h-8 items-center gap-2 rounded px-1 transition-colors hover:bg-ink/5"
      >
        <h2 className={`truncate text-sm font-medium ${isToday ? 'text-today' : weekend ? 'text-ink-2' : 'text-ink'}`}>
          {isBacklog ? (
            title
          ) : (
            <>
              <span className="lg:hidden 2xl:inline">{title}</span>
              <span className="hidden lg:inline 2xl:hidden">{weekdayShort(weekdayIndex)}</span>
            </>
          )}
        </h2>
        {date && <span className={`whitespace-nowrap text-xs ${isToday ? 'font-medium text-today' : 'text-ink-3'}`}>{shortDate(date)}</span>}
        {tasks.length > 0 && (
          <span
            title={`Сделано ${doneCount} из ${tasks.length}`}
            className={`ml-auto rounded px-1.5 py-px text-xs font-medium tabular-nums text-white ${
              allDone ? 'bg-ok' : 'bg-badge'
            }`}
          >
            {doneCount > 0 ? `${doneCount}/${tasks.length}` : tasks.length}
          </span>
        )}
      </header>
      {isToday && <span aria-hidden className="-mt-1.5 mb-2 block h-0.5 rounded-full bg-today" />}

      <div
        ref={setNodeRef}
        onClick={(e) => e.target === e.currentTarget && onCreate()}
        className="flex min-h-16 cursor-pointer flex-col gap-2 lg:flex-1"
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} members={members} onToggle={() => onToggle(t)} onOpen={() => onOpen(t)} />
          ))}
        </SortableContext>
        <form
          onSubmit={submit}
          className="flex items-center gap-1 rounded-md px-1.5 text-ink-3 transition-colors focus-within:bg-surface focus-within:text-ink"
        >
          <Plus size={15} className="shrink-0" aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Добавить"
            aria-label={`Новое дело: ${title}`}
            maxLength={300}
            className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
          />
        </form>
      </div>
    </section>
  )
}
