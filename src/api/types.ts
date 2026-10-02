import type { Board, Member, Task, TaskPatch } from '../types'

/** Какие дела грузить: неделя + «без даты» (+ незакрытые хвосты до начала недели). */
export type TaskRange = { from: string; to: string; overdueBefore: string | null }

export type NewTask = Omit<Task, 'created_at' | 'done_at'>
export type NewMember = Member

export interface BoardApi {
  /** Ключ доски — для ссылки-приглашения. */
  readonly key: string
  /** Можно ли держать копию доски в браузере для мгновенного открытия. */
  readonly cacheable: boolean
  loadBoard(): Promise<Board | null>
  loadMembers(): Promise<Member[]>
  loadTasks(range: TaskRange): Promise<Task[]>
  insertTask(task: NewTask): Promise<void>
  updateTask(id: string, patch: TaskPatch): Promise<void>
  deleteTask(id: string): Promise<void>
  restoreTask(task: Task): Promise<void>
  insertMember(member: NewMember): Promise<void>
  updateMember(id: string, patch: Partial<Pick<Member, 'name' | 'color'>>): Promise<void>
  deleteMember(id: string): Promise<void>
  renameBoard(id: string, name: string): Promise<void>
  /** Вызывает onChange, когда доску поменял кто-то ещё (или другая вкладка). */
  subscribe(boardId: string, onChange: () => void): () => void
}
