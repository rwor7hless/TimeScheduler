import { createContext, useContext, useState, useEffect, useMemo } from 'react'

export type ThemeId =
  | 'light'
  | 'dark'
  | 'sky'
  | 'blossom'
  | 'lavender'
  | 'midnight'
  | 'purple'
  | 'rose'
  | 'pink'
  | 'gruvbox'

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
    id: 'light', label: 'Светлая', isDark: false,
    swatch: ['#F8FAFC', '#FFFFFF', '#4F46E5'],
    accent: '#4F46E5', accentLight: '#6366F1', accentDark: '#4338CA',
    bg: '#F8FAFC', surface: '#FFFFFF',
  },
  {
    id: 'dark', label: 'Тёмная', isDark: true,
    swatch: ['#0F172A', '#1E293B', '#818CF8'],
    accent: '#818CF8', accentLight: '#A5B4FC', accentDark: '#6366F1',
    bg: '#0F172A', surface: '#1E293B',
  },
  {
    id: 'sky', label: 'Небесная', isDark: false,
    swatch: ['#E3F0FB', '#F0F7FD', '#0369A1'],
    accent: '#0369A1', accentLight: '#0284C7', accentDark: '#075985',
    bg: '#E3F0FB', surface: '#F0F7FD',
  },
  {
    id: 'blossom', label: 'Розы', isDark: false,
    swatch: ['#F7E2DE', '#FCEDE9', '#722F37'],
    accent: '#722F37', accentLight: '#A85A60', accentDark: '#4A1F24',
    bg: '#F7E2DE', surface: '#FCEDE9',
  },
  {
    id: 'lavender', label: 'Лаванда', isDark: false,
    swatch: ['#ECE2F4', '#F4ECF7', '#8963CF'],
    accent: '#8963CF', accentLight: '#A586D8', accentDark: '#6B4B9B',
    bg: '#ECE2F4', surface: '#F4ECF7',
  },
  {
    id: 'midnight', label: 'Полночная', isDark: true,
    swatch: ['#0A0D12', '#161A22', '#3B82F6'],
    accent: '#3B82F6', accentLight: '#60A5FA', accentDark: '#2563EB',
    bg: '#0A0D12', surface: '#161A22',
  },
  {
    id: 'purple', label: 'Фиолет', isDark: true,
    swatch: ['#0C0A10', '#181420', '#A855F7'],
    accent: '#A855F7', accentLight: '#C084FC', accentDark: '#9333EA',
    bg: '#0C0A10', surface: '#181420',
  },
  {
    id: 'rose', label: 'Винная', isDark: true,
    swatch: ['#100A0D', '#1A1417', '#F43F5E'],
    accent: '#F43F5E', accentLight: '#FB7185', accentDark: '#E11D48',
    bg: '#100A0D', surface: '#1A1417',
  },
  {
    id: 'pink', label: 'Пинк', isDark: true,
    swatch: ['#0D0A0F', '#19161F', '#F472B6'],
    accent: '#F472B6', accentLight: '#F9A8D4', accentDark: '#EC4899',
    bg: '#0D0A0F', surface: '#19161F',
  },
  {
    id: 'gruvbox', label: 'Gruvbox', isDark: true,
    swatch: ['#1D2021', '#32302F', '#FE8019'],
    accent: '#FE8019', accentLight: '#FABD2F', accentDark: '#D65D0E',
    bg: '#1D2021', surface: '#32302F',
  },
] as const

const DEFAULT_THEME: ThemeId = 'light'
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
  /** Legacy-toggle: переключает между тёмным и светлым семейством,
   *  оставаясь на соседней нейтральной палитре. */
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
  isDark: false,
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
