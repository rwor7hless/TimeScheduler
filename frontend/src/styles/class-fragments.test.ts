import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative as nativeRelative, resolve, sep } from 'path'

// Baselines are keyed with '/'; on Windows path.relative answers with '\'.
const relative = (from: string, to: string) => nativeRelative(from, to).split(sep).join('/')

const SRC = resolve(process.cwd(), 'src')

/**
 * Массовая чистка классов (rounded-*, dark:*, group-hover:*) вырезала префикс
 * и оставляла хвост. `h-[11px] rounded-[2px]` превратилось в
 * `h-[11px]-[2px]` — Tailwind такого класса не знает, у клеток годовой
 * тепловой карты привычек пропала высота, и «Обзор года» стоял пустым.
 * `group-hover:text-fg` превратилось в висящее `group-`. Ни сборка, ни
 * консоль об этом не говорят: неизвестный класс просто ничего не делает.
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (/\.test\.tsx?$/.test(full)) return []
    return /\.tsx$/.test(full) ? [full] : []
  })
}

/** Комментарии цитируют CSS в обратных кавычках (`contain: paint`) — это не классы. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** Токены в строковых литералах, похожих на списки классов. */
function classTokens(source: string): string[] {
  const tokens: string[] = []
  for (const [, body] of stripComments(source).matchAll(/['"`]([-a-z0-9:/[\]. _#%]+)['"`]/g)) {
    tokens.push(...body.split(/\s+/).filter(Boolean))
  }
  return tokens
}

describe('class fragments', () => {
  it('no class is left as a severed tail of another', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      for (const token of classTokens(readFileSync(file, 'utf8'))) {
        // `x]-[2px]`: two arbitrary values glued together.
        // `group-` / `hover:`: a variant or prefix with its utility cut off.
        if (/\]-\[/.test(token) || /^[a-z][a-z-]*-$/.test(token) || /^[a-z][a-z-]*:$/.test(token)) {
          offenders.push(`${relative(SRC, file)}: ${token}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
