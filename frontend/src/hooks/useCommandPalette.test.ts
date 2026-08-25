import { describe, it, expect } from 'vitest'
import { isPaletteShortcut } from './useCommandPalette'

const ev = (over: Partial<{ code: string; ctrlKey: boolean; metaKey: boolean }>) => ({
  code: 'KeyK',
  ctrlKey: false,
  metaKey: false,
  ...over,
})

describe('isPaletteShortcut', () => {
  it('matches Ctrl+K', () => {
    expect(isPaletteShortcut(ev({ ctrlKey: true }))).toBe(true)
  })

  it('matches Cmd+K', () => {
    expect(isPaletteShortcut(ev({ metaKey: true }))).toBe(true)
  })

  it('matches on a Cyrillic layout, where the key is "л" but the code is still KeyK', () => {
    // Ради этого случая биндинг и сделан на event.code: с русской раскладкой
    // event.key === 'л', и проверка по key не сработала бы именно у того
    // пользователя, для которого приложение написано.
    expect(isPaletteShortcut({ code: 'KeyK', ctrlKey: true, metaKey: false })).toBe(true)
  })

  it('ignores a bare K', () => {
    expect(isPaletteShortcut(ev({}))).toBe(false)
  })

  it('ignores Ctrl with another letter', () => {
    expect(isPaletteShortcut(ev({ code: 'KeyJ', ctrlKey: true }))).toBe(false)
  })
})
