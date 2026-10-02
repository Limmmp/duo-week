import { createContext, useContext } from 'react'
import type { Anchor } from '../components/ui'
import type { Member, Status, Task, TaskDraft, TaskPatch } from '../types'
import type { ColumnDef, Filters, View } from './layout'
import type { BoardData } from './useBoardData'

export type TaskDefaults = Partial<Omit<TaskDraft, 'title'>> & { title?: string }

export type BoardCtx = {
  data: BoardData
  me: Member | null
  memberById: Map<string, Member>
  today: Date
  todayISO: string
  weekStart: Date
  weekStartISO: string
  view: View
  filters: Filters
  setFilters: (f: Filters) => void
  addTask: (draft: TaskDraft) => Task
  updateTask: (id: string, patch: TaskPatch) => void
  toggleDone: (task: Task) => void
  setStatus: (task: Task, status: Status) => void
  moveTask: (task: Task, patch: TaskPatch) => void
  duplicateTask: (task: Task) => void
  /** Удаляет одно или несколько дел и предлагает «Отменить». */
  removeTask: (task: Task | Task[]) => void
  defaultsFor: (containerId: string) => TaskDefaults
  openTask: (task: Task) => void
  /** Полная форма дела. */
  openNew: (defaults: TaskDefaults) => void
  /** Меню «новое дело»: название + настройки, у кнопки или заголовка колонки. */
  openComposer: (defaults: TaskDefaults, anchor: Anchor) => void
  openCardMenu: (task: Task, anchor: Anchor) => void
  openColumnMenu: (column: ColumnDef, anchor: Anchor) => void
  /** Только что закончилось перетаскивание — клик по карточке не должен открывать её. */
  wasDragging: () => boolean
}

export const BoardContext = createContext<BoardCtx | null>(null)

export function useBoard(): BoardCtx {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoard вне BoardContext')
  return ctx
}
