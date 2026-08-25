import { describe, it, expect } from 'vitest'
import { canPageBack, canPageForward } from './weekBounds'

describe('week navigation bounds', () => {
  it('allows paging back from the current week', () => {
    expect(canPageBack('2026-08-24')).toBe(true)
  })

  it('does not depend on weekly-report history', () => {
    // Экран показывает СТАТИСТИКУ; недельный отчёт — лишь один блок внутри.
    // Раньше нижней границей была неделя самого раннего отчёта, и при
    // единственном отчёте за текущую неделю кнопка «назад» гасла, хотя данные
    // за прошлые недели существовали. Граница отсюда убрана намеренно.
    expect(canPageBack.length).toBe(1)
  })

  it('allows paging forward while the week is in the past', () => {
    expect(canPageForward('2026-08-17', '2026-08-24')).toBe(true)
  })

  it('refuses to page forward from the current week', () => {
    expect(canPageForward('2026-08-24', '2026-08-24')).toBe(false)
  })

  it('refuses to page forward from a week that is somehow ahead of today', () => {
    expect(canPageForward('2026-08-31', '2026-08-24')).toBe(false)
  })
})
