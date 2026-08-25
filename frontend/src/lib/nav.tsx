/**
 * Структура навигации — единственный источник и для сайдбара, и для командной
 * палитры. Спек требует именно этого: два списка в двух файлах разъезжаются,
 * и расхождение замечают только когда пункт есть в одном месте и пропал в другом.
 *
 * Живых данных здесь нет. Счётчики и точка непрочитанного остаются в Sidebar:
 * палитра их не показывает, а тянуть запросы сюда значило бы дёргать их и там,
 * где они не нужны.
 */

export function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  )
}
export function CalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" /><path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}
export function BoardsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="6" height="16" />
      <rect x="11" y="4" width="4" height="10" />
      <rect x="17" y="4" width="4" height="14" />
    </svg>
  )
}
export function HabitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12l4 4 12-12" />
    </svg>
  )
}
export function StatsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  )
}
export function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h10l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M7 12h10M7 16h7M7 8h6" />
    </svg>
  )
}
export function AdminIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

export interface NavItem {
  to: string
  label: string
  /** Активность по префиксу, когда `to` не равен pathname (например /calendar/day). */
  match?: (pathname: string) => boolean
  icon: JSX.Element
}

export interface NavGroup {
  id: string
  /** null — группа без заголовка. */
  title: string | null
  items: NavItem[]
}

export function buildNav({ isAdmin }: { isAdmin: boolean }): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: 'myday',
      title: null,
      items: [{ to: '/today', label: 'Мой день', icon: <ClockIcon /> }],
    },
    {
      id: 'planning',
      title: 'Планирование',
      items: [
        { to: '/tasks', label: 'Задачи', match: (p) => p === '/tasks', icon: <BoardsIcon /> },
        { to: '/calendar/day', label: 'Календарь', match: (p) => p.startsWith('/calendar'), icon: <CalIcon /> },
      ],
    },
    {
      id: 'tracking',
      title: 'Трекинг',
      items: [
        { to: '/habits', label: 'Привычки', icon: <HabitIcon /> },
        { to: '/stats', label: 'Статистика', icon: <StatsIcon /> },
      ],
    },
    {
      id: 'archive',
      title: 'Архив',
      items: [{ to: '/notifications', label: 'История', icon: <BellIcon /> }],
    },
  ]
  if (isAdmin) {
    groups[groups.length - 1].items.push({ to: '/admin', label: 'Админ', icon: <AdminIcon /> })
  }
  return groups
}
