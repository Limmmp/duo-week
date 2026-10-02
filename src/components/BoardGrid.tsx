import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useBoard } from '../board/BoardContext'
import { containerId, patchForContainer, type ColumnDef, type LaneDef } from '../board/layout'
import { needsRebalance, positionBetween, rebalanced } from '../lib/order'
import type { Task, TaskPatch } from '../types'
import { Cell, ColumnHeader } from './Column'
import { CardBody } from './TaskCard'
import { Avatar } from './ui'
import { cx } from '../lib/cx'

type Items = Record<string, string[]>

const dropAnimation: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
}

const announcements: Announcements = {
  onDragStart: () => 'Дело взято. Стрелками — переместить, пробел — отпустить, Esc — отменить.',
  onDragOver: ({ over }) => (over ? 'Дело над новым местом.' : 'Дело вне колонок.'),
  onDragEnd: ({ over }) => (over ? 'Дело перемещено.' : 'Дело возвращено на место.'),
  onDragCancel: () => 'Перемещение отменено.',
}

/**
 * Доска с перетаскиванием между колонками и дорожками.
 * Во время перетаскивания порядок живёт в локальном items (карточка вживую раздвигает соседей
 * в чужой колонке); на отпускании считаем новую позицию и одним изменением сохраняем.
 */
export function BoardGrid({
  columns,
  lanes,
  containers,
  onDropped,
}: {
  columns: ColumnDef[]
  lanes: LaneDef[]
  containers: Map<string, Task[]>
  onDropped: () => void
}) {
  const { data, me } = useBoard()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<Items | null>(null)
  const [origin, setOrigin] = useState<{ container: string; index: number } | null>(null)
  const lastOverId = useRef<UniqueIdentifier | null>(null)
  const recentlyMovedToNewContainer = useRef(false)

  const tasksById = useMemo(() => new Map(data.tasks.map((t) => [t.id, t])), [data.tasks])
  const baseItems = useMemo<Items>(
    () => Object.fromEntries([...containers].map(([key, list]) => [key, list.map((t) => t.id)])),
    [containers],
  )
  const current = items ?? baseItems

  const findContainer = useCallback(
    (id: UniqueIdentifier, source: Items) => {
      const key = String(id)
      if (key in source) return key
      return Object.keys(source).find((k) => source[k].includes(key))
    },
    [],
  )

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false
    })
  }, [items])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )

  // Стратегия из примера dnd-kit «multiple containers»: сначала указатель, потом пересечение,
  // а внутри непустой колонки — ближайшая карточка.
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const source = items ?? baseItems
      const pointer = pointerWithin(args)
      const intersections = pointer.length > 0 ? pointer : rectIntersection(args)
      let overId = getFirstCollision(intersections, 'id')
      if (overId != null) {
        const key = String(overId)
        if (key in source && source[key].length > 0) {
          const ids = source[key]
          overId =
            closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) => c.id !== overId && ids.includes(String(c.id)),
              ),
            })[0]?.id ?? overId
        }
        lastOverId.current = overId
        return [{ id: overId }]
      }
      if (recentlyMovedToNewContainer.current) lastOverId.current = activeId
      return lastOverId.current ? [{ id: lastOverId.current }] : []
    },
    [items, baseItems, activeId],
  )

  function finish() {
    setActiveId(null)
    setItems(null)
    setOrigin(null)
    lastOverId.current = null
    onDropped()
    data.setPaused(false)
  }

  function onDragStart({ active }: DragStartEvent) {
    const container = findContainer(active.id, baseItems)
    if (!container) return
    setOrigin({ container, index: baseItems[container].indexOf(String(active.id)) })
    setActiveId(String(active.id))
    setItems(baseItems)
    data.setPaused(true)
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !items) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = findContainer(activeKey, items)
    const to = findContainer(overKey, items)
    if (!from || !to || from === to) return
    // В «хвосты» можно только вернуть то, что оттуда же и взяли.
    if (to !== origin?.container && patchForContainer(to) === null) return

    setItems((prev) => {
      if (!prev) return prev
      const overItems = prev[to]
      let index = overItems.length
      if (!(overKey in prev)) {
        const overIndex = overItems.indexOf(overKey)
        const translated = active.rect.current.translated
        const below = translated && translated.top > over.rect.top + over.rect.height
        index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : overItems.length
      }
      recentlyMovedToNewContainer.current = true
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== activeKey),
        [to]: [...overItems.slice(0, index), activeKey, ...overItems.slice(index)],
      }
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const snapshot = items
    const start = origin
    finish()
    if (!snapshot || !over || !start) return

    const activeKey = String(active.id)
    const container = findContainer(activeKey, snapshot)
    const overContainer = findContainer(String(over.id), snapshot)
    if (!container || !overContainer) return

    let list = snapshot[container]
    if (container === overContainer) {
      const fromIndex = list.indexOf(activeKey)
      const toIndex = list.indexOf(String(over.id))
      if (toIndex >= 0 && fromIndex !== toIndex) list = arrayMove(list, fromIndex, toIndex)
    }
    const index = list.indexOf(activeKey)
    if (container === start.container && index === start.index) return

    const patch: TaskPatch = container === start.container ? {} : (patchForContainer(container) ?? {})
    const prevPos = tasksById.get(list[index - 1])?.position
    const nextPos = tasksById.get(list[index + 1])?.position

    if (needsRebalance(prevPos, nextPos)) {
      const positions = rebalanced(list)
      data.updateTasks(
        list.map((id) => ({ id, patch: id === activeKey ? { ...patch, position: positions.get(id)! } : { position: positions.get(id)! } })),
      )
    } else {
      data.updateTasks([{ id: activeKey, patch: { ...patch, position: positionBetween(prevPos, nextPos) } }])
    }
  }

  const activeTask = activeId ? tasksById.get(activeId) : undefined
  const activeContainer = activeId && items ? findContainer(activeId, items) : undefined
  const highlighted = activeContainer && activeContainer !== origin?.container ? activeContainer : null
  const tasksOf = (key: string) => (current[key] ?? []).map((id) => tasksById.get(id)).filter((t): t is Task => !!t)
  const meLane = lanes.find((l) => l.key === me?.id)?.key ?? 'both'
  const columnTasks = (col: ColumnDef) => lanes.flatMap((lane) => containers.get(containerId(lane.key, col.key)) ?? [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Чтобы перенести дело, нажмите пробел, двигайте стрелками и отпустите пробелом. Esc — отмена.',
        },
      }}
    >
      {lanes.length === 1 ? (
        <div className="thin-scroll flex flex-col md:flex-row md:overflow-x-auto">
          {columns.map((col) => {
            const id = containerId(lanes[0].key, col.key)
            return (
              <section
                key={col.key}
                aria-label={col.kind === 'day' ? col.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : undefined}
                data-today={(col.kind === 'day' && col.isToday) || undefined}
                className={cx(
                  'flex min-w-0 scroll-mt-4 flex-col py-3 md:min-w-[172px] md:flex-1 md:basis-0 md:px-2',
                  'border-line max-md:border-t max-md:first:border-t-0 md:border-l md:first:border-l-0',
                  col.kind === 'day' && col.isToday && 'bg-today/[0.035]',
                  col.kind === 'overdue' && 'bg-danger/[0.04]',
                )}
              >
                <ColumnHeader column={col} tasks={columnTasks(col)} addTarget={id} />
                <Cell id={id} column={col} tasks={tasksOf(id)} highlight={highlighted === id} />
              </section>
            )
          })}
        </div>
      ) : (
        <div className="thin-scroll overflow-x-auto">
          <div
            className="grid min-w-max md:min-w-0"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(172px, 1fr))` }}
          >
            {columns.map((col, i) => (
              <div
                key={col.key}
                className={cx(
                  'px-2 pt-3',
                  i > 0 && 'border-l border-line',
                  col.kind === 'day' && col.isToday && 'bg-today/[0.035]',
                )}
              >
                <ColumnHeader
                  column={col}
                  tasks={columnTasks(col)}
                  addTarget={containerId(meLane, col.key)}
                />
              </div>
            ))}
            {lanes.map((lane) => {
              const laneCount = columns.reduce((n, col) => n + (containers.get(containerId(lane.key, col.key))?.length ?? 0), 0)
              return (
                <Fragment key={lane.key}>
                  <div
                    style={{ gridColumn: '1 / -1' }}
                    className="flex items-center gap-2 border-t border-line px-2 pb-1.5 pt-3"
                  >
                    <Avatar member={lane.member} size={20} />
                    <span className="text-[13px] font-medium">{lane.member?.name ?? 'Вместе'}</span>
                    <span className="text-xs tabular-nums text-ink-3">{laneCount}</span>
                  </div>
                  {columns.map((col, i) => {
                    const id = containerId(lane.key, col.key)
                    return (
                      <div
                        key={id}
                        className={cx(
                          'flex px-2 pb-3',
                          i > 0 && 'border-l border-line',
                          col.kind === 'day' && col.isToday && 'bg-today/[0.035]',
                        )}
                      >
                        <Cell id={id} column={col} tasks={tasksOf(id)} highlight={highlighted === id} />
                      </div>
                    )
                  })}
                </Fragment>
              )
            })}
          </div>
        </div>
      )}

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? <CardBody task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
