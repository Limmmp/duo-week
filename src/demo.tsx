// Dev-only: доска на фейковых данных без входа. Открывать /demo.html, в сборку не попадает.
import { createRoot } from 'react-dom/client'
import './index.css'
import { supabase } from './lib/supabase'
import { startOfWeek, addDays, toISODate } from './lib/dates'
import Board from './components/Board'

const ws = startOfWeek(new Date())
const d = (i: number) => toISODate(addDays(ws, i))
const members = [
  { id: 'a', email: 'me@x', name: 'Денис', color: '#f97316' },
  { id: 'b', email: 'fr@x', name: 'Друг', color: '#14b8a6' },
]
const titles: [string, number | null, string | null, boolean][] = [
  ['Созвон с клиентом по сайту', 0, 'a', true], ['Купить продукты на неделю', 0, null, false],
  ['Спортзал', 1, 'b', false], ['Доделать макет лендинга', 1, 'a', false],
  ['Забрать посылку', 2, 'b', true], ['Отчёт по проекту', 3, 'a', false],
  ['Поездка на Русский остров — купить билеты на паром', 4, null, false], ['Кино', 5, null, false],
  ['Разобрать почту', null, 'a', false], ['Идеи для ролика', null, 'b', false],
]
const tasks = titles.map(([title, day, assignee, done], i) => ({
  id: 't' + i, title, due: day === null ? null : d(day), assignee, done, position: i * 1000,
  notes: i === 3 ? 'Хедер + блок цен' : null, created_at: '',
}))
const q = (data: unknown): any => new Proxy({}, {
  get: (_t, k) => (k === 'then' ? (r: any) => r({ data, error: null }) : () => q(data)),
})
;(supabase as any).from = (t: string) => q(t === 'members' ? members : tasks)
createRoot(document.getElementById('root')!).render(<Board userEmail="me@x" />)
