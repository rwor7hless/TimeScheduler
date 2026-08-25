import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const SRC = resolve(process.cwd(), 'src')

/**
 * Проверки против переполнения на телефоне.
 *
 * Опорная цифра — 343px: 375px экрана минус padding контента по 16px с каждой
 * стороны (`.ts-shell__main` ниже 900px). Всё, что шире и не имеет узкой ветки,
 * либо вылезет за экран, либо заставит страницу прокручиваться вбок.
 */
const USABLE_PX = 343

/** Многоколоночные сетки, которым узкая ветка не нужна по существу. */
const GRID_EXEMPT = new Set([
  // Календарь месяца: семь колонок — это семь дней недели, меньше не бывает.
  // Tailwind разворачивает grid-cols-7 в repeat(7, minmax(0, 1fr)), поэтому
  // колонки сжимаются, а не переполняют контейнер.
  'components/calendar/MonthView.tsx',
])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (/\.test\.tsx?$/.test(full)) return []
    return /\.tsx$/.test(full) ? [full] : []
  })
}

/** Строка, в которой встретилось совпадение — узкая ветка ищется в ней же. */
function lineAt(source: string, index: number): string {
  const start = source.lastIndexOf('\n', index) + 1
  const end = source.indexOf('\n', index)
  return source.slice(start, end === -1 ? source.length : end)
}

describe('narrow layout', () => {
  it('pins .popover inside the viewport below 900px', () => {
    // Поповер с `absolute right-0` растёт ВЛЕВО от кнопки. Если кнопка стоит не
    // у правого края экрана, на 375px он уезжает за левый край и обрезается —
    // именно так пропал календарь дедлайна в быстром вводе.
    const css = readFileSync(join(SRC, 'styles', 'globals.css'), 'utf8')
    const narrow = css.slice(css.indexOf('@media (max-width: 899px)'))
    expect(narrow).toMatch(/\.popover\.absolute\s*\{[^}]*position:\s*fixed/)
  })

  it('every edge-anchored popover uses the shared .popover class', () => {
    // Иначе общее правило выше его не накроет, и он уедет за край персонально.
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(/className=(?:\{)?["'`]([^"'`]*\babsolute\b[^"'`]*)["'`]/g)) {
        const cls = m[1]
        const fixedWidth = /\bw-(?:\d+|\[[^\]]+\])/.test(cls) || /\bmin-w-\[/.test(cls)
        const anchored = /\b(?:left|right)-\d/.test(cls)
        if (fixedWidth && anchored && !cls.includes('popover')) {
          offenders.push(`${relative(SRC, file)}: ${cls.slice(0, 60)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('every grid of 3+ columns declares a narrow: fallback', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file)
      if (GRID_EXEMPT.has(rel)) continue
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(/\bgrid-cols-(\d+)\b/g)) {
        if (Number(m[1]) < 3) continue
        if (!lineAt(source, m.index!).includes('narrow:grid-cols')) {
          offenders.push(`${rel}: ${m[0]}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no fixed width exceeds the usable width without a narrow: fallback', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file)
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(/\b(min-)?w-\[(\d+)px\]/g)) {
        if (Number(m[2]) <= USABLE_PX) continue
        const line = lineAt(source, m.index!)
        if (!/narrow:(min-)?w-/.test(line)) offenders.push(`${rel}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
