import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { applyFilters, buildLanes, containerId, groupIntoContainers, buildColumns, patchForContainer, NO_FILTERS } from './layout'

const task = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36),
  title: 'Дело',
  notes: null,
  due: null,
  due_time: null,
  assignee: null,
  status: 'todo',
  priority: 0,
  tags: [],
  checklist: [],
  position: 0,
  created_at: '',
  done_at: null,
  ...over,
})
const members = [
  { id: 'dan', name: 'Dan', color: '#4a3aa7' },
  { id: 'max', name: 'Max', color: '#eb6834' },
]
const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 28 + i))

describe('patchForContainer', () => {
  it('день, без даты, статус и дорожка', () => {
    expect(patchForContainer('all|2026-10-01')).toEqual({ due: '2026-10-01' })
    expect(patchForContainer('all|backlog')).toEqual({ due: null })
    expect(patchForContainer('max|doing')).toEqual({ status: 'doing', assignee: 'max' })
    expect(patchForContainer('both|2026-10-02')).toEqual({ due: '2026-10-02', assignee: null })
  })

  it('в «хвосты» бросать нельзя', () => {
    expect(patchForContainer('all|overdue')).toBeNull()
  })
})

describe('groupIntoContainers', () => {
  it('раскладывает по дням, хвостам и дорожкам в порядке позиций', () => {
    const columns = buildColumns('week', days, '2026-10-02', true)
    const lanes = buildLanes(true, members)
    const tasks = [
      task({ id: 'b', due: '2026-10-01', assignee: 'dan', position: 2 }),
      task({ id: 'a', due: '2026-10-01', assignee: 'dan', position: 1 }),
      task({ id: 'old', due: '2026-09-20', assignee: 'max' }),
      task({ id: 'free', assignee: 'ghost' }),
    ]
    const map = groupIntoContainers(tasks, columns, lanes, 'week', '2026-09-28')
    expect(map.get(containerId('dan', '2026-10-01'))!.map((t) => t.id)).toEqual(['a', 'b'])
    expect(map.get(containerId('max', 'overdue'))!.map((t) => t.id)).toEqual(['old'])
    expect(map.get(containerId('both', 'backlog'))!.map((t) => t.id)).toEqual(['free'])
  })
})

describe('applyFilters', () => {
  it('фильтр по человеку оставляет общие дела', () => {
    const tasks = [task({ id: '1', assignee: 'dan' }), task({ id: '2', assignee: 'max' }), task({ id: '3' })]
    expect(applyFilters(tasks, { ...NO_FILTERS, person: 'dan' }).map((t) => t.id)).toEqual(['1', '3'])
  })

  it('поиск идёт по названию, заметке, тегам и чек-листу', () => {
    const tasks = [
      task({ id: '1', checklist: [{ id: 'c', text: 'Молоко', done: false }] }),
      task({ id: '2', tags: ['молочка'] }),
      task({ id: '3', title: 'Другое' }),
    ]
    expect(applyFilters(tasks, { ...NO_FILTERS, query: 'мол' }).map((t) => t.id)).toEqual(['1', '2'])
  })
})
