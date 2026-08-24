import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { DARK, LIGHT } from '@/styles/tokens'

export type ThemeId = 'dark' | 'light'

export interface ThemeMeta {
  id: ThemeId
  label: string
  isDark: boolean
  /** bg / surface / accent — для свотчей в UI и превью. */
  swatch: readonly [string, string, string]
  /** Ключевые цвета палитры — для мест, где CSS-переменные не раскрываются
   *  (SVG-атрибуты recharts, inline-стили анимаций). */
  accent: string
  accentLight: string
  accentDark: string
  bg: string
  surface: string
}

export const THEMES: readonly ThemeMeta[] = [
  {
    id: 'dark', label: 'Тёмная', isDark: true,
    swatch: [DARK.bg, DARK.bgCell, DARK.accent],
    accent: DARK.accent, accentLight: DARK.accentLight, accentDark: DARK.accentDark,
    bg: DARK.bg, surface: DARK.bgCell,
  },
  {
    id: 'light', label: 'Светлая', isDark: false,
    swatch: [LIGHT.bg, LIGHT.bgCell, LIGHT.accent],
    accent: LIGHT.accent, accentLight: LIGHT.accentLight, accentDark: LIGHT.accentDark,
    bg: LIGHT.bg, surface: LIGHT.bgCell,
  },
] as const

const DEFAULT_THEME: ThemeId = 'dark'
const STORAGE_KEY = 'theme'
const VALID_IDS = new Set<string>(THEMES.map((t) => t.id))

function normalizeTheme(value: string | null): ThemeId {
  if (value && VALID_IDS.has(value)) return value as ThemeId
  return DEFAULT_THEME
}

function findMeta(id: ThemeId): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

interface ThemeContextValue {
  /** Идентификатор текущей темы (для обратной совместимости поле называется theme). */
  theme: ThemeId
  /** Полный метаобъект активной темы. */
  meta: ThemeMeta
  /** Прямая установка темы по id. */
  setTheme: (id: ThemeId) => void
  /** Legacy-toggle: переключает между двумя темами — тёмной и светлой. */
  toggle: () => void
  /** true, если активная тема относится к тёмному семейству. */
  isDark: boolean
  /** Выжимка ключевых цветов — для inline-стилей и SVG, где var() не работает. */
  colors: Pick<ThemeMeta, 'accent' | 'accentLight' | 'accentDark' | 'bg' | 'surface'>
  /** Полный список доступных тем — для UI-пикера. */
  themes: readonly ThemeMeta[]
}

const defaultMeta = findMeta(DEFAULT_THEME)

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  meta: defaultMeta,
  setTheme: () => {},
  toggle: () => {},
  isDark: defaultMeta.isDark,
  colors: defaultMeta,
  themes: THEMES,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() =>
    normalizeTheme(typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null),
  )

  useEffect(() => {
    const root = document.documentElement
    const meta = findMeta(theme)
    root.setAttribute('data-theme', theme)
    root.classList.toggle('dark', meta.isDark)
    localStorage.setItem(STORAGE_KEY, theme)
    // Синхронизируем meta theme-color, чтобы status bar на мобильных подхватил тон
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((tag) => {
      tag.setAttribute('content', meta.bg)
      tag.removeAttribute('media')
    })
  }, [theme])

  const value = useMemo<ThemeContextValue>(() => {
    const meta = findMeta(theme)
    return {
      theme,
      meta,
      setTheme: (id) => setThemeState(id),
      toggle: () =>
        setThemeState((prev) => (findMeta(prev).isDark ? 'light' : 'dark')),
      isDark: meta.isDark,
      colors: {
        accent: meta.accent,
        accentLight: meta.accentLight,
        accentDark: meta.accentDark,
        bg: meta.bg,
        surface: meta.surface,
      },
      themes: THEMES,
    }
  }, [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
