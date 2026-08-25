import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { buildNav } from './nav'

const APP = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')

/** Пути из <Route path="…">, включая параметризованные. */
function declaredRoutes(): string[] {
  return Array.from(APP.matchAll(/<Route\s+path="([^"]+)"/g), (m) => m[1])
}

describe('buildNav', () => {
  it('every nav destination is a route App.tsx declares', () => {
    const routes = declaredRoutes()
    const missing = buildNav({ isAdmin: true })
      .flatMap((g) => g.items)
      .map((i) => i.to)
      .filter((to) => !routes.some((r) => r === to || to.startsWith(r.replace(/\/:.*$/, '') + '/')))
    expect(missing).toEqual([])
  })

  it('hides the admin entry for a non-admin', () => {
    const labels = buildNav({ isAdmin: false }).flatMap((g) => g.items).map((i) => i.label)
    expect(labels).not.toContain('Админ')
  })

  it('exposes the admin entry for an admin', () => {
    const labels = buildNav({ isAdmin: true }).flatMap((g) => g.items).map((i) => i.label)
    expect(labels).toContain('Админ')
  })
})

describe('routing', () => {
  it('declares a catch-all so an unknown path is a 404, not a blank screen', () => {
    // Без него React Router не отрисовывает вообще ничего: /budget, который
    // спек просит отдавать 404, показывал пустую страницу без шапки и меню.
    expect(declaredRoutes()).toContain('*')
  })
})
