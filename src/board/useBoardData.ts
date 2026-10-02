import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardApi, NewTask, TaskRange } from '../api/types'
import { nextMemberColor } from '../lib/colors'
import { load, save } from '../lib/storage'
import type { Board, Member, Task, TaskDraft, TaskPatch } from '../types'

export type Phase = 'loading' | 'ready' | 'denied' | 'offline'

const rangeKey = (r: TaskRange) => `${r.from}|${r.to}|${r.overdueBefore ?? ''}`

/** Последняя загруженная копия доски — чтобы при открытии показать её сразу, не дожидаясь сети. */
type Snapshot = { board: Board; members: Member[]; tasks: Task[]; rangeKey: string }
const snapshotKey = (api: BoardApi) => `duo.cache.${api.key}`

const toRow = (t: Task): NewTask => ({
  id: t.id,
  title: t.title,
  notes: t.notes,
  due: t.due,
  due_time: t.due_time,
  assignee: t.assignee,
  status: t.status,
  priority: t.priority,
  tags: t.tags,
  checklist: t.checklist,
  position: t.position,
})

/** Локально ведём done_at так же, как триггер в базе, — чтобы статистика не ждала сервер. */
function applyPatch(task: Task, patch: TaskPatch): Task {
  const next = { ...task, ...patch }
  if (patch.status && patch.status !== task.status) {
    next.done_at = patch.status === 'done' ? new Date().toISOString() : null
  }
  return next
}

/**
 * Состояние доски: изменения применяются сразу (оптимистично) и уходят на сервер в фоне.
 * Пока есть несохранённые изменения или идёт перетаскивание, свежие данные с сервера
 * не применяются — иначе карточки «прыгали» бы назад. Догоняем после.
 */
export function useBoardData(api: BoardApi, range: TaskRange) {
  const [cached] = useState(() => (api.cacheable ? load<Snapshot | null>(snapshotKey(api), null) : null))
  const [board, setBoard] = useState<Board | null>(cached?.board ?? null)
  const [members, setMembers] = useState<Member[]>(cached?.members ?? [])
  const [tasks, setTasks] = useState<Task[]>(cached?.tasks ?? [])
  const [phase, setPhase] = useState<Phase>(cached ? 'ready' : 'loading')
  const [error, setError] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(cached?.rangeKey ?? null)
  const [synced, setSynced] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(0)

  const pending = useRef(0)
  const paused = useRef(false)
  const dirty = useRef(false)
  const requestId = useRef(0)
  const requestedKey = useRef<string | null>(null)
  const rangeRef = useRef(range)

  useEffect(() => {
    rangeRef.current = range
  })

  // Первая загрузка: доска, участники и дела одним заходом — сеть до сервера бывает медленной.
  useEffect(() => {
    let cancelled = false
    const r = rangeRef.current
    const id = ++requestId.current
    requestedKey.current = rangeKey(r)
    Promise.all([api.loadBoard(), api.loadMembers(), api.loadTasks(r)])
      .then(([b, m, t]) => {
        if (cancelled) return
        if (!b) {
          save(snapshotKey(api), null)
          setPhase('denied')
          return
        }
        setBoard(b)
        if (id === requestId.current && pending.current === 0 && !paused.current) {
          setMembers(m)
          setTasks(t)
          setLoadedKey(rangeKey(r))
          setError(null)
        } else dirty.current = true
        setSynced(true)
        setPhase('ready')
      })
      .catch(() => {
        if (cancelled) return
        if (cached) setError('Нет связи с сервером — показываю сохранённую копию.')
        else setPhase('offline')
      })
    return () => {
      cancelled = true
    }
  }, [api, attempt, cached])

  const refetch = useCallback(async () => {
    if (pending.current > 0 || paused.current) {
      dirty.current = true
      return
    }
    const id = ++requestId.current
    const r = rangeRef.current
    requestedKey.current = rangeKey(r)
    try {
      const [m, t] = await Promise.all([api.loadMembers(), api.loadTasks(r)])
      if (id !== requestId.current) return
      if (pending.current > 0 || paused.current) {
        dirty.current = true
        return
      }
      setMembers(m)
      setTasks(t)
      setLoadedKey(rangeKey(r))
      setError(null)
      setSynced(true)
      setPhase('ready')
    } catch {
      if (id !== requestId.current) return
      setError('Нет связи с сервером — показываю то, что успел загрузить.')
      setPhase((p) => (p === 'loading' ? 'offline' : p))
    }
  }, [api])

  const key = rangeKey(range)
  useEffect(() => {
    if (board && requestedKey.current !== key) void refetch()
  }, [board, key, refetch])

  useEffect(() => {
    if (!api.cacheable || phase !== 'ready' || !board || loadedKey === null) return
    save(snapshotKey(api), { board, members, tasks, rangeKey: loadedKey } satisfies Snapshot)
  }, [api, phase, board, members, tasks, loadedKey])

  // Realtime-пинг от базы + перечитывание при возврате на вкладку + редкий опрос на всякий случай.
  useEffect(() => {
    if (!board) return
    let timer: number | undefined
    const soon = () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => void refetch(), 300)
    }
    const unsubscribe = api.subscribe(board.id, soon)
    const onVisible = () => {
      if (document.visibilityState === 'visible') soon()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const poll = window.setInterval(onVisible, 60_000)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(poll)
    }
  }, [api, board, refetch])

  const run = useCallback(
    async (request: () => Promise<unknown>, failMessage: string) => {
      pending.current++
      setSaving((n) => n + 1)
      try {
        await request()
      } catch {
        setError(failMessage)
        dirty.current = true
      } finally {
        pending.current--
        setSaving((n) => n - 1)
        if (pending.current === 0 && dirty.current && !paused.current) {
          dirty.current = false
          void refetch()
        }
      }
    },
    [refetch],
  )

  const setPaused = useCallback(
    (value: boolean) => {
      paused.current = value
      if (!value && dirty.current && pending.current === 0) {
        dirty.current = false
        void refetch()
      }
    },
    [refetch],
  )

  const createTask = useCallback(
    (draft: TaskDraft & { position: number }): Task => {
      const now = new Date().toISOString()
      const task: Task = {
        id: crypto.randomUUID(),
        notes: null,
        due_time: null,
        status: 'todo',
        priority: 0,
        tags: [],
        checklist: [],
        ...draft,
        created_at: now,
        done_at: draft.status === 'done' ? now : null,
      }
      setTasks((prev) => [...prev, task])
      void run(() => api.insertTask(toRow(task)), 'Дело не добавилось — проверь связь.')
      return task
    },
    [api, run],
  )

  const updateTasks = useCallback(
    (changes: { id: string; patch: TaskPatch }[]) => {
      if (changes.length === 0) return
      const byId = new Map(changes.map((c) => [c.id, c.patch]))
      setTasks((prev) => prev.map((t) => (byId.has(t.id) ? applyPatch(t, byId.get(t.id)!) : t)))
      void run(
        () => Promise.all(changes.map((c) => api.updateTask(c.id, c.patch))),
        'Изменение не сохранилось — вернул как было.',
      )
    },
    [api, run],
  )

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => updateTasks([{ id, patch }]),
    [updateTasks],
  )

  const deleteTask = useCallback(
    (task: Task) => {
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      void run(() => api.deleteTask(task.id), 'Не удалось удалить.')
    },
    [api, run],
  )

  const restoreTask = useCallback(
    (task: Task) => {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]))
      void run(() => api.restoreTask(task), 'Не удалось вернуть дело.')
    },
    [api, run],
  )

  const createMember = useCallback(
    (name: string): Member => {
      const member: Member = { id: crypto.randomUUID(), name, color: nextMemberColor(members.map((m) => m.color)) }
      setMembers((prev) => [...prev, member])
      void run(() => api.insertMember(member), 'Участник не добавился.')
      return member
    },
    [api, members, run],
  )

  const updateMember = useCallback(
    (id: string, patch: Partial<Pick<Member, 'name' | 'color'>>) => {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
      void run(() => api.updateMember(id, patch), 'Не удалось сохранить участника.')
    },
    [api, run],
  )

  const deleteMember = useCallback(
    (id: string) => {
      setMembers((prev) => prev.filter((m) => m.id !== id))
      setTasks((prev) => prev.map((t) => (t.assignee === id ? { ...t, assignee: null } : t)))
      void run(() => api.deleteMember(id), 'Не удалось удалить участника.')
    },
    [api, run],
  )

  const renameBoard = useCallback(
    (name: string) => {
      if (!board) return
      setBoard({ ...board, name })
      void run(() => api.renameBoard(board.id, name), 'Название не сохранилось.')
    },
    [api, board, run],
  )

  const retry = useCallback(() => {
    if (!board) {
      setPhase('loading')
      setAttempt((a) => a + 1)
    } else void refetch()
  }, [board, refetch])

  return {
    board,
    members,
    tasks,
    phase,
    error,
    /** Данные пока от прошлой недели — новая ещё грузится. */
    stale: loadedKey !== key,
    saving: saving > 0,
    /** Показана сохранённая копия, свежие данные ещё в пути. */
    syncing: !synced,
    clearError: () => setError(null),
    retry,
    setPaused,
    createTask,
    updateTask,
    updateTasks,
    deleteTask,
    restoreTask,
    createMember,
    updateMember,
    deleteMember,
    renameBoard,
  }
}

export type BoardData = ReturnType<typeof useBoardData>
