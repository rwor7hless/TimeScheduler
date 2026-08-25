import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

/**
 * Шапка, существующая только ниже 900px.
 *
 * Смена темы и выход живут в подвале сайдбара, а на узком экране сайдбар не
 * рендерится вовсе — без этой шапки выйти из аккаунта с телефона было нельзя,
 * а тему пришлось бы искать в палитре, о которой ещё надо догадаться.
 */
export default function MobileTopBar() {
  const { theme, toggle } = useTheme()
  const { logout } = useAuth()
  const nextThemeLabel = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'

  return (
    <header className="ts-mobiletop">
      <span className="ts-mobiletop__title">TimeScheduler</span>
      <div className="ts-mobiletop__actions">
        <button type="button" onClick={toggle} className="icon-btn" title={nextThemeLabel} aria-label={nextThemeLabel}>
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
        <button type="button" onClick={logout} className="icon-btn" title="Выйти" aria-label="Выйти">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  )
}
