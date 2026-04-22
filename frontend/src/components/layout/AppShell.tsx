import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Rail from './Rail'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return

      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        navigate('/calendar/day?new=1')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return (
    <div className="ts-shell">
      {/* Mobile burger (only below 1024px) */}
      <button
        type="button"
        aria-label="Меню"
        onClick={() => setSidebarOpen(true)}
        className="ts-shell__burger icon-btn lg:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="ts-shell__backdrop lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Rail />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        searchRef={searchInputRef}
      />

      <main className="ts-shell__main glass">
        <div className="ts-shell__content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
