import { createClient } from '@supabase/supabase-js'
import { TASK_FIELDS, type Board, type Member, type Task } from '../types'
import type { BoardApi } from './types'

/** Всё, что ниже, видит только тот, у кого есть ключ: RLS сверяет заголовок x-board-key. */
export function createSupabaseApi(key: string): BoardApi {
  const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
    global: { headers: { 'x-board-key': key } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const ok = <T>({ data, error }: { data: T; error: unknown }): T => {
    if (error) throw error
    return data
  }

  return {
    key,
    cacheable: true,

    async loadBoard() {
      return ok(await db.from('boards').select('id,name').maybeSingle()) as Board | null
    },

    async loadMembers() {
      return ok(await db.from('members').select('id,name,color').order('created_at')) as Member[]
    },

    async loadTasks({ from, to, overdueBefore }) {
      const filters = ['due.is.null', `and(due.gte.${from},due.lte.${to})`]
      if (overdueBefore) filters.push(`and(due.lt.${overdueBefore},status.neq.done)`)
      return ok(await db.from('tasks').select(TASK_FIELDS).or(filters.join(',')).order('position')) as Task[]
    },

    async insertTask(task) {
      ok(await db.from('tasks').insert(task))
    },

    async updateTask(id, patch) {
      ok(await db.from('tasks').update(patch).eq('id', id))
    },

    async deleteTask(id) {
      ok(await db.from('tasks').delete().eq('id', id))
    },

    async restoreTask(task) {
      ok(await db.from('tasks').insert(task))
    },

    async insertMember(member) {
      ok(await db.from('members').insert(member))
    },

    async updateMember(id, patch) {
      ok(await db.from('members').update(patch).eq('id', id))
    },

    async deleteMember(id) {
      ok(await db.from('members').delete().eq('id', id))
    },

    async renameBoard(id, name) {
      ok(await db.from('boards').update({ name }).eq('id', id))
    },

    subscribe(boardId, onChange) {
      // База сама шлёт пинг в публичный канал доски (триггер private.broadcast_board_change).
      const channel = db
        .channel(`board:${boardId}`)
        .on('broadcast', { event: 'changed' }, () => onChange())
        .subscribe()
      return () => {
        db.removeChannel(channel)
      }
    },
  }
}
