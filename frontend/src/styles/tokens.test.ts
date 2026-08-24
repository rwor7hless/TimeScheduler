import { describe, it, expect } from 'vitest'
import { contrastRatio } from './contrast'
import {
  DARK,
  LIGHT,
  READABLE_KEYS,
  DECORATIVE_KEYS,
  CSS_VAR,
  type Palette,
} from './tokens'

const THEMES: Array<[string, Palette]> = [
  ['DARK', DARK],
  ['LIGHT', LIGHT],
]

describe.each(THEMES)('%s palette', (_name, palette) => {
  it.each(READABLE_KEYS)(
    'readable tier %s clears WCAG AA (4.5:1) against bg',
    (key) => {
      expect(contrastRatio(palette[key], palette.bg)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(DECORATIVE_KEYS)(
    'decorative tier %s stays below 4.5:1 — it must never carry meaning alone',
    (key) => {
      expect(contrastRatio(palette[key], palette.bg)).toBeLessThan(4.5)
    },
  )

  it('every field is a six-digit hex colour', () => {
    for (const value of Object.values(palette)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('palette shape', () => {
  it('DARK and LIGHT define exactly the same fields', () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort())
  })

  it('CSS_VAR names a custom property for every field', () => {
    expect(Object.keys(CSS_VAR).sort()).toEqual(Object.keys(DARK).sort())
    for (const name of Object.values(CSS_VAR)) {
      expect(name).toMatch(/^--[a-z0-9-]+$/)
    }
  })

  it('classifies every tier that renders text as readable or decorative', () => {
    const classified = [...READABLE_KEYS, ...DECORATIVE_KEYS]
    expect(new Set(classified).size).toBe(classified.length)
    // accentLight / accentDark are hover and press states, not text tiers,
    // so they are deliberately absent from both lists.
    expect(classified).not.toContain('accentLight')
    expect(classified).not.toContain('accentDark')
  })
})
