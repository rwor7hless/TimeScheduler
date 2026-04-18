import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  /** Monday ISO date, defines the 7-day window Mon..Sun. */
  weekStart: string
  /** Raw daily completions from stats. Any dates outside the window are ignored. */
  dailyCompletions: { date: string; count: number }[]
}

const RU_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/**
 * Pure-string date arithmetic that never crosses through a Date object.
 *
 * We must match `dailyCompletions[].date` verbatim — those come from the
 * backend as YYYY-MM-DD strings (SQL `func.date(completed_at)`). If we went
 * through `new Date(weekStart)` + `getUTCFullYear/Month/Date`, a user in a
 * positive timezone (e.g. Moscow UTC+3) would get each day shifted back by
 * one, causing every count lookup to miss.
 */
function shiftIsoDate(iso: string, days: number): string {
  // Use UTC midnight anchor purely as arithmetic, then read UTC parts back.
  // No local-time conversion ever happens, so TZ can't distort the result.
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10))
  const t = Date.UTC(y, m - 1, d) + days * 86400_000
  const out = new Date(t)
  return `${out.getUTCFullYear()}-${String(out.getUTCMonth() + 1).padStart(2, '0')}-${String(out.getUTCDate()).padStart(2, '0')}`
}

function todayLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DailyBarsMicro({ weekStart, dailyCompletions }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const todayIso = todayLocalIso()

  const countByDate = new Map(dailyCompletions.map((d) => [d.date, d.count]))

  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = shiftIsoDate(weekStart, i)
    return {
      iso,
      label: RU_LABELS[i],
      count: countByDate.get(iso) ?? 0,
      isFuture: iso > todayIso,
      isToday: iso === todayIso,
    }
  })

  const max = Math.max(1, ...days.map((d) => d.count))

  const BAR_AREA_PX = 120

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col h-full">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">По дням недели</h3>
      {/* Spacer pushes the chart to the bottom so bars share a visual floor
          with the labels under them, instead of floating at the top of the
          card when the row-stretched card is taller than its content. */}
      <div className="flex-1" />
      <div className="flex items-end justify-between gap-1.5">
        {days.map((d, i) => {
          // Use a fixed pixel bar-area height so flex/auto-sizing can't
          // collapse it to zero (the earlier bug — `items-end` made each
          // column intrinsic-sized, which killed the percentage-height bars).
          const heightPx =
            d.count === 0 ? 4 : Math.max(4, Math.round((d.count / max) * BAR_AREA_PX))
          return (
            <div
              key={d.iso}
              className="group flex-1 flex flex-col items-center gap-1.5 min-w-0 cursor-default"
              title={`${d.label}: ${d.count} задач`}
            >
              <div
                className="relative w-full flex items-end"
                style={{ height: BAR_AREA_PX }}
              >
                <motion.div
                  className={
                    d.isFuture
                      ? 'w-full rounded-t-md bg-gray-100 dark:bg-gray-700 opacity-40 border-t-2 border-dashed border-gray-300 dark:border-gray-600 transition-all'
                      : d.isToday
                      ? 'w-full rounded-t-md bg-gradient-to-t from-amber-500 to-amber-400 dark:from-amber-400 dark:to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all duration-200 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.75)] group-hover:from-amber-400 group-hover:to-amber-300'
                      : 'w-full rounded-t-md bg-gradient-to-t from-amber-500/70 to-amber-400/80 dark:from-amber-600/70 dark:to-amber-500/80 transition-all duration-200 group-hover:from-amber-500 group-hover:to-amber-400 dark:group-hover:from-amber-500 dark:group-hover:to-amber-400 group-hover:shadow-[0_0_14px_rgba(245,158,11,0.4)]'
                  }
                  style={{ height: heightPx, transformOrigin: 'bottom' }}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  whileHover={shouldReduceMotion ? undefined : { scaleY: 1.04 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.4,
                    delay: shouldReduceMotion ? 0 : i * 0.04,
                    ease: [0.2, 0.6, 0.2, 1],
                  }}
                />
              </div>
              <div
                className={
                  'text-[10px] uppercase tracking-wide transition-colors ' +
                  (d.isToday
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-amber-600 dark:group-hover:text-amber-400')
                }
              >
                {d.label}
              </div>
              <div className="text-[11px] tabular-nums font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-50 transition-colors">
                {d.isFuture ? '' : d.count}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
