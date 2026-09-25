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

  async function create(container: string, title: string) {
    const list = columns.get(container) ?? []
    const position = (list.at(-1)?.position ?? 0) + 1000
    const draft = {
      title,
      due: container === BACKLOG ? null : container,
      assignee: filter !== 'all' ? filter : (me?.id ?? null),
      position,
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
    <div className="min-h-dvh">
      <header className="z-20 border-b sm:sticky sm:top-0 border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="mr-auto min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Неделя на двоих</h1>
            <p className="text-sm tabular-nums text-ink-3">
              {weekLabel(weekStart)} · готово {doneCount} из {weekTasks.length}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <IconButton label="Прошлая неделя" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft size={18} />
            </IconButton>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              disabled={isCurrentWeek}
              className="h-10 rounded-lg px-3 text-sm font-medium hover:bg-surface disabled:opacity-40"
            >
              Сегодня
            </button>
            <IconButton label="Следующая неделя" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight size={18} />
            </IconButton>
          </div>

          <div role="radiogroup" aria-label="Чьи задачи" className="flex rounded-xl border border-line bg-surface p-1">
            {[{ id: 'all', name: 'Все', color: '' }, ...members].map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={filter === m.id}
                onClick={() => setFilter(m.id)}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                  filter === m.id ? 'bg-accent text-on-accent' : 'text-ink-2 hover:bg-surface-2'
                }`}
              >
                {m.color && <span className="size-2 rounded-full" style={{ background: m.color }} />}
                {m.name}
              </button>
            ))}
          </div>

          <IconButton label="Выйти" onClick={() => supabase.auth.signOut()}>
            <LogOut size={18} />
          </IconButton>
        </div>
      </header>

      {error && (
        <div role="alert" className="mx-auto mt-3 flex max-w-[1800px] items-center gap-3 px-4 text-sm text-danger sm:px-6">
          {error}
          <button onClick={load} className="underline underline-offset-2">
            Повторить
          </button>
        </div>
      )}

      <main className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface" />
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
            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
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
                    onAdd={(title) => create(id, title)}
                    onToggle={(t) => patch(t.id, { done: !t.done })}
                    onOpen={setEditing}
                  />
                )
              })}
              <Column
                id={BACKLOG}
                tasks={columns.get(BACKLOG) ?? []}
                members={members}
                onAdd={(title) => create(BACKLOG, title)}
                onToggle={(t) => patch(t.id, { done: !t.done })}
                onOpen={setEditing}
              />
            </div>
            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
              {activeTask && <TaskCard task={activeTask} members={members} overlay />}
            </DragOverlay>
          </DndContext>
        )}
      </main>

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
      className="grid size-10 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface hover:text-ink"
    >
      {children}
    </button>
  )
}
