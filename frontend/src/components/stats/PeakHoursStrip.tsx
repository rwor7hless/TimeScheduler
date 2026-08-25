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
    <div className="bg-bg-cell border border-line p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium text-fg-body">Пиковые часы</h3>
        {top.length > 0 ? (
          <div className="text-[11px] text-fg-mid">
            Пики:{' '}
            {top.map((h, idx) => (
              <span key={h}>
                <span className="font-semibold text-accent">{hh(h)}</span>
                {idx < top.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-fg-mid">Данных нет</div>
        )}
      </div>

      <div className="relative">
        {/* subtle gradient envelope behind the strip */}
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
                  'h-5 flex-1 transition-colors ' +
                  (isActive
                    ? 'bg-accent'
                    : 'bg-bg-hover')
                }
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-fg-mid mt-1.5">
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
