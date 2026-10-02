import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Keyboard,
  Link2,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  MoreVertical,
  Rows3,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react'
import type { BoardApi } from '../api/types'
import { BoardContext, type BoardCtx, type TaskDefaults } from '../board/BoardContext'
import {
  NO_FILTERS,
  applyFilters,
  buildColumns,
  buildLanes,
  containerId,
  groupIntoContainers,
  patchForContainer,
  type ColumnDef,
  type Filters,
  type View,
} from '../board/layout'
import { useBoardData, type BoardData } from '../board/useBoardData'
import { addDays, fromISODate, relativeDay, startOfWeek, toISODate, weekDays, weekLabel } from '../lib/dates'
import { POSITION_STEP, positionBetween } from '../lib/order'
import { inviteLink, load, loadMe, save, saveMe } from '../lib/storage'
import type { Member, Status, Task, TaskDraft, TaskPatch } from '../types'
import { BoardGrid } from './BoardGrid'
import { Composer } from './Composer'
import { FilterBar } from './FilterBar'
import { CardMenu, ColumnMenu } from './Menus'
import { MembersDialog } from './MembersDialog'
import { Logo, StatusScreen, WhoAmI } from './Onboarding'
import { QuickAdd } from './QuickAdd'
import { Stats } from './Stats'
import { TaskDialog } from './TaskDialog'
import { useToast } from './toast-context'
import { Avatar, IconButton, Kbd, MenuItem, MenuLabel, MenuSeparator, Popover, Segmented, type Anchor } from './ui'
import { cx } from '../lib/cx'

/** Дата «сегодня», которая сама обновится, если вкладка открыта через полночь. */
function useTodayISO() {
  const [iso, setIso] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setIso(toISODate(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])
  return iso
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

type Theme = 'system' | 'light' | 'dark'
function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('duo.theme', 'system'))
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    save('duo.theme', theme)
  }, [theme])
  return [theme, setTheme]
}

/** Загрузка доски и «кто ты?»; дальше — сама доска. */
export function BoardRoot({ api, onDenied, onForget }: { api: BoardApi; onDenied: () => void; onForget: () => void }) {
  const todayISO = useTodayISO()
  const today = useMemo(() => fromISODate(todayISO), [todayISO])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const weekStartISO = toISODate(weekStart)
  const isCurrentWeek = weekStartISO === toISODate(startOfWeek(today))
  const days = useMemo(() => weekDays(fromISODate(weekStartISO)), [weekStartISO])
  const range = useMemo(
    () => ({ from: weekStartISO, to: toISODate(days[6]), overdueBefore: isCurrentWeek ? weekStartISO : null }),
    [weekStartISO, days, isCurrentWeek],
  )
  const data = useBoardData(api, range)
  const [pickedMe, setPickedMe] = useState<string | null>(null)

  useEffect(() => {
    if (data.phase === 'denied') onDenied()
  }, [data.phase, onDenied])

  if (data.phase === 'offline' && !data.board) {
    return (
      <StatusScreen
        title="Нет связи с сервером"
        text="Проверь интернет. Если всё в порядке — сервер мог уснуть после недели без дела, ему нужна минута."
        action={
          <button
            type="button"
            onClick={data.retry}
            className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent"
          >
            Попробовать снова
          </button>
        }
      />
    )
  }
  if (!data.board || data.phase === 'loading' || data.phase === 'denied') return <BoardSkeleton />

  const board = data.board
  const me = data.members.find((m) => m.id === (pickedMe ?? loadMe(board.id))) ?? null
  const pick = (id: string) => {
    saveMe(board.id, id)
    setPickedMe(id)
  }
  if (!me) {
    return (
      <WhoAmI
        boardName={board.name}
        members={data.members}
        onPick={pick}
        onCreate={(name) => pick(data.createMember(name).id)}
      />
    )
  }

  return (
    <BoardView
      api={api}
      data={data}
      today={today}
      todayISO={todayISO}
      weekStart={weekStart}
      setWeekStart={setWeekStart}
      days={days}
      isCurrentWeek={isCurrentWeek}
      me={me}
      setMe={pick}
      onForget={onForget}
    />
  )
}

type Prefs = { view: View; lanes: boolean; stats: boolean }
type MenuState =
  | { kind: 'card'; task: Task; anchor: Anchor }
  | { kind: 'compose'; defaults: TaskDefaults; anchor: Anchor }
  | { kind: 'column'; column: ColumnDef; anchor: Anchor }
  | { kind: 'board'; anchor: Anchor }
  | { kind: 'keys'; anchor: Anchor }
  | null

const shorten = (s: string, n = 36) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function BoardView({
  api,
  data,
  today,
  todayISO,
  weekStart,
  setWeekStart,
  days,
  isCurrentWeek,
  me,
  setMe,
  onForget,
}: {
  api: BoardApi
  data: BoardData
  today: Date
  todayISO: string
  weekStart: Date
  setWeekStart: Dispatch<SetStateAction<Date>>
  days: Date[]
  isCurrentWeek: boolean
  me: Member
  setMe: (id: string) => void
  onForget: () => void
}) {
  const toast = useToast()
  const isWide = useMediaQuery('(min-width: 768px)')
  const [theme, setTheme] = useTheme()
  const [prefs, setPrefsState] = useState<Prefs>(() => ({
    view: 'week',
    lanes: false,
    stats: window.innerWidth >= 768,
    ...load<Partial<Prefs>>('duo.prefs', {}),
  }))
  const [filters, setFiltersState] = useState<Filters>(() => ({
    ...NO_FILTERS,
    ...load<Partial<Filters>>('duo.filters', {}),
    query: '',
  }))
  const [dialog, setDialog] = useState<{ task?: Task; defaults?: TaskDefaults } | null>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const quickRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const lastDrop = useRef(0)

  const setPrefs = useCallback(
    (patch: Partial<Prefs>) =>
      setPrefsState((p) => {
        const next = { ...p, ...patch }
        save('duo.prefs', next)
        return next
      }),
    [],
  )
  const setFilters = useCallback((f: Filters) => {
    setFiltersState(f)
    save('duo.filters', { ...f, query: '' })
  }, [])
  const closeMenu = useCallback(() => setMenu(null), [])

  const weekStartISO = toISODate(weekStart)
  const weekEndISO = toISODate(days[6])
  const view = prefs.view
  const lanesOn = prefs.lanes && isWide
  const memberById = useMemo(() => new Map(data.members.map((m) => [m.id, m])), [data.members])
  const filtered = useMemo(() => applyFilters(data.tasks, filters), [data.tasks, filters])
  const withOverdue =
    view === 'week' &&
    isCurrentWeek &&
    data.tasks.some((t) => t.due !== null && t.due < weekStartISO && t.status !== 'done')
  const columns = useMemo(() => buildColumns(view, days, todayISO, withOverdue), [view, days, todayISO, withOverdue])
  const lanes = useMemo(() => buildLanes(lanesOn, data.members), [lanesOn, data.members])
  const containers = useMemo(
    () => groupIntoContainers(filtered, columns, lanes, view, weekStartISO),
    [filtered, columns, lanes, view, weekStartISO],
  )
  const columnTasks = (col: ColumnDef) => lanes.flatMap((l) => containers.get(containerId(l.key, col.key)) ?? [])
  const endPosition = () => Math.max(0, ...data.tasks.map((t) => t.position)) + POSITION_STEP

  const addTask = (draft: TaskDraft): Task => {
    const task = data.createTask({ ...draft, position: endPosition() })
    if (task.due && (task.due < weekStartISO || task.due > weekEndISO)) {
      const target = startOfWeek(fromISODate(task.due))
      toast(`Добавлено на ${relativeDay(task.due, todayISO).toLowerCase()}`, {
        label: 'Показать',
        onClick: () => setWeekStart(target),
      })
    } else if (applyFilters([task], filters).length === 0) {
      toast('Добавлено, но скрыто фильтром', { label: 'Сбросить фильтры', onClick: () => setFilters(NO_FILTERS) })
    }
    return task
  }

  const setStatus = (task: Task, status: Status) => data.updateTask(task.id, { status })

  const removeTask = (arg: Task | Task[]) => {
    const list = Array.isArray(arg) ? arg : [arg]
    if (list.length === 0) return
    list.forEach((t) => data.deleteTask(t))
    toast(list.length === 1 ? `Удалено: «${shorten(list[0].title)}»` : `Удалено дел: ${list.length}`, {
      label: 'Отменить',
      onClick: () => list.forEach((t) => data.restoreTask(t)),
    })
  }

  const ctx: BoardCtx = {
    data,
    me,
    memberById,
    today,
    todayISO,
    weekStart,
    weekStartISO,
    view,
    filters,
    setFilters,
    addTask,
    updateTask: data.updateTask,
    toggleDone: (task) => setStatus(task, task.status === 'done' ? 'todo' : 'done'),
    setStatus,
    // Перенос через меню/форму — в конец новой колонки.
    moveTask: (task: Task, patch: TaskPatch) => data.updateTask(task.id, { ...patch, position: endPosition() }),
    duplicateTask: (task) => {
      const next = Math.min(...data.tasks.filter((t) => t.position > task.position).map((t) => t.position))
      data.createTask({
        title: task.title,
        notes: task.notes,
        due: task.due,
        due_time: task.due_time,
        assignee: task.assignee,
        priority: task.priority,
        tags: [...task.tags],
        checklist: task.checklist.map((c) => ({ ...c, id: crypto.randomUUID(), done: false })),
        position: positionBetween(task.position, Number.isFinite(next) ? next : undefined),
      })
      toast('Копия создана')
    },
    removeTask,
    defaultsFor: (id) => {
      const patch = patchForContainer(id) ?? {}
      return {
        status: patch.status ?? 'todo',
        due: 'due' in patch ? (patch.due ?? null) : isCurrentWeek ? todayISO : null,
        assignee:
          'assignee' in patch ? (patch.assignee ?? null) : filters.person !== 'all' ? filters.person : me.id,
      }
    },
    openTask: (task) => setDialog({ task }),
    openNew: (defaults) => setDialog({ defaults }),
    openComposer: (defaults, anchor) => setMenu({ kind: 'compose', defaults, anchor }),
    openCardMenu: (task, anchor) => setMenu({ kind: 'card', task, anchor }),
    openColumnMenu: (column, anchor) => setMenu({ kind: 'column', column, anchor }),
    wasDragging: () => Date.now() - lastDrop.current < 250,
  }

  // Горячие клавиши (по коду клавиши — работают и в русской раскладке).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest?.('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return
      const onCard = !!el.closest?.('[aria-roledescription]')
      switch (e.code) {
        case 'KeyN':
          e.preventDefault()
          quickRef.current?.focus()
          break
        case 'Slash':
          e.preventDefault()
          if (e.shiftKey && menuButton.current) setMenu({ kind: 'keys', anchor: menuButton.current.getBoundingClientRect() })
          else searchRef.current?.focus()
          break
        case 'ArrowLeft':
          if (!onCard) setWeekStart((w) => addDays(w, -7))
          break
        case 'ArrowRight':
          if (!onCard) setWeekStart((w) => addDays(w, 7))
          break
        case 'KeyT':
          setWeekStart(startOfWeek(new Date()))
          break
        case 'Digit1':
          setPrefs({ view: 'week' })
          break
        case 'Digit2':
          setPrefs({ view: 'status' })
          break
        case 'KeyL':
          if (isWide) setPrefs({ lanes: !prefs.lanes })
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isWide, prefs.lanes, setPrefs, setWeekStart])

  // На телефоне колонки идут столбиком — сразу показываем сегодняшний день.
  const scrolledToToday = useRef(false)
  useEffect(() => {
    if (scrolledToToday.current || data.phase !== 'ready' || isWide || view !== 'week') return
    scrolledToToday.current = true
    requestAnimationFrame(() => document.querySelector('[data-today]')?.scrollIntoView({ block: 'start' }))
  }, [data.phase, isWide, view])

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink(api.key))
      toast('Ссылка скопирована — отправь её другу')
    } catch {
      setMembersOpen(true)
    }
  }

  const visibleWeek = filtered.filter((t) => t.due !== null && t.due >= weekStartISO && t.due <= weekEndISO)
  const visibleDone = visibleWeek.filter((t) => t.status === 'done').length
  const menuAnchor = () => menuButton.current?.getBoundingClientRect() ?? { x: window.innerWidth - 16, y: 56 }

  return (
    <BoardContext.Provider value={ctx}>
      <div className="mx-auto max-w-[1920px] space-y-3 px-3 py-3 sm:px-5 sm:py-4">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-2.5">
          <div className="mr-auto flex min-w-0 items-center gap-3">
            <Logo size={34} />
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-bold leading-tight">{data.board?.name}</h1>
              <SyncStatus saving={data.saving} syncing={data.syncing} error={data.error} onRetry={data.retry} />
            </div>
          </div>

          <div className="order-last flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
            <div className="flex items-center rounded-lg bg-surface shadow-card">
              <button
                type="button"
                aria-label="Прошлая неделя"
                title="Прошлая неделя (←)"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                className="grid size-9 place-items-center rounded-l-lg text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                title="К текущей неделе (T)"
                className="h-9 min-w-[128px] px-1 text-[13px] font-medium tabular-nums text-ink"
              >
                {weekLabel(weekStart)}
              </button>
              <button
                type="button"
                aria-label="Следующая неделя"
                title="Следующая неделя (→)"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                className="grid size-9 place-items-center rounded-r-lg text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
              >
                <ChevronRight size={17} />
              </button>
            </div>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-today hover:bg-today/10"
              >
                Сегодня
              </button>
            )}
            <Segmented
              label="Вид доски"
              value={view}
              onChange={(v) => setPrefs({ view: v })}
              options={[
                { value: 'week', label: 'Неделя', title: 'Колонки по дням (1)' },
                { value: 'status', label: 'Статусы', title: 'Нужно сделать / В работе / Готово (2)' },
              ]}
            />
          </div>

          <div className="flex items-center gap-0.5">
            {isWide && (
              <IconButton
                label="Дорожки по людям (L)"
                active={prefs.lanes}
                onClick={() => setPrefs({ lanes: !prefs.lanes })}
              >
                <Rows3 size={18} />
              </IconButton>
            )}
            <IconButton label="Обзор недели" active={prefs.stats} onClick={() => setPrefs({ stats: !prefs.stats })}>
              <BarChart3 size={18} />
            </IconButton>
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              title="Доска и участники"
              aria-label="Доска и участники"
              className="ml-1 flex h-9 items-center rounded-lg px-1.5 hover:bg-ink/[0.07]"
            >
              {data.members.slice(0, 4).map((m, i) => (
                <span key={m.id} className={cx(i > 0 && '-ml-1.5')}>
                  <Avatar member={m} size={26} ring />
                </span>
              ))}
            </button>
            <IconButton
              label="Ещё"
              buttonRef={menuButton}
              onClick={(e) => setMenu(menu?.kind === 'board' ? null : { kind: 'board', anchor: e.currentTarget.getBoundingClientRect() })}
            >
              <MoreVertical size={18} />
            </IconButton>
          </div>
        </header>

        <QuickAdd inputRef={quickRef} />

        <FilterBar
          searchRef={searchRef}
          summary={
            <>
              На неделе {visibleWeek.length} · готово {visibleDone}
            </>
          }
        />

        {prefs.stats && (
          <Stats tasks={filtered} days={days} members={data.members} todayISO={todayISO} dim={data.stale} />
        )}

        <div className={cx('rounded-2xl bg-board px-2 transition-opacity duration-200 sm:px-3', data.stale && 'opacity-60')}>
          {data.tasks.length === 0 && data.phase === 'ready' && (
            <p className="flex items-start gap-2 px-1 pt-3 text-sm text-ink-2">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              Доска пустая. Напиши дело в строке сверху — например «Купить продукты завтра @{data.members[1]?.name ?? me.name}» — или нажми на любой день.
            </p>
          )}
          <BoardGrid columns={columns} lanes={lanes} containers={containers} onDropped={() => (lastDrop.current = Date.now())} />
        </div>
      </div>

      {dialog && (
        <TaskDialog key={dialog.task?.id ?? 'new'} task={dialog.task} defaults={dialog.defaults} onClose={() => setDialog(null)} />
      )}

      {menu?.kind === 'card' && (
        <Popover anchor={menu.anchor} onClose={closeMenu} label="Действия с делом" width={276}>
          <CardMenu task={menu.task} onDone={closeMenu} />
        </Popover>
      )}
      {menu?.kind === 'compose' && (
        <Popover anchor={menu.anchor} onClose={closeMenu} label="Новое дело" width={300}>
          <Composer defaults={menu.defaults} onDone={closeMenu} />
        </Popover>
      )}
      {menu?.kind === 'column' && (
        <Popover anchor={menu.anchor} onClose={closeMenu} label="Действия с колонкой" width={264}>
          <ColumnMenu column={menu.column} tasks={columnTasks(menu.column)} anchor={menu.anchor} onDone={closeMenu} />
        </Popover>
      )}
      {menu?.kind === 'board' && (
        <Popover anchor={menu.anchor} onClose={closeMenu} ignoreRef={menuButton} label="Меню доски" width={272}>
          <MenuItem
            icon={<Link2 size={15} />}
            label="Скопировать ссылку для друга"
            onClick={() => {
              closeMenu()
              void copyInvite()
            }}
          />
          <MenuItem
            icon={<Users size={15} />}
            label="Доска и участники"
            onClick={() => {
              closeMenu()
              setMembersOpen(true)
            }}
          />
          <MenuSeparator />
          <MenuLabel>Тема</MenuLabel>
          <MenuItem icon={<Monitor size={15} />} label="Как в системе" checked={theme === 'system'} onClick={() => setTheme('system')} />
          <MenuItem icon={<Sun size={15} />} label="Светлая" checked={theme === 'light'} onClick={() => setTheme('light')} />
          <MenuItem icon={<Moon size={15} />} label="Тёмная" checked={theme === 'dark'} onClick={() => setTheme('dark')} />
          <MenuSeparator />
          <MenuItem
            icon={<Keyboard size={15} />}
            label="Горячие клавиши"
            hint="?"
            onClick={() => setMenu({ kind: 'keys', anchor: menuAnchor() })}
          />
          <MenuItem icon={<LogOut size={15} />} label="Забыть доску на этом устройстве" danger onClick={onForget} />
        </Popover>
      )}
      {menu?.kind === 'keys' && (
        <Popover anchor={menu.anchor} onClose={closeMenu} ignoreRef={menuButton} label="Горячие клавиши" width={300}>
          <Shortcuts />
        </Popover>
      )}

      {membersOpen && (
        <MembersDialog boardKey={api.key} onSetMe={setMe} onForget={onForget} onClose={() => setMembersOpen(false)} />
      )}
    </BoardContext.Provider>
  )
}

function SyncStatus({
  saving,
  syncing,
  error,
  onRetry,
}: {
  saving: boolean
  syncing: boolean
  error: string | null
  onRetry: () => void
}) {
  if (error) {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={error}
        className="flex max-w-[60vw] items-center gap-1 text-xs text-danger hover:underline"
      >
        <CloudOff size={12} className="shrink-0" aria-hidden />
        <span className="truncate">{error}</span>
        <span className="shrink-0">· повторить</span>
      </button>
    )
  }
  return (
    <span aria-live="polite" className="flex items-center gap-1 text-xs text-ink-3">
      {saving || syncing ? (
        <>
          <Loader2 size={12} className="animate-spin" aria-hidden />
          {saving ? 'Сохраняю…' : 'Обновляю…'}
        </>
      ) : (
        <>
          <Check size={12} aria-hidden />
          Всё сохранено
        </>
      )}
    </span>
  )
}

function Shortcuts() {
  const rows: [string, string][] = [
    ['N', 'новое дело'],
    ['/', 'поиск'],
    ['← →', 'неделя назад / вперёд'],
    ['T', 'текущая неделя'],
    ['1 / 2', 'вид: неделя / статусы'],
    ['L', 'дорожки по людям'],
    ['Пробел', 'взять карточку и двигать стрелками'],
    ['Enter', 'открыть карточку'],
    ['Ctrl+Enter', 'сохранить в форме'],
  ]
  return (
    <div className="p-1.5">
      <p className="px-1 pb-2 text-[13px] font-medium">Горячие клавиши</p>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 px-1 pb-1 text-[13px]">
        {rows.map(([keys, what]) => (
          <div key={keys} className="contents">
            <dt className="flex gap-1">
              {keys.split(' / ').map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dt>
            <dd className="m-0 text-ink-2">{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="mx-auto max-w-[1920px] space-y-3 px-3 py-3 sm:px-5 sm:py-4" aria-busy="true" aria-label="Загружаю доску">
      <div className="flex items-center gap-3">
        <Logo size={34} />
        <div className="h-5 w-40 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-surface/70" />
      <div className="flex gap-3 rounded-2xl bg-board p-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-48 flex-1 animate-pulse rounded-lg bg-surface/60" />
        ))}
      </div>
    </div>
  )
}
