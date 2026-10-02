import { useState, type ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader, Table2 } from 'lucide-react'
import { WEEKDAYS_SHORT, shortDate, toISODate, weekdayIndex } from '../lib/dates'
import { memberColor } from '../lib/colors'
import type { Member, Status, Task } from '../types'
import { Avatar } from './ui'
import { cx } from '../lib/cx'

type DayStat = { iso: string; date: Date; todo: number; doing: number; done: number; total: number }

// Порядок сверху вниз в легенде совпадает с порядком сегментов в столбике.
const SERIES: { key: Status; label: string; color: string }[] = [
  { key: 'done', label: 'Готово', color: 'var(--done)' },
  { key: 'doing', label: 'В работе', color: 'var(--doing)' },
  { key: 'todo', label: 'Осталось', color: 'var(--todo)' },
]
const PLOT_H = 88

/**
 * Обзор недели. По правилам dataviz: один «герой»-показатель, столбики ≤ 24px с 2px зазором
 * между сегментами, легенда + подписи на вершинах, подсказка на наведение и фокус,
 * у каждого графика есть табличный вид.
 */
export function Stats({
  tasks,
  days,
  members,
  todayISO,
  dim,
}: {
  tasks: Task[]
  days: Date[]
  members: Member[]
  todayISO: string
  dim: boolean
}) {
  const from = toISODate(days[0])
  const to = toISODate(days[6])
  const week = tasks.filter((t) => t.due !== null && t.due >= from && t.due <= to)
  const done = week.filter((t) => t.status === 'done').length
  const doing = week.filter((t) => t.status === 'doing').length
  const overdue = tasks.filter((t) => t.status !== 'done' && t.due !== null && t.due < todayISO).length
  const backlog = tasks.filter((t) => t.due === null && t.status !== 'done').length
  const pct = week.length ? Math.round((done / week.length) * 100) : 0

  const byDay: DayStat[] = days.map((date) => {
    const iso = toISODate(date)
    const list = week.filter((t) => t.due === iso)
    const count = (s: Status) => list.filter((t) => t.status === s).length
    return { iso, date, todo: count('todo'), doing: count('doing'), done: count('done'), total: list.length }
  })

  const people = [...members, null].map((member) => {
    const list = week.filter((t) => (member ? t.assignee === member.id : t.assignee === null))
    return { member, total: list.length, done: list.filter((t) => t.status === 'done').length }
  })

  return (
    <section
      aria-label="Обзор недели"
      className={cx(
        'grid gap-3 transition-opacity duration-200 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1.1fr)]',
        dim && 'opacity-60',
      )}
    >
      <StatCard title="Прогресс недели">
        {week.length === 0 ? (
          <p className="py-4 text-sm text-ink-3">На этой неделе дел пока нет — добавь первое строкой выше.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold leading-none tracking-tight">{pct}%</span>
              <span className="text-sm text-ink-2">
                готово {done} из {week.length}
              </span>
            </div>
            <div
              role="meter"
              aria-label="Доля готовых дел недели"
              aria-valuemin={0}
              aria-valuemax={week.length}
              aria-valuenow={done}
              className="mt-3 h-2 overflow-hidden rounded-full bg-done/20"
            >
              <div className="h-full rounded-full bg-done transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Kpi icon={<Loader size={14} className="text-doing" />} label="В работе" value={doing} />
          <Kpi
            icon={<AlertTriangle size={14} className={overdue ? 'text-danger' : 'text-ink-3'} />}
            label="Просрочено"
            value={overdue}
          />
          <Kpi icon={<Inbox size={14} className="text-ink-3" />} label="Без даты" value={backlog} />
        </dl>
      </StatCard>

      <ByDayChart data={byDay} todayISO={todayISO} />

      <StatCard title="Кто сколько" subtitle="готово из запланированного на неделю">
        <ul className="space-y-3">
          {people.map(({ member, total, done }) => (
            <li key={member?.id ?? 'both'} className="flex items-center gap-2.5">
              <Avatar member={member} size={24} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium">{member?.name ?? 'Вместе'}</span>
                  <span className="shrink-0 text-ink-2">
                    {done} из {total}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full"
                  style={{
                    background: `color-mix(in oklab, ${member ? memberColor(member.color) : 'var(--todo)'} 22%, transparent)`,
                  }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: total ? `${(done / total) * 100}%` : 0,
                      background: member ? memberColor(member.color) : 'var(--todo)',
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </StatCard>
    </section>
  )
}

function StatCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <figure className="m-0 rounded-xl bg-surface p-4 shadow-card">
      <figcaption className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink">{title}</div>
          {subtitle && <div className="text-xs text-ink-3">{subtitle}</div>}
        </div>
        {action}
      </figcaption>
      {children}
    </figure>
  )
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2.5 py-2">
      <dt className="flex items-center gap-1 text-xs text-ink-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold leading-tight">{value}</dd>
    </div>
  )
}

function ByDayChart({ data, todayISO }: { data: DayStat[]; todayISO: string }) {
  const [table, setTable] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...data.map((d) => d.total))
  const hovered = data.find((d) => d.iso === hover)

  return (
    <StatCard
      title="По дням"
      subtitle="сколько дел запланировано и в каком они статусе"
      action={
        <button
          type="button"
          aria-pressed={table}
          onClick={() => setTable(!table)}
          title={table ? 'Показать графиком' : 'Показать таблицей'}
          className={cx(
            'flex h-7 items-center gap-1 rounded-md px-2 text-xs',
            table ? 'bg-ink/[0.08] text-ink' : 'text-ink-3 hover:bg-ink/[0.06] hover:text-ink',
          )}
        >
          <Table2 size={13} aria-hidden />
          Таблица
        </button>
      }
    >
      {table ? (
        <table className="w-full text-left text-[13px]">
          <thead className="text-xs text-ink-3">
            <tr>
              <th className="pb-1.5 font-normal">День</th>
              {SERIES.map((s) => (
                <th key={s.key} className="pb-1.5 text-right font-normal">
                  {s.label}
                </th>
              ))}
              <th className="pb-1.5 text-right font-normal">Всего</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.map((d) => (
              <tr key={d.iso} className={cx('border-t border-line', d.iso === todayISO && 'font-medium')}>
                <td className="py-1">
                  {WEEKDAYS_SHORT[weekdayIndex(d.date)]}, {shortDate(d.date)}
                </td>
                {SERIES.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {d[s.key]}
                  </td>
                ))}
                <td className="py-1 text-right">{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2" aria-label="Легенда">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
                {s.label}
              </li>
            ))}
          </ul>
          <div className="relative">
            <div className="grid grid-cols-7 gap-1" onPointerLeave={() => setHover(null)}>
              {data.map((d) => {
                const segments = SERIES.slice().reverse().filter((s) => d[s.key] > 0) // снизу вверх: готово → осталось
                const top = segments.at(-1)?.key
                const isToday = d.iso === todayISO
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onPointerEnter={() => setHover(d.iso)}
                    onFocus={() => setHover(d.iso)}
                    onBlur={() => setHover(null)}
                    aria-label={`${WEEKDAYS_SHORT[weekdayIndex(d.date)]}, ${shortDate(d.date)}: готово ${d.done}, в работе ${d.doing}, осталось ${d.todo}`}
                    className={cx(
                      'group/bar flex cursor-default flex-col items-center rounded-md pt-1 outline-offset-0',
                      hover === d.iso && 'bg-ink/[0.04]',
                    )}
                  >
                    <span className="h-4 text-[11px] font-medium leading-4 text-ink-2">{d.total > 0 ? d.total : ''}</span>
                    <span className="flex w-full flex-col-reverse items-center gap-[2px]" style={{ height: PLOT_H }}>
                      {SERIES.slice()
                        .reverse()
                        .map((s) =>
                          d[s.key] > 0 ? (
                            <span
                              key={s.key}
                              className={cx('w-[22px] max-w-[70%] transition-[height] duration-500', s.key === top && 'rounded-t-[4px]')}
                              style={{ height: Math.max(3, (d[s.key] / max) * (PLOT_H - 2 * segments.length)), background: s.color }}
                            />
                          ) : null,
                        )}
                    </span>
                    <span className="mt-1 h-px w-full bg-line" aria-hidden />
                    <span
                      className={cx(
                        'mt-1 text-xs',
                        isToday ? 'font-semibold text-today' : 'text-ink-3',
                      )}
                    >
                      {WEEKDAYS_SHORT[weekdayIndex(d.date)]}
                    </span>
                  </button>
                )
              })}
            </div>
            {hovered && hovered.total > 0 && (
              <div
                role="tooltip"
                className="pointer-events-none absolute top-0 z-10 rounded-lg bg-ink px-2.5 py-2 text-xs text-page shadow-pop"
                style={{
                  left: `calc(${(data.indexOf(hovered) + 0.5) * (100 / 7)}% )`,
                  transform: `translateX(${data.indexOf(hovered) > 4 ? '-100%' : data.indexOf(hovered) < 2 ? '0' : '-50%'})`,
                }}
              >
                <div className="mb-1 font-medium">
                  {WEEKDAYS_SHORT[weekdayIndex(hovered.date)]}, {shortDate(hovered.date)}
                </div>
                {SERIES.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                    <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
                    <span className="font-semibold tabular-nums">{hovered[s.key]}</span>
                    <span className="opacity-75">{s.label.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </StatCard>
  )
}
