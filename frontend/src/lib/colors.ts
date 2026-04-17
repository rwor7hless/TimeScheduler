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
