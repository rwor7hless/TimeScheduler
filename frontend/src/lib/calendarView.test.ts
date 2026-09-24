import { describe, it, expect } from 'vitest'
import { calendarViewFromPath } from './calendarView'

describe('calendarViewFromPath', () => {
  // The regression: /calendar/day and /calendar/month both rendered the week,
  // because the view lived in useState('week') and never looked at the URL.
  it.each([
    ['/calendar/day', 'day'],
    ['/calendar/week', 'week'],
    ['/calendar/month', 'month'],
  ] as const)('%s shows the %s view', (path, view) => {
    expect(calendarViewFromPath(path)).toBe(view)
  })

  it('tolerates a trailing slash', () => {
    expect(calendarViewFromPath('/calendar/month/')).toBe('month')
  })

  it('falls back to the week for anything it does not recognise', () => {
    expect(calendarViewFromPath('/calendar')).toBe('week')
    expect(calendarViewFromPath('/calendar/year')).toBe('week')
  })
})
