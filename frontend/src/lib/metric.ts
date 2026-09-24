/**
 * Пустое ли значение показателя: ноль или «нет данных».
 *
 * Цвет у KPI — это сигнал, и у нуля его быть не должно: красный «0
 * просрочено» тревожит ни о чём. Значения приходят и числами, и уже
 * отформатированными строками («0 дн.», «33.3%», «1 / 365»), поэтому
 * смотрится ведущее число.
 */
export function isEmptyMetric(value: string | number): boolean {
  if (typeof value === 'number') return value === 0
  const s = value.trim()
  if (s === '' || s === '—' || s === '-') return true
  return parseFloat(s.replace(',', '.')) === 0
}
