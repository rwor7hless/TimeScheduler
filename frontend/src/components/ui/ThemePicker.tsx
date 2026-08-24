import { useTheme, type ThemeMeta } from '@/context/ThemeContext'

/**
 * Компактный свотч: диагональ из трёх полос — bg / surface / accent.
 * Тонкая кольцевая граница + едва заметная тень для контраста на любом фоне.
 */
function Swatch({ swatch, size = 14 }: { swatch: ThemeMeta['swatch']; size?: number }) {
  const [bg, surface, accent] = swatch
  return (
    <span
      aria-hidden
      className="inline-block ring-1 ring-black/10 dark:ring-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${bg} 0 42%, ${surface} 42% 62%, ${accent} 62% 100%)`,
      }}
    />
  )
}

/**
 * Два варианта темы — тумблер, а не карусель. С двумя пунктами стрелочная
 * навигация и выпадающий список только мешают: обе опции видны сразу.
 */
export default function ThemePicker() {
  const { theme, setTheme, themes } = useTheme()

  return (
    <div role="group" aria-label="Палитра темы" className="inline-flex">
      {themes.map((t, i) => {
        const active = t.id === theme
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            aria-label={`Тема: ${t.label}`}
            title={t.label}
            onClick={() => setTheme(t.id)}
            className={`ts-btn ts-btn--sm relative ${i > 0 ? '-ml-px' : ''} ${
              active ? 'primary-btn z-10' : ''
            }`}
          >
            <Swatch swatch={t.swatch} />
            <span>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
