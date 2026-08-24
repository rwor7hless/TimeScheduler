import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useUnreadReportsCount } from '@/hooks/useReports'
import { useTasks } from '@/hooks/useTasks'
import { searchApi, type SearchResult } from '@/api/search'
import TagBadgeGroup from '@/components/tasks/TagBadgeGroup'
import SidebarBoardTree from './SidebarBoardTree'

type Item = {
  to: string
  label: string
  count?: number
  showDot?: boolean
  match?: (p: string) => boolean
  icon: JSX.Element
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  )
}
function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}
function BoardsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="6" height="16" rx="2" />
      <rect x="11" y="4" width="4" height="10" rx="2" />
      <rect x="17" y="4" width="4" height="14" rx="2" />
    </svg>
  )
}
function HabitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12l4 4 12-12" />
    </svg>
  )
}
function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  )
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h10l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M7 12h10M7 16h7M7 8h6" />
    </svg>
  )
}
function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

const PRIO_COLOR: Record<string, string> = {
  low: 'var(--ink-3)',
  medium: 'var(--blue)',
  high: 'var(--orange)',
  urgent: 'var(--danger)',
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  searchRef?: React.RefObject<HTMLInputElement | null>
}

export default function Sidebar({ isOpen, onClose, searchRef }: SidebarProps) {
  const { logout, isAdmin, user } = useAuth()
  const { theme, toggle } = useTheme()
  const unread = useUnreadReportsCount()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = (searchRef as React.RefObject<HTMLInputElement>) ?? internalRef
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const dropRef = useRef<HTMLDivElement>(null)

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults(null)
      setShowResults(false)
      return
    }
    try {
      const data = await searchApi.search(q.trim())
      setResults(data)
      setShowResults(true)
    } catch {
      setResults(null)
    }
  }, [])

  function onSearchChange(v: string) {
    setQuery(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(v), 300)
  }

  function navigateToResult(type: string, id: number, boardId?: number | null) {
    if (type === 'task') {
      navigate(boardId ? `/list/${boardId}` : '/tasks')
    } else if (type === 'habit') navigate('/habits')
    else if (type === 'board') navigate(`/list/${id}`)
    setQuery('')
    setResults(null)
    setShowResults(false)
    onClose()
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [inputRef])

  const { data: allTasks } = useTasks()
  const todayStr = new Date().toISOString().slice(0, 10)
  const taskCountsByBoard = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of allTasks ?? []) {
      if (t.is_archived || t.done || t.board_id == null) continue
      m.set(t.board_id, (m.get(t.board_id) ?? 0) + 1)
    }
    return m
  }, [allTasks])

  const myDayCount = useMemo(() => (allTasks ?? []).filter((t) => {
    if (t.is_archived || t.done) return false
    return t.my_day || t.scheduled_start?.slice(0, 10) === todayStr || t.deadline?.slice(0, 10) === todayStr
  }).length, [allTasks, todayStr])

  const tasksCount = useMemo(() => (allTasks ?? []).filter((t) => !t.is_archived && !t.done).length, [allTasks])

  const myDay: Item[] = [
    { to: '/today', label: 'Мой день', count: myDayCount > 0 ? myDayCount : undefined, icon: <ClockIcon /> },
  ]
  const planning: Item[] = [
    { to: '/tasks', label: 'Задачи', count: tasksCount > 0 ? tasksCount : undefined, match: (p) => p === '/tasks', icon: <BoardsIcon /> },
    { to: '/calendar/day', label: 'Календарь', match: (p) => p.startsWith('/calendar'), icon: <CalIcon /> },
  ]
  const tracking: Item[] = [
    { to: '/habits', label: 'Привычки', icon: <HabitIcon /> },
    { to: '/stats', label: 'Статистика', icon: <StatsIcon /> },
  ]
  const history: Item[] = [
    { to: '/notifications', label: 'История', count: unread > 0 ? unread : undefined, showDot: unread > 0, icon: <BellIcon /> },
  ]
  if (isAdmin) history.push({ to: '/admin', label: 'Админ', icon: <AdminIcon /> })

  const hasResults = results && (results.tasks.length + results.habits.length + results.boards.length) > 0

  function renderLink(item: Item) {
    const isActive = item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(item.to + '/')
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onClose}
        className={clsx('ts-side__link', isActive && 'active')}
      >
        {item.icon}
        <span style={{ flex: 1 }}>{item.label}</span>
        {typeof item.count === 'number' && (
          <span className="ts-side__count" style={{ color: 'var(--mid)' }}>{item.count}</span>
        )}
        {item.showDot && typeof item.count !== 'number' && <span className="ts-side__dot" />}
      </NavLink>
    )
  }

  return (
    <aside className={clsx('ts-side', isOpen && 'is-open')}>
      {/* User */}
      <div className="ts-side__user">
        <div className="ts-side__avatar">
          <div>{user?.username?.charAt(0).toUpperCase() ?? 'U'}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="ts-side__name">
            {user?.username ?? 'User'}
          </div>
        </div>
      </div>

      <div className="ts-side__scroll">
        <nav className="ts-side__nav">{myDay.map(renderLink)}</nav>

        <div>
          <div className="ts-side__group-title">Планирование</div>
          <nav className="ts-side__nav">{planning.map(renderLink)}</nav>
        </div>

        <div>
          <div className="ts-side__group-title">Трекинг</div>
          <nav className="ts-side__nav">{tracking.map(renderLink)}</nav>
        </div>

        <div>
          <div className="ts-side__group-title">Архив</div>
          <nav className="ts-side__nav">{history.map(renderLink)}</nav>
        </div>

        <SidebarBoardTree onClose={onClose} taskCounts={taskCountsByBoard} />
      </div>

      {/* Bottom: search + theme + logout */}
      <div className="ts-side__bottom">
        <div style={{ position: 'relative' }}>
          <div className="ts-side__group-title">Поиск</div>
          <div className="ts-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => results && setShowResults(true)}
              placeholder="Задачи, привычки, проекты"
            />
          </div>

          {showResults && (
            <div
              ref={dropRef}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                maxHeight: 320,
                overflowY: 'auto',
                zIndex: 46,
                padding: 8,
              }}
            >
              {hasResults ? (
                <>
                  {results!.tasks.length > 0 && (
                    <div>
                      <div className="ts-side__group-title">Задачи</div>
                      {results!.tasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => navigateToResult('task', t.id, t.board_id)}
                          className="ts-side__link"
                          style={{ padding: '7px 10px' }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: t.color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.title}
                          </span>
                          {t.tags && t.tags.length > 0 && <TagBadgeGroup tags={t.tags} />}
                          <span style={{ fontSize: 10, color: PRIO_COLOR[t.priority] ?? 'var(--ink-3)', fontWeight: 600 }}>
                            {t.priority}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {results!.habits.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
                      <div className="ts-side__group-title">Привычки</div>
                      {results!.habits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => navigateToResult('habit', h.id)}
                          className="ts-side__link"
                          style={{ padding: '7px 10px' }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{h.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {results!.boards.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
                      <div className="ts-side__group-title">Проекты</div>
                      {results!.boards.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => navigateToResult('board', b.id)}
                          className="ts-side__link"
                          style={{ padding: '7px 10px' }}
                        >
                          <BoardsIcon />
                          <span style={{ flex: 1 }}>{b.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
                  Ничего не найдено
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={toggle}
            className="icon-btn"
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={logout}
            className="icon-btn"
            title="Выйти"
            aria-label="Выйти"
            style={{ marginLeft: 'auto' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
