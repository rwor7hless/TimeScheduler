import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileTabBar from './MobileTabBar'
import CommandPalette from '@/components/palette/CommandPalette'
import { useCommandPalette } from '@/hooks/useCommandPalette'

export default function AppShell() {
  const palette = useCommandPalette()
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
      <Sidebar searchRef={searchInputRef} />

      <main className="ts-shell__main">
        <div className="ts-shell__content">
          <Outlet />
        </div>
      </main>

      <MobileTabBar onPlus={palette.open} />

      <CommandPalette isOpen={palette.isOpen} onClose={palette.close} />
    </div>
  )
}
