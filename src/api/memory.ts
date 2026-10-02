import type { Board, Member, Task } from '../types'
import type { BoardApi } from './types'

/** Доска в памяти — для demo.html: тот же интерфейс, что у Supabase, с имитацией задержки и realtime. */
export function createMemoryApi(seed: { board: Board; members: Member[]; tasks: Task[] }, latency = 150): BoardApi {
  let board = { ...seed.board }
  let members = seed.members.map((m) => ({ ...m }))
  let tasks = seed.tasks.map((t) => structuredClone(t))
  const listeners = new Set<() => void>()

  const wait = () => new Promise((resolve) => setTimeout(resolve, latency))
  const notify = () => setTimeout(() => listeners.forEach((fn) => fn()), 60)
  const doneAt = (next: Task, prev?: Task) =>
    next.status !== 'done' ? null : prev?.status === 'done' ? prev.done_at : (next.done_at ?? new Date().toISOString())

  return {
    key: '0'.repeat(32),
    cacheable: false,

    async loadBoard() {
      await wait()
      return { ...board }
    },

    async loadMembers() {
      await wait()
      return members.map((m) => ({ ...m }))
    },

    async loadTasks({ from, to, overdueBefore }) {
      await wait()
      return tasks
        .filter(
          (t) =>
            t.due === null ||
            (t.due >= from && t.due <= to) ||
            (overdueBefore !== null && t.due < overdueBefore && t.status !== 'done'),
        )
        .sort((a, b) => a.position - b.position)
        .map((t) => structuredClone(t))
    },

    async insertTask(task) {
      await wait()
      const full: Task = { ...structuredClone(task), created_at: new Date().toISOString(), done_at: null }
      tasks.push({ ...full, done_at: doneAt(full) })
      notify()
    },

    async updateTask(id, patch) {
      await wait()
      tasks = tasks.map((t) => {
        if (t.id !== id) return t
        const next = { ...t, ...structuredClone(patch) }
        return { ...next, done_at: doneAt(next, t) }
      })
      notify()
    },

    async deleteTask(id) {
      await wait()
      tasks = tasks.filter((t) => t.id !== id)
      notify()
    },

    async restoreTask(task) {
      await wait()
      tasks.push(structuredClone(task))
      notify()
    },

    async insertMember(member) {
      await wait()
      members.push({ ...member })
      notify()
    },

    async updateMember(id, patch) {
      await wait()
      members = members.map((m) => (m.id === id ? { ...m, ...patch } : m))
      notify()
    },

    async deleteMember(id) {
      await wait()
      members = members.filter((m) => m.id !== id)
      tasks = tasks.map((t) => (t.assignee === id ? { ...t, assignee: null } : t))
      notify()
    },

    async renameBoard(_id, name) {
      await wait()
      board = { ...board, name }
      notify()
    },

    subscribe(_boardId, onChange) {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
  }
}
