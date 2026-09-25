export type Member = {
  id: string
  email: string
  name: string
  color: string
}

export type Task = {
  id: string
  title: string
  notes: string | null
  due: string | null // YYYY-MM-DD, null = «Без даты»
  assignee: string | null // member id, null = вместе
  done: boolean
  position: number
  created_at: string
}

export const BACKLOG = 'backlog'
