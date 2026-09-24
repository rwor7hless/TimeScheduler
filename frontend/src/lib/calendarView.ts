/**
 * Вид календаря определяется адресом: /calendar/day, /calendar/week,
 * /calendar/month. Раньше вид жил в useState('week') и на адрес не смотрел,
 * так что любая ссылка на день или месяц открывала неделю.
 */
export type CalendarView = 'day' | 'week' | 'month'

export const CALENDAR_VIEWS: readonly CalendarView[] = ['day', 'week', 'month']

export function calendarViewFromPath(pathname: string): CalendarView {
  const last = pathname.replace(/\/+$/, '').split('/').pop()
  return CALENDAR_VIEWS.find((v) => v === last) ?? 'week'
}
