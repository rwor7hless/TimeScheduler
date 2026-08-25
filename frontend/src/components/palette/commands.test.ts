import { describe, it, expect, vi } from 'vitest'
import { buildCommands, filterCommands } from './commands'
import { buildNav } from '@/lib/nav'

const ctx = () => ({
  navigate: vi.fn(),
  toggleTheme: vi.fn(),
  newTask: vi.fn(),
  newProject: vi.fn(),
  logout: vi.fn(),
})

describe('buildCommands', () => {
  it('produces a command for every navigation destination', () => {
    const labels = buildCommands({ isAdmin: true }).map((c) => c.label)
    for (const item of buildNav({ isAdmin: true }).flatMap((g) => g.items)) {
      expect(labels).toContain(item.label)
    }
  })

  it('navigates to the destination the nav declares', () => {
    const c = ctx()
    const today = buildCommands({ isAdmin: false }).find((x) => x.label === 'Мой день')!
    today.run(c)
    expect(c.navigate).toHaveBeenCalledWith('/today')
  })

  it('carries the two actions the spec names', () => {
    const labels = buildCommands({ isAdmin: false }).map((c) => c.label)
    expect(labels).toContain('Новая задача')
    expect(labels).toContain('Сменить тему')
  })

  it('carries everything the sidebar footer holds, because below 900px there is no sidebar', () => {
    // Тема, выход и создание проекта живут в сайдбаре, а ниже 900px он не
    // рендерится. Без этих команд выйти из аккаунта с телефона нельзя вообще.
    const labels = buildCommands({ isAdmin: false }).map((c) => c.label)
    expect(labels).toContain('Сменить тему')
    expect(labels).toContain('Выйти')
    expect(labels).toContain('Новый проект')
  })

  it('runs logout through the context', () => {
    const c = ctx()
    buildCommands({ isAdmin: false }).find((x) => x.label === 'Выйти')!.run(c)
    expect(c.logout).toHaveBeenCalled()
  })

  it('runs project creation through the context', () => {
    const c = ctx()
    buildCommands({ isAdmin: false }).find((x) => x.label === 'Новый проект')!.run(c)
    expect(c.newProject).toHaveBeenCalled()
  })

  it('gives every command a unique id', () => {
    const ids = buildCommands({ isAdmin: true }).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('omits the admin entry for a non-admin', () => {
    expect(buildCommands({ isAdmin: false }).map((c) => c.label)).not.toContain('Админ')
  })
})

describe('filterCommands', () => {
  it('matches case-insensitively on a substring', () => {
    const found = filterCommands(buildCommands({ isAdmin: false }), 'ЗАДАЧ')
    expect(found.map((c) => c.label)).toContain('Задачи')
  })

  it('returns everything for an empty query', () => {
    const all = buildCommands({ isAdmin: false })
    expect(filterCommands(all, '')).toHaveLength(all.length)
  })

  it('returns nothing when nothing matches', () => {
    expect(filterCommands(buildCommands({ isAdmin: false }), 'цукенг')).toEqual([])
  })
})
