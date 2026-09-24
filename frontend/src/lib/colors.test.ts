import { describe, it, expect } from 'vitest'
import { PALETTE, CHART_COLORS, TIME_BUCKETS, dataColor, recolorLegacy } from './colors'
import { TASK_COLOR_PALETTE } from '@/types/task'
import { DARK, LIGHT } from '@/styles/tokens'
import { contrastRatio } from '@/styles/contrast'

/** The saturated Tailwind-500 set every stored task and habit colour came from. */
const LEGACY = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

describe('data palette', () => {
  it('holds ten distinct six-digit colours', () => {
    expect(PALETTE).toHaveLength(10)
    expect(new Set(PALETTE).size).toBe(10)
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })

  // Marks, not text: WCAG 1.4.11 asks 3:1 of a graphical object. One set has
  // to clear both themes, because a stored colour does not switch with them.
  it.each([['DARK', DARK.bg], ['LIGHT', LIGHT.bg]])('every colour clears 3:1 on the %s background', (_n, bg) => {
    for (const c of PALETTE) expect(contrastRatio(c, bg)).toBeGreaterThanOrEqual(3)
  })

  it('is the only palette tasks, habits and charts draw from', () => {
    expect([...TASK_COLOR_PALETTE]).toEqual([...PALETTE])
    for (const c of CHART_COLORS) expect(PALETTE).toContain(c)
    for (const b of TIME_BUCKETS) expect(PALETTE).toContain(b.color)
  })
})

describe('dataColor', () => {
  it('maps every legacy colour onto the palette, one to one', () => {
    const mapped = LEGACY.map(dataColor)
    for (const c of mapped) expect(PALETTE).toContain(c)
    expect(new Set(mapped).size).toBe(LEGACY.length)
  })

  it('ignores case, since the database stores upper-case hex', () => {
    expect(dataColor('#3b82f6')).toBe(dataColor('#3B82F6'))
  })

  it('leaves a colour it does not know alone', () => {
    expect(dataColor('#123456')).toBe('#123456')
    expect(dataColor(PALETTE[0])).toBe(PALETTE[0])
  })
})

describe('recolorLegacy', () => {
  it('rewrites every "color" field, however deep, and nothing else', () => {
    const payload = {
      color: '#EF4444',
      title: '#EF4444',
      tags: [{ id: 1, color: '#10B981' }],
      by_board: [{ label: 'Основная', color: null }],
      nested: { deeper: { color: '#abcdef' } },
    }
    expect(recolorLegacy(payload)).toEqual({
      color: dataColor('#EF4444'),
      title: '#EF4444',
      tags: [{ id: 1, color: dataColor('#10B981') }],
      by_board: [{ label: 'Основная', color: null }],
      nested: { deeper: { color: '#abcdef' } },
    })
  })

  it('passes scalars and empty bodies through', () => {
    expect(recolorLegacy(null)).toBeNull()
    expect(recolorLegacy('')).toBe('')
    expect(recolorLegacy(3)).toBe(3)
  })

  // The same axios instance downloads exports as Blobs. Walking one with
  // Object.entries would hand the caller back an empty {} instead of the file.
  it('returns a non-plain object such as a Blob untouched', () => {
    const blob = new Blob(['a,b'], { type: 'text/csv' })
    expect(recolorLegacy(blob)).toBe(blob)
  })
})
