import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { useUnreadReportsCount } from '@/hooks/useReports'

type Item = { to: string; label: string; match?: (path: string) => boolean; icon: JSX.Element }

const items: Item[] = [
  {
    to: '/today',
    label: 'Сегодня',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    to: '/calendar/day',
    label: 'Календарь',
    match: (p) => p.startsWith('/calendar'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    ),
  },
  {
    to: '/projects',
    label: 'Проекты',
    match: (p) => p.startsWith('/projects') || p.startsWith('/project'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="6" height="16" rx="2" />
        <rect x="11" y="4" width="4" height="10" rx="2" />
        <rect x="17" y="4" width="4" height="14" rx="2" />
      </svg>
    ),
  },
  {
    to: '/habits',
    label: 'Привычки',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 12l4 4 12-12" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: 'Статистика',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
      </svg>
    ),
  },
  {
    to: '/budget',
    label: 'Бюджет',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <circle cx="16" cy="12" r="1.8" />
      </svg>
    ),
  },
  {
    to: '/notifications',
    label: 'История',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 3h10l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M7 12h10M7 16h7M7 8h6" />
      </svg>
    ),
  },
]

export default function Rail() {
  const { pathname } = useLocation()
  const { isAdmin } = useAuth()
  const unread = useUnreadReportsCount()

  const nav = [...items]
  if (isAdmin) {
    nav.push({
      to: '/admin',
      label: 'Админ',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      ),
    })
  }

  return (
    <aside className="ts-rail glass">
      <NavLink to="/today" className="ts-rail__logo" aria-label="TimeScheduler">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </NavLink>

      {nav.map((item) => {
        const isActive = item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(item.to + '/')
        const isNotifs = item.to === '/notifications'
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={clsx('ts-rail__btn', isActive && 'active')}
            aria-label={item.label}
          >
            {item.icon}
            {isNotifs && unread > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 7,
                  right: 7,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                }}
              />
            )}
            <span className="ts-rail__tooltip">{item.label}</span>
          </NavLink>
        )
      })}

      <div className="ts-rail__spacer" />
    </aside>
  )
}
