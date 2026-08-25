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
import { buildNav, BoardsIcon, type NavItem } from '@/lib/nav'

type Item = NavItem & {
  count?: number
  showDot?: boolean
}

const PRIO_COLOR: Record<string, string> = {
  low: 'var(--mid)',
  medium: 'var(--fg-body)',
  high: 'var(--accent)',
  urgent: 'var(--red)',
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

  // Структура приходит из общего модуля; здесь на неё накладываются только
  // живые данные, которых палитра не показывает.
  const COUNTS: Record<string, number | undefined> = {
    '/today': myDayCount > 0 ? myDayCount : undefined,
    '/tasks': tasksCount > 0 ? tasksCount : undefined,
    '/notifications': unread > 0 ? unread : undefined,
  }
  const navGroups = buildNav({ isAdmin }).map((g) => ({
    ...g,
    items: g.items.map<Item>((i) => ({
      ...i,
      count: COUNTS[i.to],
      showDot: i.to === '/notifications' && unread > 0,
    })),
  }))

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
        {navGroups.map((g) =>
          g.title === null ? (
            <nav key={g.id} className="ts-side__nav">{g.items.map(renderLink)}</nav>
          ) : (
            <div key={g.id}>
              <div className="ts-side__group-title">{g.title}</div>
              <nav className="ts-side__nav">{g.items.map(renderLink)}</nav>
            </div>
          ),
        )}

        <SidebarBoardTree onClose={onClose} taskCounts={taskCountsByBoard} />
      </div>

      {/* Bottom: search + theme + logout */}
      <div className="ts-side__bottom">
        <div style={{ position: 'relative' }}>
          <div className="ts-side__group-title">Поиск</div>
          <div className="ts-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                          <span style={{ fontSize: 10, color: PRIO_COLOR[t.priority] ?? 'var(--mid)', fontWeight: 600 }}>
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
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--mid)' }}>
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
