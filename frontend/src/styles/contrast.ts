/**
 * WCAG 2.1 контраст. Живёт отдельным модулем, потому что правило палитры
 * («смысловой текст ≥ 4.5:1, приглушённые уровни — намеренно ниже»)
 * проверяется тестом, а не на глаз.
 */

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Относительная яркость по WCAG 2.1, 0–1. Принимает '#rrggbb' или 'rrggbb'. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`ожидался шестизначный hex, получено: ${hex}`)
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Контраст двух цветов, 1–21. От порядка аргументов не зависит. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Краска поверх ПРОИЗВОЛЬНОГО цвета — цвета тега, доски или привычки, который
 * задал пользователь.
 *
 * Здесь намеренно не используются токены темы: фон под этой краской не
 * является поверхностью темы, поэтому `--bg`/`--fg` тут не годятся и вдобавок
 * не годятся арифметически — в точке, где они одинаково далеки от цвета
 * подложки, контраст проваливается до ~3.7:1. У чистой пары чёрный/белый
 * худший случай равен 4.58:1, то есть AA выполняется для любого цвета.
 */
export function inkOn(background: string): string {
  return relativeLuminance(background) > 0.1791 ? '#000000' : '#ffffff'
}
