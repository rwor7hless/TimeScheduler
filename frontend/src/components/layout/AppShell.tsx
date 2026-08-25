import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'

// Edge-swipe: палец должен стартовать не дальше 24px от левого края, чтобы
// не путать со свайпом внутри карусели/картинки. Порог «открыли» — 60px.
const SWIPE_EDGE = 24
const SWIPE_OPEN_THRESHOLD = 60
const SWIPE_CLOSE_THRESHOLD = 60

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

  // Edge-swipe на открытие / свайп влево на закрытие. Регистрируем вручную,
  // чтобы не тащить новую зависимость.
  useEffect(() => {
    let startX = 0
    let startY = 0
    let tracking: 'open' | 'close' | null = null

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      if (!sidebarOpen && startX <= SWIPE_EDGE) tracking = 'open'
      else if (sidebarOpen) tracking = 'close'
      else tracking = null
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking || e.touches.length !== 1) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      // Если по вертикали дернулись сильнее, чем по горизонтали — не свайп.
      if (dy > Math.abs(dx)) {
        tracking = null
        return
      }
      if (tracking === 'open' && dx > SWIPE_OPEN_THRESHOLD) {
        setSidebarOpen(true)
        tracking = null
      } else if (tracking === 'close' && dx < -SWIPE_CLOSE_THRESHOLD) {
        setSidebarOpen(false)
        tracking = null
      }
    }

    function onTouchEnd() {
      tracking = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [sidebarOpen])

  return (
    <div className="ts-shell">
      {/* Mobile burger: bottom-left, thumb zone. Свайп-от-края тоже открывает. */}
      <button
        type="button"
        aria-label="Меню"
        onClick={() => setSidebarOpen(true)}
        className="ts-shell__burger icon-btn hidden"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="ts-shell__backdrop hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        searchRef={searchInputRef}
      />

      <main className="ts-shell__main">
        <div className="ts-shell__content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
