import { describe, it, expect } from 'vitest'
import { isEmptyMetric } from './metric'

describe('isEmptyMetric', () => {
  // A red "0 overdue" raises an alarm about nothing. Zero and "no value" are
  // the cases where a KPI must drop its colour and read as plain ink.
  it.each([0, '0', '0%', '0.0', '0 дн.', '0 / 365', '—', '-', '', '  '])('%j is empty', (v) => {
    expect(isEmptyMetric(v)).toBe(true)
  })

  it.each([1, 0.5, '1', '33.3%', '1 дн.', '1 / 365', '27.08'])('%j carries a value', (v) => {
    expect(isEmptyMetric(v)).toBe(false)
  })

  it('reads a comma as a decimal point', () => {
    expect(isEmptyMetric('0,0')).toBe(true)
    expect(isEmptyMetric('0,4')).toBe(false)
  })
})
