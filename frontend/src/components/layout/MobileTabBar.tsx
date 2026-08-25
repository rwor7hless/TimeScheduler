import { NavLink } from 'react-router-dom'
import { buildNav } from '@/lib/nav'

/** Четыре вкладки из спека; порядок задаётся здесь, а не порядком в навигации. */
const TABS = ['/today', '/tasks', '/habits', '/stats']

export default function MobileTabBar({ onPlus }: { onPlus: () => void }) {
  // isAdmin: false — админка во вкладки не входит, и запрашивать её тут незачем.
  const items = buildNav({ isAdmin: false })
    .flatMap((g) => g.items)
    .filter((i) => TABS.includes(i.to))
    .sort((a, b) => TABS.indexOf(a.to) - TABS.indexOf(b.to))

  const left = items.slice(0, 2)
  const right = items.slice(2)

  return (
    <nav className="ts-tabbar" aria-label="Основная навигация">
      {left.map((i) => (
        <NavLink key={i.to} to={i.to} className="ts-tabbar__item" aria-label={i.label}>
          {i.icon}
          <span className="ts-tabbar__label">{i.label}</span>
        </NavLink>
      ))}
      <button type="button" className="ts-tabbar__plus" onClick={onPlus} aria-label="Создать">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {right.map((i) => (
        <NavLink key={i.to} to={i.to} className="ts-tabbar__item" aria-label={i.label}>
          {i.icon}
          <span className="ts-tabbar__label">{i.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
