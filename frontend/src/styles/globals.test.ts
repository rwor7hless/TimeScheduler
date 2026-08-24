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

// Property name for ANY radius declaration: the shorthand, the four
// physical per-corner longhands, and the four logical per-corner forms.
// A bare `border-radius` regex misses all eight longhands — a rounded
// corner written that way sails straight through undetected.
const RADIUS_PROP = String.raw`border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius`

describe('terminal invariants', () => {
  it('never uses backdrop-filter — it creates containing blocks and broke dnd', () => {
    expect(css).not.toMatch(/backdrop-filter/i)
  })

  it('never uses a non-zero box-shadow', () => {
    const shadows = css.match(/box-shadow\s*:\s*([^;]+);/gi) ?? []
    for (const decl of shadows) {
      expect(decl).toMatch(/box-shadow\s*:\s*none\s*;/i)
    }
  })

  it('never uses a non-zero border-radius, in any longhand or logical form', () => {
    const radii = css.match(new RegExp(`${RADIUS_PROP}\\s*:\\s*([^;]+);`, 'gi')) ?? []
    for (const decl of radii) {
      expect(decl).toMatch(new RegExp(`${RADIUS_PROP}\\s*:\\s*0(px)?\\s*;`, 'i'))
    }
  })

  it('loads no font over the network', () => {
    expect(css).not.toMatch(/@import\s+url\(/)
    expect(css).not.toMatch(/fonts\.googleapis\.com/)
    expect(css).not.toMatch(/https?:\/\//)
  })
})

describe('border-radius invariant catches longhand and logical forms', () => {
  // Proof-of-detection: a test whose own catching power is never exercised
  // is how the longhand hole got into this file in the first place. Each of
  // these is a real CSS property the shorthand-only regex used to miss.
  const perCornerProps = [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-left-radius',
    'border-bottom-right-radius',
    'border-start-start-radius',
    'border-start-end-radius',
    'border-end-start-radius',
    'border-end-end-radius',
  ]

  it.each(perCornerProps)('a non-zero %s is extracted and flagged as non-compliant', (prop) => {
    const fixture = `.regression { ${prop}: 12px; }`
    const decls = fixture.match(new RegExp(`${RADIUS_PROP}\\s*:\\s*([^;]+);`, 'gi')) ?? []
    expect(decls).toHaveLength(1)
    expect(decls[0]).not.toMatch(new RegExp(`${RADIUS_PROP}\\s*:\\s*0(px)?\\s*;`, 'i'))
  })

  it('a zero-valued longhand still passes', () => {
    const fixture = `.ok { border-top-left-radius: 0; }`
    const decls = fixture.match(new RegExp(`${RADIUS_PROP}\\s*:\\s*([^;]+);`, 'gi')) ?? []
    expect(decls).toHaveLength(1)
    expect(decls[0]).toMatch(new RegExp(`${RADIUS_PROP}\\s*:\\s*0(px)?\\s*;`, 'i'))
  })

  it('an uppercase declaration is still caught (case-insensitive)', () => {
    const fixture = `.regression { BORDER-TOP-LEFT-RADIUS: 12PX; }`
    const decls = fixture.match(new RegExp(`${RADIUS_PROP}\\s*:\\s*([^;]+);`, 'gi')) ?? []
    expect(decls).toHaveLength(1)
    expect(decls[0]).not.toMatch(new RegExp(`${RADIUS_PROP}\\s*:\\s*0(px)?\\s*;`, 'i'))
  })
})
