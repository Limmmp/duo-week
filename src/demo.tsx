// Только для разработки: доска на данных в памяти, без сервера. Открывать /demo.html — в сборку не попадает.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createMemoryApi } from './api/memory'
import { BoardRoot } from './components/Board'
import { ToastProvider } from './components/Toasts'
import { addDays, startOfWeek, toISODate } from './lib/dates'
import { saveMe } from './lib/storage'
import type { Task } from './types'

const week = startOfWeek(new Date())
const day = (i: number) => toISODate(addDays(week, i))
const board = { id: 'demo-board', name: 'Неделя на двоих' }
const members = [
  { id: 'dan', name: 'Dan', color: '#4a3aa7' },
  { id: 'max', name: 'Max', color: '#eb6834' },
]

let pos = 0
const t = (title: string, over: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(),
  title,
  notes: null,
  due: null,
  due_time: null,
  assignee: null,
  status: 'todo',
  priority: 0,
  tags: [],
  checklist: [],
  position: (pos += 1024),
  created_at: new Date().toISOString(),
  done_at: null,
  ...over,
})
const cl = (...items: [string, boolean][]) => items.map(([text, done]) => ({ id: crypto.randomUUID(), text, done }))

const tasks: Task[] = [
  t('Сдать квартальный отчёт', { due: day(-9), assignee: 'dan', priority: 2, tags: ['работа'] }),
  t('Созвон с клиентом по лендингу', { due: day(0), assignee: 'dan', status: 'done', due_time: '11:00:00', tags: ['работа'] }),
  t('Купить продукты на неделю', { due: day(0), status: 'done', checklist: cl(['Молоко', true], ['Овощи', true], ['Кофе', true]) }),
  t('Спортзал', { due: day(1), assignee: 'max', status: 'done', due_time: '19:30:00', tags: ['спорт'] }),
  t('Доделать макет лендинга', { due: day(1), assignee: 'dan', status: 'doing', notes: 'Хедер, блок цен и отзывы. Потом показать клиенту.', tags: ['работа'], checklist: cl(['Хедер', true], ['Цены', true], ['Отзывы', false], ['Мобильная версия', false]) }),
  t('Забрать посылку на почте', { due: day(2), assignee: 'max', priority: 1 }),
  t('Отчёт по проекту', { due: day(3), assignee: 'dan', priority: 1, tags: ['работа'] }),
  t('Записаться к стоматологу', { due: day(3), assignee: 'max' }),
  t('Поездка на Русский остров', { due: day(5), notes: 'Паром в 10:30 с Морвокзала. Взять термос и пауэрбанк, вернуться к 18:00.', due_time: '10:30:00', tags: ['отдых'] }),
  t('Кино вечером', { due: day(5), due_time: '20:00:00', tags: ['отдых'] }),
  t('Уборка квартиры', { due: day(6), checklist: cl(['Пропылесосить', false], ['Окна', false]) }),
  t('Разобрать почту', { assignee: 'dan' }),
  t('Идеи для ролика', { assignee: 'max', tags: ['идеи'] }),
  t('Подарок маме на ДР', { priority: 1, tags: ['семья'] }),
]

saveMe(board.id, 'dan')
const api = createMemoryApi({ board, members, tasks })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <BoardRoot api={api} onDenied={() => {}} onForget={() => {}} />
    </ToastProvider>
  </StrictMode>,
)
