/**
 * Цвета ДАННЫХ: задача, привычка, приоритет, сегмент графика. Это не токены
 * темы — цвет хранится в базе вместе с записью и с темой не переключается,
 * поэтому один набор обязан читаться на обоих фонах.
 *
 * Подобран в OKLCH: L 0.57–0.64, C 0.10–0.12 — в той же приглушённой зоне,
 * что --red и --green самой темы. Каждый даёт ≥3:1 к фону обеих тем
 * (проверяет colors.test.ts). Порядок не произвольный: соседи в нём
 * различимы и при дейтеранопии/протанопии (ΔE OKLab ≥12), и обычным глазом
 * (ΔE ≥22). Пикер показывает цвета именно в этом порядке.
 */
const DATA = {
  red:     '#b3575e',
  cyan:    '#059ab2',
  orange:  '#c17152',
  blue:    '#257eb7',
  amber:   '#a57710',
  indigo:  '#7c84d4',
  emerald: '#308b56',
  violet:  '#7f67b5',
  lime:    '#73801d',
  pink:    '#b06194',
} as const

export const PALETTE = Object.values(DATA)

/** Запасные цвета сегментов, когда у записи своего цвета нет. */
export const CHART_COLORS = PALETTE

export type PaletteColor = typeof PALETTE[number]

export function colorAt(index: number): string {
  return PALETTE[index % PALETTE.length]
}

/**
 * Насыщенный набор Tailwind-500, из которого брались цвета до этой палитры.
 * Он лежит в базе у старых задач и привычек и приходит с бэкенда в цветах
 * приоритетов. Каждому — его приглушённая пара того же семейства.
 */
const LEGACY: Record<string, string> = {
  '#ef4444': DATA.red,
  '#06b6d4': DATA.cyan,
  '#f97316': DATA.orange,
  '#3b82f6': DATA.blue,
  '#f59e0b': DATA.amber,
  '#6366f1': DATA.indigo,
  '#10b981': DATA.emerald,
  '#8b5cf6': DATA.violet,
  '#84cc16': DATA.lime,
  '#ec4899': DATA.pink,
}

/** Старый цвет → его пара из палитры; любой другой цвет — как есть. */
export function dataColor(hex: string): string {
  return LEGACY[hex.toLowerCase()] ?? hex
}

/**
 * Переводит на палитру каждое поле `color` в ответе API, на любой глубине.
 * Висит в перехватчике axios, чтобы три десятка мест, где цвет записи
 * рисуется, не помнили об этом каждое. Запись, открытая и сохранённая
 * заново, уходит в базу уже с новым цветом.
 */
export function recolorLegacy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(recolorLegacy) as T
  // Только простые объекты из JSON: Blob выгрузки обход превратил бы в {}.
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return value
  }
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    out[key] = key === 'color' && typeof v === 'string' ? dataColor(v) : recolorLegacy(v)
  }
  return out as T
}

/**
 * Сегменты «время суток» на экране привычек — из той же палитры, без
 * отдельного неонового варианта для тёмной темы.
 */
export const TIME_BUCKETS = [
  { id: 'morning',    label: 'Утро',         hours: [6, 7, 8, 9, 10, 11],     color: DATA.amber },
  { id: 'afternoon',  label: 'День',         hours: [12, 13, 14, 15, 16, 17], color: DATA.emerald },
  { id: 'evening',    label: 'Вечер',        hours: [18, 19, 20, 21],         color: DATA.blue },
  { id: 'night',      label: 'Ночь',         hours: [22, 23, 0, 1, 2],        color: DATA.violet },
  { id: 'late night', label: 'Поздняя ночь', hours: [3, 4, 5],                color: DATA.violet },
]
