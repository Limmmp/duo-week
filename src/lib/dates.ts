const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const shift = (r.getDay() + 6) % 7 // понедельник = 0
  r.setDate(r.getDate() - shift)
  return r
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export const weekdayName = (i: number) => WEEKDAYS[i]
export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`

export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  return `${shortDate(weekStart)} — ${shortDate(end)}`
}
