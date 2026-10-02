import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { AlertTriangle, Inbox, MoreHorizontal, Plus } from 'lucide-react'
import { useBoard } from '../board/BoardContext'
import { OVERDUE, columnTitle, type ColumnDef } from '../board/layout'
import { shortDate } from '../lib/dates'
import type { Task } from '../types'
import { SortableCard } from './TaskCard'
import { StatusDot } from './ui'
import { cx } from '../lib/cx'

/** Заголовок колонки: клик — меню нового дела на этот день, справа счётчик и меню колонки, под ним прогресс. */
export function ColumnHeader({ column, tasks, addTarget }: { column: ColumnDef; tasks: Task[]; addTarget: string }) {
  const { openComposer, openColumnMenu, defaultsFor } = useBoard()
  const done = tasks.filter((t) => t.status === 'done').length
  const isToday = column.kind === 'day' && column.isToday
  const muted = column.kind === 'day' && !isToday && (column.weekday >= 5 || column.isPast)
  const canAdd = column.kind !== 'overdue'

  return (
    <header className="mb-2">
      <div className="flex min-h-8 items-center gap-1">
        <button
          type="button"
          disabled={!canAdd}
          title={canAdd ? 'Новое дело сюда' : undefined}
          onClick={(e) => openComposer(defaultsFor(addTarget), e.currentTarget.getBoundingClientRect())}
          className="group/head -mx-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors enabled:hover:bg-ink/[0.06]"
        >
          {column.kind === 'status' && <StatusDot status={column.status} size={14} />}
          {column.kind === 'backlog' && <Inbox size={14} className="shrink-0 text-ink-3" aria-hidden />}
          {column.kind === 'overdue' && <AlertTriangle size={14} className="shrink-0 text-danger" aria-hidden />}
          <h2
            className={cx(
              'truncate text-sm font-medium',
              isToday ? 'text-today' : muted ? 'text-ink-2' : 'text-ink',
              column.kind === 'overdue' && 'text-danger',
            )}
          >
            {column.kind === 'day' ? (
              <>
                <span className="md:hidden 2xl:inline">{columnTitle(column)}</span>
                <span className="hidden md:inline 2xl:hidden">{columnTitle(column, true)}</span>
              </>
            ) : (
              columnTitle(column)
            )}
          </h2>
          {column.kind === 'day' && (
            <span className={cx('whitespace-nowrap text-xs', isToday ? 'font-medium text-today' : 'text-ink-3')}>
              {shortDate(column.date)}
            </span>
          )}
          {isToday && (
            <span className="rounded bg-today px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide text-white">
              сегодня
            </span>
          )}
          {canAdd && (
            <Plus
              size={14}
              aria-hidden
              className="ml-auto shrink-0 text-ink-3 opacity-0 transition-opacity group-hover/head:opacity-100"
            />
          )}
        </button>
        {tasks.length > 0 && (
          <span
            title={`Готово ${done} из ${tasks.length}`}
            className={cx(
              'shrink-0 rounded px-1.5 text-xs font-medium leading-5 tabular-nums text-white',
              done === tasks.length ? 'bg-done' : 'bg-ink-3',
            )}
          >
            {done > 0 ? `${done}/${tasks.length}` : tasks.length}
          </span>
        )}
        <button
          type="button"
          aria-label={`Меню колонки «${columnTitle(column)}»`}
          onClick={(e) => openColumnMenu(column, e.currentTarget.getBoundingClientRect())}
          className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-ink/[0.07] hover:text-ink"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-ink/[0.07]" aria-hidden>
        <div
          className={cx('h-full rounded-full transition-[width] duration-500', isToday ? 'bg-today' : 'bg-done')}
          style={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : 0 }}
        />
      </div>
    </header>
  )
}

/** Ячейка «дорожка × колонка»: сюда бросают карточки; клик по пустому месту или «+ Добавить» — меню нового дела. */
export function Cell({
  id,
  column,
  tasks,
  highlight,
}: {
  id: string
  column: ColumnDef
  tasks: Task[]
  highlight: boolean
}) {
  const { setNodeRef } = useDroppable({ id })
  const { openComposer, defaultsFor } = useBoard()

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (e.target === e.currentTarget && column.kind !== 'overdue') {
          openComposer(defaultsFor(id), { x: e.clientX, y: e.clientY })
        }
      }}
      className={cx(
        'flex min-h-20 flex-1 flex-col gap-2 rounded-lg p-0.5 transition-colors duration-150',
        highlight && 'bg-ink/[0.045] outline-2 -outline-offset-2 outline-dashed outline-ink/15',
      )}
    >
      <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableCard key={task.id} task={task} />
        ))}
      </SortableContext>
      {column.key !== OVERDUE && (
        <button
          type="button"
          onClick={(e) => openComposer(defaultsFor(id), e.currentTarget.getBoundingClientRect())}
          className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-ink-3 transition-colors hover:bg-ink/[0.06] hover:text-ink-2"
        >
          <Plus size={15} aria-hidden />
          Добавить
        </button>
      )}
    </div>
  )
}
