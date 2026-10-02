import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './parse'

const today = new Date(2026, 9, 2) // пятница, 2 октября 2026
const members = [
  { id: 'dan', name: 'Dan', color: '#000' },
  { id: 'max', name: 'Max', color: '#000' },
]
const parse = (s: string, base?: Date) => parseQuickAdd(s, { today, base, members })

describe('parseQuickAdd', () => {
  it('разбирает всё сразу', () => {
    expect(parse('Купить хлеб завтра @Max #дом !')).toEqual({
      title: 'Купить хлеб',
      due: '2026-10-03',
      assignee: 'max',
      tags: ['дом'],
      priority: 1,
    })
  })

  it('время и день недели с предлогами', () => {
    expect(parse('Созвон в 18:30 в пятницу')).toMatchObject({ title: 'Созвон', due: '2026-10-02', time: '18:30' })
    expect(parse('Сдать отчёт до пятницы')).toMatchObject({ title: 'Сдать отчёт', due: '2026-10-02' })
    expect(parse('Зарядка к 9:05')).toMatchObject({ title: 'Зарядка', time: '09:05' })
  })

  it('короткие дни недели — ближайший такой день', () => {
    expect(parse('Отчёт пн !!')).toMatchObject({ title: 'Отчёт', due: '2026-10-05', priority: 2 })
    expect(parse('Кино в чт')).toMatchObject({ title: 'Кино', due: '2026-10-08' })
  })

  it('день недели считается от просматриваемой недели', () => {
    expect(parse('Встреча в среду', new Date(2026, 9, 5))).toMatchObject({ due: '2026-10-07' })
  })

  it('даты числом и словами', () => {
    expect(parse('Поездка 12.10')).toMatchObject({ title: 'Поездка', due: '2026-10-12' })
    expect(parse('Подарок маме 5 ноября #Семья')).toMatchObject({
      title: 'Подарок маме',
      due: '2026-11-05',
      tags: ['семья'],
    })
    expect(parse('Отпуск 3 мая')).toMatchObject({ due: '2027-05-03' })
    expect(parse('Сессия 15.01')).toMatchObject({ due: '2027-01-15' })
    expect(parse('Счёт 01.10.2026')).toMatchObject({ due: '2026-10-01' })
  })

  it('без даты и «вместе»', () => {
    expect(parse('Идея без даты')).toMatchObject({ title: 'Идея', due: null })
    expect(parse('Уборка @вместе')).toMatchObject({ title: 'Уборка', assignee: null })
  })

  it('исполнитель по началу имени, без учёта регистра', () => {
    expect(parse('@da помыть машину')).toMatchObject({ title: 'помыть машину', assignee: 'dan' })
  })

  it('не трогает то, что не распознал', () => {
    expect(parse('Написать @someone')).toEqual({ title: 'Написать @someone', tags: [] })
    expect(parse('Позвонить завтраку')).toEqual({ title: 'Позвонить завтраку', tags: [] })
    expect(parse('Почта a@b.ru')).toEqual({ title: 'Почта a@b.ru', tags: [] })
    expect(parse('Счёт 18.30')).toEqual({ title: 'Счёт 18.30', tags: [] })
  })

  it('чистит знаки препинания по краям и дубли тегов', () => {
    expect(parse('Купить хлеб, завтра')).toMatchObject({ title: 'Купить хлеб' })
    expect(parse('#a задача #A')).toMatchObject({ title: 'задача', tags: ['a'] })
  })

  it('пустое название, если в строке одни метки', () => {
    expect(parse('!! #дом')).toMatchObject({ title: '', priority: 2, tags: ['дом'] })
  })
})
