import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Check, Users } from 'lucide-react'
import { memberColor, memberInk } from '../lib/colors'
import { cx } from '../lib/cx'
import type { Member } from '../types'

export function Avatar({ member, size = 24, ring }: { member: Member | null; size?: number; ring?: boolean }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.46) }
  if (!member) {
    return (
      <span
        title="Вместе"
        style={style}
        className="grid shrink-0 place-items-center rounded-full bg-ink/10 text-ink-2"
      >
        <Users size={Math.round(size * 0.55)} aria-hidden />
      </span>
    )
  }
  return (
    <span
      title={member.name}
      style={{ ...style, background: memberColor(member.color), color: memberInk(member.color) }}
      className={cx(
        'grid shrink-0 select-none place-items-center rounded-full font-bold',
        ring && 'ring-2 ring-surface',
      )}
    >
      {member.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function IconButton({
  label,
  onClick,
  active,
  children,
  className,
  buttonRef,
}: {
  label: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  active?: boolean
  children: ReactNode
  className?: string
  buttonRef?: RefObject<HTMLButtonElement | null>
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-150',
        active ? 'bg-ink text-page' : 'text-ink-2 hover:bg-ink/[0.07] hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-line bg-surface-2 px-1 font-sans text-[11px] font-medium text-ink-3">
      {children}
    </kbd>
  )
}

export type Anchor = DOMRect | { x: number; y: number }

/**
 * Всплывающая панель: по клику на кнопку (якорь — её прямоугольник) или по правому клику (точка).
 * Закрывается по Esc, клику мимо и прокрутке; стрелки ↑↓ ходят по кнопкам, фокус возвращается назад.
 */
export function Popover({
  anchor,
  onClose,
  label,
  width = 248,
  ignoreRef,
  children,
}: {
  anchor: Anchor
  onClose: () => void
  label: string
  width?: number
  ignoreRef?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const h = el.offsetHeight
    let left: number
    let top: number
    if ('width' in anchor) {
      left = anchor.left
      top = anchor.bottom + 6
      if (top + h > vh - 8 && anchor.top - h - 6 > 8) top = anchor.top - h - 6
    } else {
      left = anchor.x
      top = anchor.y
    }
    setPos({
      left: Math.min(Math.max(8, left), vw - el.offsetWidth - 8),
      top: Math.min(Math.max(8, top), Math.max(8, vh - h - 8)),
    })
  }, [anchor])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const inside = (t: EventTarget | null) =>
      t instanceof Node && (ref.current?.contains(t) || ignoreRef?.current?.contains(t))
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) closeRef.current()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        closeRef.current()
      }
    }
    // Прокрутка закрывает панель — кроме первых мгновений: её могла вызвать сама прокрутка к якорю.
    const openedAt = performance.now()
    const onScroll = (e: Event) => {
      if (performance.now() - openedAt > 300 && !inside(e.target)) closeRef.current()
    }
    const onResize = () => closeRef.current()
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    ref.current?.querySelector<HTMLElement>('[data-autofocus], button:not([disabled]), input')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      if (previous?.isConnected) previous.focus()
    }
  }, [ignoreRef])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if ((e.target as HTMLElement).closest('input, textarea')) return // там стрелки двигают курсор
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
    if (items.length === 0) return
    e.preventDefault()
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next].focus()
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
      className="fixed z-50 max-h-[min(80dvh,560px)] select-none overflow-y-auto rounded-xl bg-surface p-1.5 text-ink shadow-pop animate-pop"
    >
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({
  icon,
  label,
  hint,
  onClick,
  danger,
  checked,
  disabled,
}: {
  icon?: ReactNode
  label: string
  hint?: ReactNode
  onClick: () => void
  danger?: boolean
  checked?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors duration-100',
        'hover:bg-ink/[0.06] focus-visible:bg-ink/[0.06] focus-visible:outline-none disabled:opacity-40',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      <span className="grid w-4 shrink-0 place-items-center text-ink-3">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {checked && <Check size={15} className="shrink-0 text-ink" aria-label="выбрано" />}
      {hint && <span className="shrink-0 text-xs text-ink-3">{hint}</span>}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{children}</div>
}

export const MenuSeparator = () => <div className="mx-1.5 my-1 h-px bg-line" />

export function MenuChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1 px-1.5 pb-1">{children}</div>
}

export function MenuChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors',
        active ? 'bg-ink text-page' : 'bg-ink/[0.05] text-ink-2 hover:bg-ink/10 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-ink/[0.06] p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex items-center gap-1.5 rounded-md font-medium transition-all duration-150',
            size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Кружок статуса: пустой — нужно сделать, синий с точкой — в работе, бирюзовый с галочкой — готово. */
export function StatusDot({ status, size = 18 }: { status: 'todo' | 'doing' | 'done'; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cx(
        'grid place-items-center rounded-full border-[1.5px] transition-colors duration-150',
        status === 'done' && 'border-done bg-done text-white',
        status === 'doing' && 'border-doing text-doing',
        status === 'todo' && 'border-ink-3/60',
      )}
    >
      {status === 'done' && <Check size={size * 0.62} strokeWidth={3.2} aria-hidden />}
      {status === 'doing' && <span className="size-[45%] rounded-full bg-doing" />}
    </span>
  )
}
