import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ChevronDown, EyeOff, Flag, Hash, Search, X } from 'lucide-react'
import { useBoard } from '../board/BoardContext'
import { NO_FILTERS, hasActiveFilters } from '../board/layout'
import { tagColor } from '../lib/colors'
import { Avatar, Kbd, MenuItem, Popover, type Anchor } from './ui'
import { cx } from '../lib/cx'

/** Фильтры — одной строкой над статистикой и доской: всё ниже считается по тому же срезу. */
export function FilterBar({ searchRef, summary }: { searchRef: RefObject<HTMLInputElement | null>; summary: ReactNode }) {
  const { data, filters, setFilters } = useBoard()
  const [tagMenu, setTagMenu] = useState<Anchor | null>(null)
  const tagButton = useRef<HTMLButtonElement>(null)

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of data.tasks) for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
  }, [data.tasks])

  const set = (patch: Partial<typeof filters>) => setFilters({ ...filters, ...patch })

  return (
    <div className="thin-scroll -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-1 md:flex-wrap md:overflow-visible">
      <label className="flex h-9 w-44 shrink-0 items-center gap-2 rounded-lg bg-surface px-2.5 shadow-card focus-within:ring-2 focus-within:ring-focus/30 sm:w-52">
        <Search size={15} className="shrink-0 text-ink-3" aria-hidden />
        <input
          ref={searchRef}
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              set({ query: '' })
              e.currentTarget.blur()
            }
          }}
          placeholder="Поиск"
          aria-label="Поиск по делам"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
        {filters.query ? (
          <button type="button" aria-label="Очистить поиск" onClick={() => set({ query: '' })} className="text-ink-3 hover:text-ink">
            <X size={14} />
          </button>
        ) : (
          <Kbd>/</Kbd>
        )}
      </label>

      <div role="radiogroup" aria-label="Чьи дела" className="flex shrink-0 items-center gap-1">
        <FilterChip role="radio" active={filters.person === 'all'} onClick={() => set({ person: 'all' })}>
          Все
        </FilterChip>
        {data.members.map((m) => (
          <FilterChip key={m.id} role="radio" active={filters.person === m.id} onClick={() => set({ person: m.id })}>
            <Avatar member={m} size={18} />
            {m.name}
          </FilterChip>
        ))}
      </div>

      <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden />

      <FilterChip
        buttonRef={tagButton}
        active={filters.tag !== null}
        onClick={(e) => setTagMenu(tagMenu ? null : e.currentTarget.getBoundingClientRect())}
      >
        {filters.tag ? (
          <>
            <span className="size-2 rounded-full" style={{ background: tagColor(filters.tag) }} aria-hidden />
            {filters.tag}
          </>
        ) : (
          <>
            <Hash size={14} aria-hidden />
            Тег
          </>
        )}
        <ChevronDown size={13} className="opacity-60" aria-hidden />
      </FilterChip>
      <FilterChip active={filters.important} onClick={() => set({ important: !filters.important })}>
        <Flag size={13} aria-hidden />
        Важные
      </FilterChip>
      <FilterChip active={filters.hideDone} onClick={() => set({ hideDone: !filters.hideDone })}>
        <EyeOff size={13} aria-hidden />
        Скрыть готовые
      </FilterChip>
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => setFilters(NO_FILTERS)}
          className="h-8 shrink-0 rounded-lg px-2 text-[13px] text-ink-2 underline-offset-2 hover:text-ink hover:underline"
        >
          Сбросить
        </button>
      )}
      <span className="ml-auto hidden shrink-0 text-[13px] text-ink-3 md:inline">{summary}</span>

      {tagMenu && (
        <Popover anchor={tagMenu} onClose={() => setTagMenu(null)} ignoreRef={tagButton} label="Фильтр по тегу" width={220}>
          {tagCounts.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-ink-3">
              Тегов пока нет. Добавь их через # в названии: «Купить хлеб #дом».
            </p>
          ) : (
            <>
              <MenuItem
                label="Все теги"
                checked={filters.tag === null}
                onClick={() => {
                  set({ tag: null })
                  setTagMenu(null)
                }}
              />
              {tagCounts.map(([tag, count]) => (
                <MenuItem
                  key={tag}
                  icon={<span className="size-2 rounded-full" style={{ background: tagColor(tag) }} />}
                  label={tag}
                  hint={count}
                  checked={filters.tag === tag}
                  onClick={() => {
                    set({ tag })
                    setTagMenu(null)
                  }}
                />
              ))}
            </>
          )}
        </Popover>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  role,
  buttonRef,
}: {
  active: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
  role?: 'radio'
  buttonRef?: RefObject<HTMLButtonElement | null>
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role={role}
      aria-checked={role ? active : undefined}
      aria-pressed={role ? undefined : active}
      onClick={onClick}
      className={cx(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium transition-colors duration-150',
        active ? 'border-ink bg-ink text-page' : 'border-line-strong/70 text-ink-2 hover:bg-surface hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
