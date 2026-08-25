import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const SRC = resolve(process.cwd(), 'src')
const GLOBALS = join(SRC, 'styles', 'globals.css')

/**
 * Класс, на который ссылается разметка, но которого нет в globals.css, не даёт
 * ни ошибки сборки, ни предупреждения в консоли — элемент просто остаётся без
 * стилей. Ровно так план 1 потерял `.ts-input`, `.page-title`, `.topbar` и
 * `.ts-subtabs`, когда globals.css переписывался вручную: поля ввода съехали на
 * голое правило `input {}` и стали выглядеть браузерным дефолтом.
 *
 * Это тот же класс ошибки, что и висячий `var(--…)` в css-vars.test.ts, только
 * на уровне классов, а не переменных.
 */

/**
 * Собственные классы проекта, не имеющие префикса `ts-`. Список нужен потому,
 * что вывести его из globals.css нельзя: как раз ОТСУТСТВУЮЩИЕ там классы мы и
 * ищем. Новым компонентным классам давайте префикс `ts-` — тогда они попадут
 * под проверку автоматически и в этот список их добавлять не придётся.
 */
const BARE_PROJECT_CLASSES = new Set([
  'chip', 'danger-btn', 'fade-in', 'icon-btn', 'kicker', 'markdown-preview',
  'modal', 'overlay', 'page-title', 'page-sub', 'popover', 'primary-btn',
  'quick-add', 'row', 'secondary-btn', 'section-head', 'stat-cell', 'stat-row',
  'topbar', 'topbar-tools',
])

function definedClasses(): Set<string> {
  const css = readFileSync(GLOBALS, 'utf8')
  return new Set(Array.from(css.matchAll(/\.(-?[a-z][\w-]*)/g), (m) => m[1]))
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (/\.test\.tsx?$/.test(full)) return []
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

function isProjectClass(cls: string): boolean {
  return cls.startsWith('ts-') || BARE_PROJECT_CLASSES.has(cls)
}

/** Классы проекта, на которые ссылается разметка. file → отсортированный список. */
function referencedByFile(): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    const classes = new Set<string>()
    for (const [, body] of source.matchAll(/['"`]([-a-z0-9:/[\]. _]+)['"`]/g)) {
      for (const cls of body.split(/\s+/)) if (isProjectClass(cls)) classes.add(cls)
    }
    if (classes.size) found[relative(SRC, file)] = [...classes].sort()
  }
  return found
}

describe('project css classes', () => {
  it('every class the markup references is defined in globals.css', () => {
    const defined = definedClasses()
    const missing: Record<string, string[]> = {}
    for (const [file, classes] of Object.entries(referencedByFile())) {
      const dangling = classes.filter((c) => !defined.has(c))
      if (dangling.length) missing[file] = dangling
    }
    expect(missing).toEqual({})
  })
})
