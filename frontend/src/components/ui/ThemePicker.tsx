import { useEffect, useRef, useState } from 'react'
import { useTheme, type ThemeMeta } from '@/context/ThemeContext'

/**
 * Компактный свотч: диагональ из трёх полос — bg / surface / accent.
 * Тонкая кольцевая граница + едва заметная тень для контраста на любом фоне.
 */
function Swatch({ swatch, size = 20 }: { swatch: ThemeMeta['swatch']; size?: number }) {
  const [bg, surface, accent] = swatch
  return (
    <span
      aria-hidden
      className="inline-block rounded-full ring-1 ring-black/10 dark:ring-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${bg} 0 42%, ${surface} 42% 62%, ${accent} 62% 100%)`,
      }}
    />
  )
}

export default function ThemePicker() {
  const { theme, setTheme, themes, meta } = useTheme()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Палитра: ${meta.label}`}
        aria-label={`Сменить тему. Текущая: ${meta.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center touch-manipulation"
      >
        <Swatch swatch={meta.swatch} size={20} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Палитра темы"
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[220px] rounded-xl border border-line bg-surface shadow-lg overflow-hidden"
          style={{ animation: 'themePopIn 0.12s ease-out both' }}
        >
          <div className="px-3 pt-2.5 pb-1.5 text-[10px] uppercase tracking-[0.22em] font-medium text-ink-muted">
            Палитра
          </div>
          <ul className="pb-1.5">
            {themes.map((t) => {
              const selected = t.id === theme
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setTheme(t.id)
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-paper-tint transition-colors"
                  >
                    <Swatch swatch={t.swatch} size={20} />
                    <span className="flex-1 text-sm text-ink">{t.label}</span>
                    {selected ? (
                      <svg className="w-4 h-4 text-ink-soft" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 011.42-1.42L8 12.58l7.29-7.29a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span className="w-4 h-4" aria-hidden />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
