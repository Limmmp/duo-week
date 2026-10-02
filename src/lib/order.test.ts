import { describe, expect, it } from 'vitest'
import { POSITION_STEP, needsRebalance, positionBetween, rebalanced } from './order'

describe('positionBetween', () => {
  it('ставит в пустую колонку, в начало, в конец и между', () => {
    expect(positionBetween()).toBe(POSITION_STEP)
    expect(positionBetween(undefined, 1000)).toBe(1000 - POSITION_STEP)
    expect(positionBetween(1000)).toBe(1000 + POSITION_STEP)
    expect(positionBetween(1000, 2000)).toBe(1500)
  })

  it('замечает, когда соседи слиплись', () => {
    let next = 2
    for (let i = 0; i < 60; i++) next = positionBetween(1, next)
    expect(needsRebalance(1, next)).toBe(true)
    expect([...rebalanced(['a', 'b']).values()]).toEqual([POSITION_STEP, POSITION_STEP * 2])
  })
})
