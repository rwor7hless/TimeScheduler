import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DARK, LIGHT, CSS_VAR, type Palette } from './tokens'

// process.cwd() — не __dirname: Vitest исполняет тесты как ESM, где __dirname
// не определён, и тест упал бы на ReferenceError вместо осмысленного сравнения.
// Корень Vitest здесь — frontend/, потому что оттуда запускается npm test.
const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')

/** Вытаскивает тело первого блока с данным селектором. */
function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`не найден блок ${selector} в globals.css`)
  return match[1]
}

function declaredValue(body: string, prop: string): string | null {
  const match = body.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`))
  return match ? match[1].trim().toLowerCase() : null
}

const CASES: Array<[string, string, Palette]> = [
  ['dark', ':root', DARK],
  ['light', ':root[data-theme="light"]', LIGHT],
]

describe.each(CASES)('%s theme in globals.css', (_name, selector, palette) => {
  const body = block(selector)

  it.each(Object.keys(CSS_VAR) as (keyof Palette)[])(
    '%s matches tokens.ts',
    (key) => {
      expect(declaredValue(body, CSS_VAR[key])).toBe(palette[key])
    },
  )
})

describe('terminal invariants', () => {
  it('never uses backdrop-filter — it creates containing blocks and broke dnd', () => {
    expect(css).not.toMatch(/backdrop-filter/)
  })

  it('never uses a non-zero box-shadow', () => {
    const shadows = css.match(/box-shadow\s*:\s*([^;]+);/g) ?? []
    for (const decl of shadows) {
      expect(decl).toMatch(/box-shadow\s*:\s*none\s*;/)
    }
  })

  it('never uses a non-zero border-radius', () => {
    const radii = css.match(/border-radius\s*:\s*([^;]+);/g) ?? []
    for (const decl of radii) {
      expect(decl).toMatch(/border-radius\s*:\s*0(px)?\s*;/)
    }
  })

  it('loads no font over the network', () => {
    expect(css).not.toMatch(/@import\s+url\(/)
    expect(css).not.toMatch(/fonts\.googleapis\.com/)
    expect(css).not.toMatch(/https?:\/\//)
  })
})
