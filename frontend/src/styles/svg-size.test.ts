import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const SRC = resolve(process.cwd(), 'src')

/**
 * `<svg viewBox="0 0 24 24">` без width/height — это НЕ маленькая иконка.
 * У замещаемого элемента без внутреннего размера дефолт равен 300×150px, и
 * ровно поэтому боковое меню разъезжалось: каждая иконка навигации требовала
 * 300px ширины внутри колонки в 260px.
 *
 * Правило CSS у контейнера (`.icon-btn svg { width: 15px }`) это чинит, но
 * молча и только для своего контейнера — стоит вынести иконку в другое место,
 * и она снова раздувается. Поэтому размер обязан быть на самом теге.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (/\.test\.tsx?$/.test(full)) return []
    return /\.tsx$/.test(full) ? [full] : []
  })
}

/** Тег задаёт размер сам: атрибутами, классом w-/h- или пропом size. */
function isSized(tag: string): boolean {
  if (/\bwidth=/.test(tag) && /\bheight=/.test(tag)) return true
  if (/className=["'][^"']*\bw-\d/.test(tag) && /className=["'][^"']*\bh-\d/.test(tag)) return true
  return /\bsize=/.test(tag)
}

function unsizedByFile(): Record<string, number[]> {
  const found: Record<string, number[]> = {}
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    const lines: number[] = []
    for (const m of source.matchAll(/<svg\b[^>]*>/g)) {
      if (!isSized(m[0])) lines.push(source.slice(0, m.index).split('\n').length)
    }
    if (lines.length) found[relative(SRC, file)] = lines
  }
  return found
}

describe('svg sizing', () => {
  it('every <svg> declares its own size', () => {
    expect(unsizedByFile()).toEqual({})
  })
})

describe('svg shapes', () => {
  it('no icon rounds its corners — the system sets --radius: 0', () => {
    // Скруглённый прямоугольник внутри иконки противоречит центральному
    // правилу системы ровно так же, как скруглённая карточка: все панели,
    // поля и кнопки квадратные, а иконка рядом с ними — нет.
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(/<(?:rect|circle|ellipse)\b[^>]*\br[xy]=["'][^"']+["']/g)) {
        offenders.push(`${relative(SRC, file)}:${source.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
