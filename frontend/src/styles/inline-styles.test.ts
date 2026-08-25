import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const SRC = resolve(process.cwd(), 'src')

const BANNED_PROPS = ['borderRadius', 'boxShadow', 'backdropFilter'] as const

/**
 * Оставшиеся инлайновые borderRadius — это КРУГИ, и они здесь навсегда.
 *
 * `--radius: 0` запрещает скруглённые прямоугольники; про окружности он
 * ничего не говорит. Спиннер рисует кольцо, точки в сайдбаре — маркеры
 * привычек; квадратными они станут бессмысленными.
 *
 * Список закрыт: план 2 свёл его с шести файлов до этих двух. Тест падает
 * в обе стороны, поэтому новое нарушение в третьем файле — ошибка, а не
 * пополнение долга.
 */
const BASELINE: Record<string, readonly string[]> = {
  'components/layout/Sidebar.tsx': ['borderRadius'],
  'components/ui/Spinner.tsx': ['borderRadius'],
}

/**
 * .tsx and .ts, excluding test files themselves — they contain the banned
 * property NAMES as string literals (in BANNED_PROPS above, and in fixture
 * strings elsewhere) and would self-trip the scan otherwise.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (/\.test\.tsx?$/.test(full)) return []
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

function offendersByFile(): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    const hits = BANNED_PROPS.filter((prop) =>
      new RegExp(`\\b${prop}\\s*:`).test(source),
    )
    if (hits.length) found[relative(SRC, file)] = hits.slice().sort()
  }
  return found
}

describe('inline style constraints', () => {
  it('matches the recorded baseline exactly, in both directions', () => {
    expect(offendersByFile()).toEqual(BASELINE)
  })

  it('no file outside the baseline introduces a banned inline property', () => {
    const unexpected = Object.keys(offendersByFile()).filter((f) => !(f in BASELINE))
    expect(unexpected).toEqual([])
  })
})
