// Common color palette used by habits, stats breakdowns, and other charts.
// Keep in sync with Tailwind `accent` and chart-friendly tones.

export const PALETTE = [
  '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981',
  '#F97316', '#EC4899', '#06B6D4', '#84CC16', '#6366F1',
] as const

export const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'] as const

export type PaletteColor = typeof PALETTE[number]

export function colorAt(index: number): string {
  return PALETTE[index % PALETTE.length]
}

/**
 * Цвета сегментов «время суток» на экране привычек. Это ДАННЫЕ, а не токены
 * темы: пользователь видит их как визуальную легенду, и они не обязаны
 * переключаться вместе с темой. `neon` — вариант для тёмной темы.
 */
export const TIME_BUCKETS = [
  { id: 'morning',    label: 'Утро',         hours: [6, 7, 8, 9, 10, 11],   color: '#FBBF24', neon: '#FFEE44' },
  { id: 'afternoon',  label: 'День',         hours: [12, 13, 14, 15, 16, 17], color: '#34D399', neon: '#00FF99' },
  { id: 'evening',    label: 'Вечер',        hours: [18, 19, 20, 21],       color: '#60A5FA', neon: '#00CCFF' },
  { id: 'night',      label: 'Ночь',         hours: [22, 23, 0, 1, 2],      color: '#A78BFA', neon: '#CC66FF' },
  { id: 'late night', label: 'Поздняя ночь', hours: [3, 4, 5],              color: '#A78BFA', neon: '#CC66FF' },
]
