/** Позиции карточек — дробные числа: новая встаёт посередине между соседями. */
export const POSITION_STEP = 1024

export function positionBetween(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return POSITION_STEP
  if (prev === undefined) return next! - POSITION_STEP
  if (next === undefined) return prev + POSITION_STEP
  return (prev + next) / 2
}

/** После десятков вставок в одно место дроби мельчают — тогда колонку пора перенумеровать. */
export function needsRebalance(prev?: number, next?: number): boolean {
  return prev !== undefined && next !== undefined && Math.abs(next - prev) < 1e-6
}

export function rebalanced(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, (i + 1) * POSITION_STEP]))
}
