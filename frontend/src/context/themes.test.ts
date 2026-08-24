import { describe, it, expect } from 'vitest'
import { THEMES } from './ThemeContext'
import { DARK, LIGHT } from '@/styles/tokens'

describe('THEMES', () => {
  it('has exactly two entries', () => {
    expect(THEMES).toHaveLength(2)
  })

  it('is dark-first — dark is the default theme', () => {
    expect(THEMES[0].id).toBe('dark')
    expect(THEMES[1].id).toBe('light')
  })

  it('takes its colours from tokens.ts rather than restating them', () => {
    const dark = THEMES.find((t) => t.id === 'dark')!
    expect(dark.accent).toBe(DARK.accent)
    expect(dark.bg).toBe(DARK.bg)
    expect(dark.surface).toBe(DARK.bgCell)

    const light = THEMES.find((t) => t.id === 'light')!
    expect(light.accent).toBe(LIGHT.accent)
    expect(light.bg).toBe(LIGHT.bg)
    expect(light.surface).toBe(LIGHT.bgCell)
  })

  it('marks exactly one theme as dark', () => {
    expect(THEMES.filter((t) => t.isDark)).toHaveLength(1)
  })

  it('keeps the fields recharts reads from JS', () => {
    for (const theme of THEMES) {
      for (const key of ['accent', 'accentLight', 'accentDark', 'bg', 'surface'] as const) {
        expect(theme[key]).toMatch(/^#[0-9a-f]{6}$/)
      }
      expect(theme.swatch).toHaveLength(3)
    }
  })
})
