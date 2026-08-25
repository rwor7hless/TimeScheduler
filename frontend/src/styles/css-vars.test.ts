import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const SRC = resolve(process.cwd(), 'src')
const GLOBALS = join(SRC, 'styles', 'globals.css')

/**
 * Любая ссылка `var(--foo)` на переменную, которой нет в globals.css, тихо
 * ломает свойство: оно становится `unset`, и элемент наследует цвет либо
 * получает initial. Именно так план 1 оставил невидимую иконку и невидимое
 * слово «Time» на экране входа — старые smoke-glass токены (`--ink`,
 * `--ink-2`, `--ink-3`, `--accent-ink`) удалены, а ссылки на них остались.
 *
 * Компилятор такое не ловит: для tsc это обычная строка.
 */
function definedProps(): Set<string> {
  const css = readFileSync(GLOBALS, 'utf8')
  return new Set(Array.from(css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm), (m) => m[1]))
}

/** .ts/.tsx/.css, кроме самих тестов — они содержат имена токенов как данные. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (/\.test\.tsx?$/.test(full)) return []
    return /\.(tsx?|css)$/.test(full) ? [full] : []
  })
}

/** Ссылки без фолбэка: `var(--foo, #fff)` безопасен, `var(--foo)` — нет. */
function danglingByFile(): Record<string, string[]> {
  const defined = definedProps()
  const found: Record<string, string[]> = {}
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    const refs = Array.from(source.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g), (m) => m[1])
    const dangling = Array.from(new Set(refs.filter((r) => !defined.has(r)))).sort()
    if (dangling.length) found[relative(SRC, file)] = dangling
  }
  return found
}

describe('css custom properties', () => {
  it('every var(--…) reference resolves to a property defined in globals.css', () => {
    expect(danglingByFile()).toEqual({})
  })

  it('globals.css defines the tokens the palette module claims it does', () => {
    const defined = definedProps()
    expect(defined.has('--fg')).toBe(true)
    expect(defined.has('--accent')).toBe(true)
  })
})
