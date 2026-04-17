import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import { searchApi, type SearchResult } from '@/api/search'
import TagBadgeGroup from '@/components/tasks/TagBadgeGroup'

interface HeaderProps {
  onMenuToggle: () => void
  searchRef?: React.RefObject<HTMLInputElement | null>
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-gray-400', medium: 'text-blue-400', high: 'text-orange-500', urgent: 'text-red-500',
}

export default function Header({ onMenuToggle, searchRef }: HeaderProps) {
  const { theme, toggle } = useTheme()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  const navigate = useNavigate()
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = (searchRef as React.RefObject<HTMLInputElement>) ?? internalRef
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string) => {
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

  const handleSearchChange = (value: string) => {
    setSearch(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (q) {
      navigate(`/calendar/day?search=${encodeURIComponent(q)}`)
      closeSearch()
    }
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearch('')
    setResults(null)
    setShowResults(false)
  }

  function navigateToResult(type: string, id: number, boardId?: number | null) {
    if (type === 'task') {
      if (boardId) navigate(`/kanban/${boardId}`)
      else navigate('/kanban')
    } else if (type === 'habit') {
      navigate('/habits')
    } else if (type === 'board') {
      navigate(`/kanban/${id}`)
    }
    closeSearch()
  }

  // Close on Escape or click outside
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && searchOpen) closeSearch()
    }
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [searchOpen])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen, inputRef])

  const hasResults = results && (results.tasks.length > 0 || results.habits.length > 0 || results.boards.length > 0)

  return (
    <>
      <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-6 gap-2">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Меню"
          className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center touch-manipulation"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Date / Search */}
        {searchOpen ? (
          <div className="flex-1 relative">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => results && setShowResults(true)}
                placeholder="Поиск задач, привычек, досок... (Enter)"
                aria-label="Поиск задач, привычек и досок"
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Закрыть поиск"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </form>

            {/* Search results dropdown */}
            {showResults && hasResults && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto"
              >
                {results!.tasks.length > 0 && (
                  <div className="p-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 mb-1">Задачи</div>
                    {results!.tasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => navigateToResult('task', t.id, t.board_id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{t.title}</span>
                        {t.tags && t.tags.length > 0 && (
                          <TagBadgeGroup tags={t.tags} className="flex-shrink-0" />
                        )}
                        <span className={`text-[10px] font-medium ${PRIORITY_COLOR[t.priority]}`}>
                          {t.priority}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {results!.habits.length > 0 && (
                  <div className="p-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 mb-1">Привычки</div>
                    {results!.habits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => navigateToResult('habit', h.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: h.color }} />
                        <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{h.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results!.boards.length > 0 && (
                  <div className="p-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 mb-1">Доски</div>
                    {results!.boards.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => navigateToResult('board', b.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                        <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{b.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showResults && search.trim() && !hasResults && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-4 text-center text-sm text-gray-400"
              >
                Ничего не найдено
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-1 min-w-0 truncate">
            {new Date().toLocaleDateString('ru-RU', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        )}

        {/* Search button */}
        {!searchOpen && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            title="Поиск задач (/)"
            aria-label="Поиск задач"
            className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center touch-manipulation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={toggle}
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center touch-manipulation"
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="5" strokeWidth="2"/>
              <path strokeWidth="2" strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </header>
    </>
  )
}
