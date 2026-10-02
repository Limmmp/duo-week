export type Status = 'todo' | 'doing' | 'done'
export type Priority = 0 | 1 | 2

export type ChecklistItem = { id: string; text: string; done: boolean }

export type Board = { id: string; name: string }

export type Member = {
  id: string
  name: string
  color: string
}

export type Task = {
  id: string
  title: string
  notes: string | null
  due: string | null // YYYY-MM-DD, null — «Без даты»
  due_time: string | null // HH:MM или HH:MM:SS из Postgres
  assignee: string | null // id участника, null — «Вместе»
  status: Status
  priority: Priority
  tags: string[]
  checklist: ChecklistItem[]
  position: number
  created_at: string
  done_at: string | null
}

/** Поля, которые клиент задаёт сам; остальное проставляет база. */
export type TaskDraft = Pick<Task, 'title' | 'due' | 'assignee'> &
  Partial<Pick<Task, 'notes' | 'due_time' | 'status' | 'priority' | 'tags' | 'checklist'>>

export type TaskPatch = Partial<Omit<Task, 'id' | 'created_at' | 'done_at'>>

export const TASK_FIELDS =
  'id,title,notes,due,due_time,assignee,status,priority,tags,checklist,position,created_at,done_at'

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Нужно сделать',
  doing: 'В работе',
  done: 'Готово',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: 'Обычно',
  1: 'Важно',
  2: 'Срочно',
}
