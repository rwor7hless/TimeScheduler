import { describe, it, expect } from 'vitest'
import { relativeLuminance, contrastRatio, inkOn } from './contrast'

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })

  it('accepts a hex string without the leading hash', () => {
    expect(relativeLuminance('ffffff')).toBeCloseTo(1, 5)
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2)
  })

  it('is 1 for a colour against itself', () => {
    expect(contrastRatio('#0b0c0c', '#0b0c0c')).toBeCloseTo(1, 5)
  })

  it('does not depend on argument order', () => {
    expect(contrastRatio('#d8a657', '#0b0c0c')).toBeCloseTo(
      contrastRatio('#0b0c0c', '#d8a657'),
      5,
    )
  })

  it('matches the value the spec records for the dark accent', () => {
    expect(contrastRatio('#d8a657', '#0b0c0c')).toBeCloseTo(8.87, 2)
  })
})

describe('inkOn', () => {
  it('picks black ink on a light background', () => {
    expect(inkOn('#ffffff')).toBe('#000000')
  })

  it('picks white ink on a dark background', () => {
    expect(inkOn('#000000')).toBe('#ffffff')
  })

  it('always clears WCAG AA against the colour it was asked about', () => {
    // Цвета тегов и досок задаёт пользователь — значит проверяем весь куб,
    // а не пару удобных примеров.
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
          expect(contrastRatio(inkOn(hex), hex)).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})
