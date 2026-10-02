const pad = (n: number) => String(n).padStart(2, '0')
const DAY_MS = 86_400_000

export const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Локальная полночь, без сдвига часового пояса (new Date('2026-10-02') дал бы UTC). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + n)
  return r
}

/** 0 — понедельник, 6 — воскресенье. */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7

export function startOfWeek(d: Date): Date {
  return addDays(d, -weekdayIndex(d))
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** Сколько дней от b до a (a − b). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / DAY_MS)
}

export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`

export function weekLabel(weekStart: Date): string {
  return `${shortDate(weekStart)} — ${shortDate(addDays(weekStart, 6))}`
}

/** «Сегодня», «Завтра», «Пт, 3 окт», «Без даты». */
export function relativeDay(iso: string | null, todayISO: string): string {
  if (!iso) return 'Без даты'
  const diff = diffDays(iso, todayISO)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Завтра'
  if (diff === -1) return 'Вчера'
  const d = fromISODate(iso)
  return `${WEEKDAYS_SHORT[weekdayIndex(d)]}, ${shortDate(d)}`
}

export const formatTime = (t: string | null) => (t ? t.slice(0, 5) : null)
