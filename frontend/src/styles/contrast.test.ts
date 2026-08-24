import { describe, it, expect } from 'vitest'
import { relativeLuminance, contrastRatio } from './contrast'

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
