import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const SRC = resolve(process.cwd(), 'src')

const PALETTE =
  /\b(?:bg|text|border|from|to|via|fill|stroke|divide)-(?:gray|slate|zinc|neutral|stone|white|black|amber|blue|green|red|orange|purple|pink|indigo|emerald|yellow|violet|rose|teal|cyan|sky|lime|fuchsia)(?:-\d{2,3})?\b/
const RADIUS = /\brounded(?:-[a-z0-9[\]]+)?\b/
const SHADOW = /\bshadow(?:-[a-z0-9[\]]+)?\b/
// Двоеточие вплотную к классу: `md: string` — это аннотация типа у параметра
// с именем md, а не вариант Tailwind.
const BREAKPOINT = /\b(?:sm|md|lg|xl|2xl):(?=[a-z[-])/

const CATEGORIES = [
  ['palette', PALETTE],
  ['radius', RADIUS],
  ['shadow', SHADOW],
  ['breakpoint', BREAKPOINT],
] as const

/**
 * Файлы, ещё не перенесённые на терминальные токены.
 *
 * Это долг, а не разрешение. Каждая задача плана 2 удаляет отсюда свои
 * файлы ПЕРЕД тем, как их править, — тест краснеет, правка делает его
 * зелёным. К концу плана здесь должно остаться `{}`.
 *
 * Тест падает в обе стороны: и на новом нарушении в чистом файле, и на
 * записи, которая устарела после того, как файл починили.
 */
const BASELINE: Record<string, readonly string[]> = {
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (/\.test\.tsx?$/.test(full)) return []
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

/**
 * Комментарии не разметка: строка «box-shadow глушится спеком» — это проза
 * о запрете, а не нарушение. Сканируем только код.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function offendersByFile(): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const file of sourceFiles(SRC)) {
    const source = stripComments(readFileSync(file, 'utf8'))
    const hits = CATEGORIES.filter(([, re]) => re.test(source)).map(([name]) => name)
    if (hits.length) found[relative(SRC, file)] = hits.slice().sort()
  }
  return found
}

describe('legacy tailwind classes', () => {
  it('matches the recorded baseline exactly, in both directions', () => {
    expect(offendersByFile()).toEqual(BASELINE)
  })

  it('no dark: variant survives in a file already migrated', () => {
    const migrated = sourceFiles(SRC).filter((f) => !(relative(SRC, f) in BASELINE))
    const withDark = migrated
      .filter((f) => /\bdark:/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
    expect(withDark).toEqual([])
  })
})
