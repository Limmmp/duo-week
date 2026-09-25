import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { addDays, startOfWeek, toISODate, weekDays, weekLabel } from '../lib/dates'
import { BACKLOG, type Member, type Task } from '../types'
import Column from './Column'
import TaskCard from './TaskCard'
import TaskDialog from './TaskDialog'

type Filter = 'all' | string

const containerOf = (t: Task) => t.due ?? BACKLOG
const byPosition = (a: Task, b: Task) => a.position - b.position

export default function Board({ userEmail }: { userEmail: string }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Task | null>(null)
  // Колонка, для которой открыто окно нового дела (BACKLOG = «Без даты»).
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const from = toISODate(days[0])
  const to = toISODate(days[6])
  const todayISO = toISODate(new Date())
  const me = members.find((m) => m.email.toLowerCase() === userEmail.toLowerCase())

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase
        .from('tasks')
        .select('id,title,notes,due,assignee,done,position,created_at')
        .or(`due.is.null,and(due.gte.${from},due.lte.${to})`)
        .order('position'),
      supabase.from('members').select('id,email,name,color').order('name'),
    ])
    if (t.error || m.error) setError('Не удалось загрузить задачи. Проверь интернет.')
    else {
      setError(null)
      setTasks(t.data)
      setMembers(m.data)
    }
    setLoading(false)
  }, [from, to])

  // Realtime: любое изменение у друга → перезагрузка (с небольшим дебаунсом).
  const reloadTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    load()
    const channel = supabase
      .channel('board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        clearTimeout(reloadTimer.current)
        reloadTimer.current = window.setTimeout(load, 250)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, load)
      .subscribe()
    return () => {
      clearTimeout(reloadTimer.current)
      supabase.removeChannel(channel)
    }
  }, [load])

  // На телефоне колонки идут друг под другом — сразу показываем сегодняшний день.
  const scrolled = useRef(false)
  useEffect(() => {
    if (loading || scrolled.current || window.innerWidth >= 640) return
    scrolled.current = true
    document.querySelector('[data-today]')?.scrollIntoView({ block: 'start' })
  }, [loading])

  const visible = useMemo(
    () =>
      filter === 'all'
        ? tasks
        : tasks.filter((t) => t.assignee === filter || t.assignee === null),
    [tasks, filter],
  )

  const columns = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const id of [...days.map(toISODate), BACKLOG]) map.set(id, [])
    for (const t of visible) map.get(containerOf(t))?.push(t)
    for (const list of map.values()) list.sort(byPosition)
    return map
  }, [visible, days])

  const weekTasks = tasks.filter((t) => t.due)
  const doneCount = weekTasks.filter((t) => t.done).length

  async function patch(id: string, changes: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)))
    const { error } = await supabase.from('tasks').update(changes).eq('id', id)
    if (error) {
      setError('Изменение не сохранилось.')
      load()
    }
  }

  async function create(fields: Pick<Task, 'title' | 'due'> & Partial<Pick<Task, 'notes' | 'assignee'>>) {
    const list = columns.get(fields.due ?? BACKLOG) ?? []
    const draft = {
      assignee: filter !== 'all' ? filter : (me?.id ?? null),
      ...fields,
      position: (list.at(-1)?.position ?? 0) + 1000,
    }
    const { data, error } = await supabase
      .from('tasks')
      .insert(draft)
      .select('id,title,notes,due,assignee,done,position,created_at')
      .single()
    if (error) setError('Задача не добавилась.')
    else setTasks((prev) => (prev.some((t) => t.id === data.id) ? prev : [...prev, data]))
  }

  async function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      setError('Не удалось удалить.')
      load()
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    if (!task) return

    const overId = String(over.id)
    const overTask = tasks.find((t) => t.id === overId)
    const target = overTask ? containerOf(overTask) : overId
    if (!columns.has(target)) return

    const list = (columns.get(target) ?? []).filter((t) => t.id !== task.id)
    let index = overTask ? list.findIndex((t) => t.id === overTask.id) : list.length
    // Внутри одной колонки при движении вниз вставляем после карточки, над которой отпустили.
    if (overTask && containerOf(task) === target) {
      const oldIndex = (columns.get(target) ?? []).findIndex((t) => t.id === task.id)
      const overIndex = (columns.get(target) ?? []).findIndex((t) => t.id === overTask.id)
      if (oldIndex < overIndex) index += 1
    }
    const prev = list[index - 1]?.position
    const next = list[index]?.position
    const position =
      prev === undefined && next === undefined
        ? 1000
        : prev === undefined
          ? next! - 1000
          : next === undefined
            ? prev + 1000
            : (prev + next) / 2

    const due = target === BACKLOG ? null : target
    if (due === task.due && position === task.position) return
    patch(task.id, { due, position })
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : undefined
  const isCurrentWeek = toISODate(weekStart) === toISODate(startOfWeek(new Date()))

  return (
    <div className="min-h-dvh p-2 sm:p-4 2xl:p-6">
      <div className="mx-auto max-w-[1880px] rounded-2xl bg-board px-3 pb-2 pt-3 2xl:px-4">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-1">
          <div className="mr-auto flex min-w-0 items-baseline gap-2">
            <h1 className="text-base font-bold">Неделя на двоих</h1>
            <span className="text-sm tabular-nums text-ink-3">{weekLabel(weekStart)}</span>
            {weekTasks.length > 0 && (
              <span
                title={`Готово ${doneCount} из ${weekTasks.length}`}
                className={`rounded px-1.5 py-px text-xs font-medium tabular-nums text-white ${
                  doneCount === weekTasks.length ? 'bg-ok' : 'bg-badge'
                }`}
              >
                {doneCount}/{weekTasks.length}
              </span>
            )}
          </div>

          <div role="radiogroup" aria-label="Чьи задачи" className="flex items-center gap-1">
            {[{ id: 'all', name: 'Все', color: '' }, ...members].map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={filter === m.id}
                onClick={() => setFilter(m.id)}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium transition-colors ${
                  filter === m.id ? 'border-ink bg-ink text-board' : 'border-line text-ink-2 hover:bg-surface'
                }`}
              >
                {m.color && (
                  <span
                    aria-hidden
                    className="grid size-4 place-items-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: m.color }}
                  >
                    {m.name.slice(0, 1)}
                  </span>
                )}
                {m.name}
              </button>
            ))}
          </div>

          <div className="flex items-center">
            <IconButton label="Прошлая неделя" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft size={18} />
            </IconButton>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              disabled={isCurrentWeek}
              className="h-9 rounded-md px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface disabled:opacity-40"
            >
              Сегодня
            </button>
            <IconButton label="Следующая неделя" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight size={18} />
            </IconButton>
            <IconButton label="Выйти" onClick={() => supabase.auth.signOut()}>
              <LogOut size={17} />
            </IconButton>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-center gap-3 py-1 text-sm text-danger">
            {error}
            <button onClick={load} className="underline underline-offset-2">
              Повторить
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3 py-3 lg:flex-row">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-md bg-surface/70 lg:flex-1" />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="flex flex-col lg:min-h-[calc(100dvh-8rem)] lg:flex-row lg:overflow-x-auto">
              {days.map((d, i) => {
                const id = toISODate(d)
                return (
                  <Column
                    key={id}
                    id={id}
                    weekdayIndex={i}
                    date={d}
                    isToday={id === todayISO}
                    tasks={columns.get(id) ?? []}
                    members={members}
                    onAdd={(title) => create({ title, due: id })}
                    onCreate={() => setCreatingIn(id)}
                    onToggle={(t) => patch(t.id, { done: !t.done })}
                    onOpen={setEditing}
                  />
                )
              })}
              <Column
                id={BACKLOG}
                tasks={columns.get(BACKLOG) ?? []}
                members={members}
                onAdd={(title) => create({ title, due: null })}
                onCreate={() => setCreatingIn(BACKLOG)}
                onToggle={(t) => patch(t.id, { done: !t.done })}
                onOpen={setEditing}
              />
            </div>
            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
              {activeTask && <TaskCard task={activeTask} members={members} overlay />}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {editing && (
        <TaskDialog
          task={editing}
          members={members}
          onClose={() => setEditing(null)}
          onSave={(changes) => {
            patch(editing.id, changes)
            setEditing(null)
          }}
          onDelete={() => {
            remove(editing.id)
            setEditing(null)
          }}
        />
      )}

      {creatingIn && (
        <TaskDialog
          defaults={{
            due: creatingIn === BACKLOG ? null : creatingIn,
            assignee: filter !== 'all' ? filter : (me?.id ?? null),
          }}
          members={members}
          onClose={() => setCreatingIn(null)}
          onSave={(fields) => {
            create({ title: fields.title ?? '', due: fields.due ?? null, notes: fields.notes, assignee: fields.assignee })
            setCreatingIn(null)
          }}
        />
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-md text-ink-2 transition-colors hover:bg-surface hover:text-ink"
    >
      {children}
    </button>
  )
}
