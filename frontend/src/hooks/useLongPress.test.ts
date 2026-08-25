import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LongPressTracker } from './useLongPress'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('LongPressTracker', () => {
  it('fires after the delay', () => {
    const onLongPress = vi.fn()
    const t = new LongPressTracker({ onLongPress })
    t.start(10, 10)
    vi.advanceTimersByTime(500)
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('does not fire before the delay', () => {
    const onLongPress = vi.fn()
    const t = new LongPressTracker({ onLongPress })
    t.start(10, 10)
    vi.advanceTimersByTime(499)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('is cancelled by lifting the finger early', () => {
    const onLongPress = vi.fn()
    const t = new LongPressTracker({ onLongPress })
    t.start(10, 10)
    vi.advanceTimersByTime(200)
    t.end()
    vi.advanceTimersByTime(500)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('is cancelled by a scroll — a finger that moved is a swipe, not a press', () => {
    const onLongPress = vi.fn()
    const t = new LongPressTracker({ onLongPress })
    t.start(10, 10)
    t.move(10, 40)
    vi.advanceTimersByTime(500)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('cancels at the distance dnd-kit uses to start a drag, so the two never both fire', () => {
    const onLongPress = vi.fn()
    const t = new LongPressTracker({ onLongPress })
    t.start(10, 10)
    t.move(16, 10)
    vi.advanceTimersByTime(500)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('reports a fired press once, so the click it produces can be swallowed', () => {
    const t = new LongPressTracker({ onLongPress: () => {} })
    t.start(10, 10)
    vi.advanceTimersByTime(500)
    expect(t.consumeFired()).toBe(true)
    expect(t.consumeFired()).toBe(false)
  })

  it('tolerates the small drift of a finger held still', () => {
    const onLongPress = vi.fn()
    const t = new LongPressTracker({ onLongPress })
    t.start(10, 10)
    t.move(13, 12)
    vi.advanceTimersByTime(500)
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('fires once even if the timer is somehow started twice', () => {
    const onLongPress = vi.fn()
    const t = new LongPressTracker({ onLongPress })
    t.start(10, 10)
    t.start(10, 10)
    vi.advanceTimersByTime(500)
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })
})
