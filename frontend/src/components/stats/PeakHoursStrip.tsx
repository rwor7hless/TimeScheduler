import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  /** Active hours (0..23), unordered. Typically 3–4 entries. */
  hours: number[]
}

function hh(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

/**
 * 24-cell peak-hours strip with a subtle gradient envelope and a callout
 * naming the top-3 hours verbatim so the visual always has a verbal anchor.
 */
export function PeakHoursStrip({ hours }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const activeSet = new Set(hours)
  const top = [...hours].sort((a, b) => a - b).slice(0, 3)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Пиковые часы</h3>
        {top.length > 0 ? (
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Пики:{' '}
            {top.map((h, idx) => (
              <span key={h}>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{hh(h)}</span>
                {idx < top.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-gray-400 dark:text-gray-500">Данных нет</div>
        )}
      </div>

      <div className="relative">
        {/* subtle gradient envelope behind the strip */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-100/50 via-amber-50/20 to-transparent dark:from-amber-900/20 dark:via-amber-900/5 dark:to-transparent pointer-events-none" />
        <div className="relative flex gap-px">
          {Array.from({ length: 24 }, (_, h) => {
            const isActive = activeSet.has(h)
            return (
              <motion.div
                key={h}
                title={`${hh(h)}${isActive ? ' — активный' : ''}`}
                whileHover={shouldReduceMotion ? undefined : { scaleY: 1.25 }}
                transition={{ duration: 0.15 }}
                style={{ transformOrigin: 'bottom' }}
                className={
                  'h-5 flex-1 rounded-sm transition-colors ' +
                  (isActive
                    ? 'bg-gradient-to-t from-amber-500 to-amber-400 dark:from-amber-400 dark:to-amber-300'
                    : 'bg-gray-100 dark:bg-gray-700')
                }
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
          <span>0:00</span>
          <span>6:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
      </div>
    </div>
  )
}
