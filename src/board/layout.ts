import { WEEKDAYS, WEEKDAYS_SHORT, toISODate, weekdayIndex } from '../lib/dates'
import { STATUS_LABEL, type Member, type Status, type Task, type TaskPatch } from '../types'

export type View = 'week' | 'status'

export type ColumnDef =
  | { key: string; kind: 'day'; date: Date; isToday: boolean; isPast: boolean; weekday: number }
  | { key: 'backlog'; kind: 'backlog' }
  | { key: 'overdue'; kind: 'overdue' }
  | { key: Status; kind: 'status'; status: Status }

/** Дорожка: 'all' — без деления, id участника или 'both' — «вместе». */
export type LaneDef = { key: string; member: Member | null }

export function columnTitle(column: ColumnDef, short = false): string {
  switch (column.kind) {
    case 'day':
      return short ? WEEKDAYS_SHORT[column.weekday] : WEEKDAYS[column.weekday]
    case 'backlog':
      return 'Без даты'
    case 'overdue':
      return 'Хвосты'
    case 'status':
      return STATUS_LABEL[column.status]
  }
}

export const BACKLOG = 'backlog'
export const OVERDUE = 'overdue'
const SEP = '|'

export const containerId = (lane: string, column: string) => `${lane}${SEP}${column}`
export function splitContainer(id: string): { lane: string; column: string } {
  const i = id.indexOf(SEP)
  return { lane: id.slice(0, i), column: id.slice(i + 1) }
}
export const isContainerId = (id: string) => id.includes(SEP)

export function buildColumns(view: View, days: Date[], todayISO: string, withOverdue: boolean): ColumnDef[] {
  if (view === 'status') {
    return (['todo', 'doing', 'done'] as const).map((status) => ({ key: status, kind: 'status', status }))
  }
  const dayColumns: ColumnDef[] = days.map((date) => {
    const iso = toISODate(date)
    return { key: iso, kind: 'day', date, isToday: iso === todayISO, isPast: iso < todayISO, weekday: weekdayIndex(date) }
  })
  return [
    ...(withOverdue ? [{ key: OVERDUE, kind: 'overdue' } as ColumnDef] : []),
    ...dayColumns,
    { key: BACKLOG, kind: 'backlog' },
  ]
}

export function buildLanes(lanesOn: boolean, members: Member[]): LaneDef[] {
  if (!lanesOn) return [{ key: 'all', member: null }]
  return [...members.map((member) => ({ key: member.id, member })), { key: 'both', member: null }]
}

export function columnKeyOf(task: Task, view: View, weekStartISO: string): string {
  if (view === 'status') return task.status
  if (task.due === null) return BACKLOG
  return task.due < weekStartISO ? OVERDUE : task.due
}

export function laneKeyOf(task: Task, lanes: LaneDef[]): string {
  if (lanes.length === 1) return 'all'
  return task.assignee && lanes.some((l) => l.key === task.assignee) ? task.assignee : 'both'
}

/** Раскладывает дела по ячейкам «дорожка × колонка», внутри — по позиции. */
export function groupIntoContainers(
  tasks: Task[],
  columns: ColumnDef[],
  lanes: LaneDef[],
  view: View,
  weekStartISO: string,
): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const lane of lanes) for (const col of columns) map.set(containerId(lane.key, col.key), [])
  for (const task of tasks) {
    map.get(containerId(laneKeyOf(task, lanes), columnKeyOf(task, view, weekStartISO)))?.push(task)
  }
  for (const list of map.values()) list.sort((a, b) => a.position - b.position)
  return map
}

/** Что поменять у дела, брошенного в ячейку. null — сюда бросать нельзя («хвосты»). */
export function patchForContainer(id: string): TaskPatch | null {
  const { lane, column } = splitContainer(id)
  if (column === OVERDUE) return null
  const patch: TaskPatch = {}
  if (column === BACKLOG) patch.due = null
  else if (column === 'todo' || column === 'doing' || column === 'done') patch.status = column
  else patch.due = column
  if (lane === 'both') patch.assignee = null
  else if (lane !== 'all') patch.assignee = lane
  return patch
}

export type Filters = {
  query: string
  person: string // 'all' или id участника
  tag: string | null
  important: boolean
  hideDone: boolean
}

export const NO_FILTERS: Filters = { query: '', person: 'all', tag: null, important: false, hideDone: false }

export const hasActiveFilters = (f: Filters) =>
  f.query.trim() !== '' || f.person !== 'all' || f.tag !== null || f.important || f.hideDone

export function applyFilters(tasks: Task[], f: Filters): Task[] {
  const q = f.query.trim().toLowerCase()
  return tasks.filter((t) => {
    if (f.person !== 'all' && t.assignee !== f.person && t.assignee !== null) return false
    if (f.tag && !t.tags.includes(f.tag)) return false
    if (f.important && t.priority === 0) return false
    if (f.hideDone && t.status === 'done') return false
    if (q) {
      const haystack = [t.title, t.notes ?? '', ...t.tags, ...t.checklist.map((c) => c.text)].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}
