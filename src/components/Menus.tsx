import { ArrowRightToLine, CheckCheck, Copy, ExternalLink, Flag, Plus, Trash2 } from 'lucide-react'
import { useBoard } from '../board/BoardContext'
import { BACKLOG, columnTitle, containerId, type ColumnDef } from '../board/layout'
import { POSITION_STEP } from '../lib/order'
import { addDays, relativeDay, startOfWeek, toISODate } from '../lib/dates'
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status, type Task } from '../types'
import {
  Avatar,
  MenuChip as Chip,
  MenuChipRow as ChipRow,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  StatusDot,
  type Anchor,
} from './ui'

/**
 * Меню карточки: всё, что можно сделать с делом, не открывая его.
 * Статус, исполнитель и важность меняются на месте — меню остаётся открытым, чтобы настроить всё сразу.
 */
export function CardMenu({ task, onDone }: { task: Task; onDone: () => void }) {
  const { data, todayISO, today, setStatus, moveTask, updateTask, duplicateTask, removeTask, openTask } = useBoard()
  const live = data.tasks.find((t) => t.id === task.id) ?? task
  const andClose = (fn: () => void) => () => {
    fn()
    onDone()
  }
  const tomorrow = toISODate(addDays(today, 1))
  const nextMonday = toISODate(addDays(startOfWeek(today), 7))
  const moves: { label: string; due: string | null }[] = [
    { label: 'Сегодня', due: todayISO },
    { label: 'Завтра', due: tomorrow },
    { label: 'След. пн', due: nextMonday },
    { label: 'Без даты', due: null },
  ]

  return (
    <>
      <p className="truncate px-2.5 pb-1 pt-1.5 text-[13px] font-medium text-ink">{live.title}</p>
      <p className="px-2.5 pb-1.5 text-xs text-ink-3">{relativeDay(live.due, todayISO)}</p>
      <MenuSeparator />
      <MenuLabel>Статус</MenuLabel>
      {(['todo', 'doing', 'done'] as Status[]).map((s) => (
        <MenuItem
          key={s}
          icon={<StatusDot status={s} size={14} />}
          label={STATUS_LABEL[s]}
          checked={live.status === s}
          onClick={() => setStatus(live, s)}
        />
      ))}
      <MenuLabel>Перенести</MenuLabel>
      <ChipRow>
        {moves.map((m) => (
          <Chip key={m.label} active={live.due === m.due} onClick={andClose(() => moveTask(live, { due: m.due }))}>
            {m.label}
          </Chip>
        ))}
      </ChipRow>
      <MenuLabel>Кто делает</MenuLabel>
      <ChipRow>
        {[...data.members, null].map((m) => (
          <Chip
            key={m?.id ?? 'both'}
            active={live.assignee === (m?.id ?? null)}
            onClick={() => updateTask(live.id, { assignee: m?.id ?? null })}
          >
            <Avatar member={m} size={16} />
            {m?.name ?? 'Вместе'}
          </Chip>
        ))}
      </ChipRow>
      <MenuLabel>Важность</MenuLabel>
      <ChipRow>
        {([0, 1, 2] as Priority[]).map((p) => (
          <Chip key={p} active={live.priority === p} onClick={() => updateTask(live.id, { priority: p })}>
            {p > 0 && (
              <Flag size={11} fill="currentColor" className={p === 2 ? 'text-danger' : 'text-warn'} aria-hidden />
            )}
            {PRIORITY_LABEL[p]}
          </Chip>
        ))}
      </ChipRow>
      <MenuSeparator />
      <MenuItem icon={<ExternalLink size={15} />} label="Открыть" hint="Enter" onClick={andClose(() => openTask(live))} />
      <MenuItem icon={<Copy size={15} />} label="Дублировать" onClick={andClose(() => duplicateTask(live))} />
      <MenuItem icon={<Trash2 size={15} />} label="Удалить" danger onClick={andClose(() => removeTask(live))} />
    </>
  )
}

/** Меню колонки: добавить дело и массовые действия по её делам. */
export function ColumnMenu({
  column,
  tasks,
  anchor,
  onDone,
}: {
  column: ColumnDef
  tasks: Task[]
  anchor: Anchor
  onDone: () => void
}) {
  const { data, todayISO, openComposer, defaultsFor, removeTask } = useBoard()
  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')
  const act = (fn: () => void) => () => {
    fn()
    onDone()
  }
  // Переносимые дела встают в конец целевой колонки в прежнем порядке.
  const moveAll = (list: Task[], due: string) => {
    const end = Math.max(0, ...data.tasks.map((t) => t.position))
    data.updateTasks(list.map((t, i) => ({ id: t.id, patch: { due, position: end + POSITION_STEP * (i + 1) } })))
  }

  return (
    <>
      <MenuLabel>{columnTitle(column)}</MenuLabel>
      {column.kind !== 'overdue' && (
        <MenuItem
          icon={<Plus size={15} />}
          label="Новое дело"
          onClick={() => openComposer(defaultsFor(containerId('all', column.key)), anchor)}
        />
      )}
      {column.kind === 'overdue' && (
        <>
          <MenuItem
            icon={<ArrowRightToLine size={15} />}
            label="Перенести все на сегодня"
            hint={open.length}
            disabled={open.length === 0}
            onClick={act(() => moveAll(open, todayISO))}
          />
          <p className="px-2.5 pb-1.5 pt-1 text-xs leading-snug text-ink-3">
            Здесь незакрытые дела с прошлых недель. Перетащи в нужный день или перенеси все разом.
          </p>
        </>
      )}
      {column.kind === 'day' && (
        <>
          <MenuItem
            icon={<ArrowRightToLine size={15} />}
            label="Незавершённые — на завтра"
            hint={open.length}
            disabled={open.length === 0}
            onClick={act(() => moveAll(open, toISODate(addDays(column.date, 1))))}
          />
          <MenuItem
            icon={<CheckCheck size={15} />}
            label="Отметить все готовыми"
            hint={open.length}
            disabled={open.length === 0}
            onClick={act(() => data.updateTasks(open.map((t) => ({ id: t.id, patch: { status: 'done' as const } }))))}
          />
        </>
      )}
      {(column.key === BACKLOG || (column.kind === 'status' && column.status === 'done')) && (
        <MenuItem
          icon={<Trash2 size={15} />}
          label="Удалить готовые"
          hint={done.length}
          danger
          disabled={done.length === 0}
          onClick={act(() => removeTask(done))}
        />
      )}
    </>
  )
}
