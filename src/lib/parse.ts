import type { Member, Priority } from '../types'
import { addDays, toISODate, weekdayIndex } from './dates'

/**
 * Разбор строки быстрого добавления:
 * «Созвон завтра в 18:30 @Max #работа !» → название + день, время, исполнитель, теги, важность.
 * Поле не задано (undefined) — значит, в тексте его не было и действует значение по умолчанию.
 */
export type QuickParse = {
  title: string
  due?: string | null // null — явно «без даты»
  time?: string // HH:MM
  assignee?: string | null // null — явно «вместе»
  priority?: Priority
  tags: string[]
}

type Options = {
  today: Date
  /** От какого дня считать «в среду»: сегодня или понедельник просматриваемой недели. */
  base?: Date
  members: Member[]
}

// \b в JS не понимает кириллицу — границы слова задаём через Unicode-классы.
const W = '\\p{L}\\p{N}_'
const START = `(?<![${W}])`
const END = `(?![${W}])`
const re = (body: string) => new RegExp(`${START}${body}${END}`, 'giu')

const WEEKDAY_FORMS: string[][] = [
  ['понедельник', 'понедельника', 'понедельнику', 'пн'],
  ['вторник', 'вторника', 'вторнику', 'вт'],
  ['среда', 'среду', 'среды', 'среде', 'ср'],
  ['четверг', 'четверга', 'четвергу', 'чт'],
  ['пятница', 'пятницу', 'пятницы', 'пятнице', 'пт'],
  ['суббота', 'субботу', 'субботы', 'субботе', 'сб'],
  ['воскресенье', 'воскресенья', 'воскресенью', 'вс'],
]
const WEEKDAY_INDEX = new Map(WEEKDAY_FORMS.flatMap((forms, i) => forms.map((f) => [f, i] as const)))
const MONTH_STEMS = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const TOGETHER = new Set(['вместе', 'оба', 'все', 'both', 'all'])

const PATTERNS = {
  tag: re('#([\\p{L}\\p{N}_-]+)'),
  person: re('@([\\p{L}\\p{N}_.-]+)'),
  priority: /(?<!\S)(!{1,3})(?!\S)/gu,
  noDate: re('без\\s+(?:даты|срока)'),
  time: re('(?:(?:в|к)\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)'),
  relative: re('(?:на\\s+)?(сегодня|завтра|послезавтра)'),
  weekday: re(`(?:(?:в|во|на|до|к)\\s+)?(${[...WEEKDAY_INDEX.keys()].sort((a, b) => b.length - a.length).join('|')})`),
  numericDate: re('(?:(?:на|до|к)\\s+)?(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}|\\d{2}))?'),
  textDate: re('(?:(?:на|до|к)\\s+)?(\\d{1,2})\\s+(янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)\\p{L}*\\.?'),
}

function validDate(y: number, m: number, d: number): Date | null {
  const date = new Date(y, m, d)
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date : null
}

/** Без года: если дата прошла больше двух месяцев назад — значит, имеется в виду следующий год. */
function withYear(today: Date, month: number, day: number, year?: number): Date | null {
  if (year !== undefined) return validDate(year, month, day)
  const date = validDate(today.getFullYear(), month, day)
  if (date && date < addDays(today, -60)) return validDate(today.getFullYear() + 1, month, day)
  return date
}

export function parseQuickAdd(input: string, { today, base = today, members }: Options): QuickParse {
  let text = ` ${input} `
  const result: QuickParse = { title: '', tags: [] }

  /** Вырезает первое совпадение, которое принял обработчик (вернул не false). */
  function take(pattern: RegExp, accept: (m: RegExpExecArray) => boolean | void): boolean {
    pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text))) {
      if (accept(m) !== false) {
        text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`
        return true
      }
    }
    return false
  }

  let moreTags = true
  while (moreTags) {
    moreTags = take(PATTERNS.tag, (m) => {
      const tag = m[1].toLowerCase()
      if (!result.tags.includes(tag) && result.tags.length < 12) result.tags.push(tag)
    })
  }

  take(PATTERNS.person, (m) => {
    const name = m[1].toLowerCase()
    if (TOGETHER.has(name)) {
      result.assignee = null
      return
    }
    const member =
      members.find((x) => x.name.toLowerCase() === name) ??
      members.find((x) => x.name.toLowerCase().startsWith(name))
    if (!member) return false
    result.assignee = member.id
  })

  take(PATTERNS.priority, (m) => {
    result.priority = m[1].length === 1 ? 1 : 2
  })

  take(PATTERNS.time, (m) => {
    result.time = `${m[1].padStart(2, '0')}:${m[2]}`
  })

  const setDue = (d: Date | null) => {
    if (!d) return false
    result.due = toISODate(d)
  }
  const found =
    take(PATTERNS.noDate, () => {
      result.due = null
    }) ||
    take(PATTERNS.relative, (m) => {
      const shift = { сегодня: 0, завтра: 1, послезавтра: 2 }[m[1].toLowerCase()] ?? 0
      return setDue(addDays(today, shift))
    }) ||
    take(PATTERNS.numericDate, (m) => {
      const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined
      return setDue(withYear(today, Number(m[2]) - 1, Number(m[1]), year))
    }) ||
    take(PATTERNS.textDate, (m) => {
      const stem = m[2].toLowerCase()
      const month = MONTH_STEMS.findIndex((s) => stem.startsWith(s))
      return setDue(withYear(today, month, Number(m[1])))
    })
  if (!found) {
    take(PATTERNS.weekday, (m) => {
      const target = WEEKDAY_INDEX.get(m[1].toLowerCase())
      if (target === undefined) return false
      return setDue(addDays(base, (target - weekdayIndex(base) + 7) % 7))
    })
  }

  result.title = text
    .replace(/\s+/gu, ' ')
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/gu, '')
    .trim()
  return result
}
