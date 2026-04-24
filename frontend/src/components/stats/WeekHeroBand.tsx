import { motion, useReducedMotion } from 'framer-motion'
import type { Stats } from '@/types/stats'
import { AnimatedNumber } from './AnimatedNumber'

interface Props {
  stats: Stats
}

function bestDayLabel(stats: Stats): { label: string; count: number } | null {
  if (!stats.daily_completions.length) return null
  const best = stats.daily_completions.reduce((a, b) => (b.count > a.count ? b : a))
  if (best.count === 0) return null
  // date = "YYYY-MM-DD", render as DD.MM plus weekday short.
  const d = new Date(best.date + 'T00:00:00Z')
  const weekday = d.toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' })
  const dayMonth = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return { label: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${dayMonth}`, count: best.count }
}

function computeDeltas(stats: Stats) {
  const prev = stats.previous_period_metrics
  if (!prev) return { completed: undefined, productivity: undefined, active: undefined } as const

  const completedDelta = stats.completed_last_month - prev.completed_count
  const productivityDelta =
    stats.productivity_percent != null && prev.productivity_percent != null
      ? Math.round((stats.productivity_percent - prev.productivity_percent) * 10) / 10
      : undefined
  const activeDaysNow = stats.daily_completions.filter((d) => d.count > 0).length
  const activeDaysDelta = activeDaysNow - prev.active_days

  return {
    completed: completedDelta,
    productivity: productivityDelta,
    active: activeDaysDelta,
  } as const
}

function DeltaPill({ delta, suffix }: { delta: number | undefined; suffix: string }) {
  if (delta === undefined) return null
  const isZero = delta === 0
  const isPositive = delta > 0
  const arrow = isZero ? '=' : isPositive ? '↑' : '↓'
  const cls = isZero
    ? 'bg-white/40 dark:bg-white/10 text-gray-600 dark:text-gray-300'
    : isPositive
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${cls}`}
    >
      <span>{arrow}</span>
      <span>
        {Math.abs(delta)}
        {suffix}
      </span>
    </span>
  )
}

function HeroMetric({
  label,
  value,
  unit,
  delta,
  deltaSuffix,
  animate,
}: {
  label: string
  value: string | number
  unit?: string
  delta?: number
  deltaSuffix: string
  animate?: { numericTarget: number; format?: (v: number) => string }
}) {
  const shouldReduceMotion = useReducedMotion()
  return (
    <motion.div
      whileHover={
        shouldReduceMotion
          ? undefined
          : { scale: 1.03, transition: { duration: 0.2, ease: [0.2, 0.6, 0.2, 1] } }
      }
      className="group flex-1 min-w-0 flex flex-col items-center text-center cursor-default"
    >
      <div className="flex items-baseline gap-2 mb-0.5 justify-center">
        <div className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-50 tabular-nums transition-colors duration-200 group-hover:text-amber-600 dark:group-hover:text-amber-400">
          {animate ? (
            <AnimatedNumber value={animate.numericTarget} format={animate.format} />
          ) : (
            value
          )}
        </div>
        {unit && (
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{unit}</span>
        )}
        <DeltaPill delta={delta} suffix={deltaSuffix} />
      </div>
      <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 transition-colors duration-200 group-hover:text-gray-700 dark:group-hover:text-gray-300">
        {label}
      </div>
    </motion.div>
  )
}

export function WeekHeroBand({ stats }: Props) {
  const deltas = computeDeltas(stats)
  const best = bestDayLabel(stats)
  const activeDays = stats.daily_completions.filter((d) => d.count > 0).length
  const avgPerDay = (stats.completed_last_month / 7).toFixed(1)
  const productivity = stats.productivity_percent

  return (
    <section className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 sm:px-6 py-5 sm:py-6">
      <div className="relative">
        <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 text-center">
          Ваша неделя в 3 цифрах
        </div>

        <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-center sm:items-start justify-center">
          <HeroMetric
            label="Выполнено задач"
            value={stats.completed_last_month}
            delta={deltas.completed}
            deltaSuffix=""
            animate={{ numericTarget: stats.completed_last_month }}
          />
          <HeroMetric
            label="Продуктивность"
            value={productivity != null ? productivity : '—'}
            unit={productivity != null ? '%' : undefined}
            delta={deltas.productivity}
            deltaSuffix=" pp"
            animate={
              productivity != null
                ? { numericTarget: productivity, format: (v) => String(Math.round(v)) }
                : undefined
            }
          />
          <HeroMetric
            label="Активных дней"
            value={`${activeDays}/7`}
            delta={deltas.active}
            deltaSuffix=""
            animate={{
              numericTarget: activeDays,
              format: (v) => `${Math.round(v)}/7`,
            }}
          />
        </div>

        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 dark:text-gray-400 justify-center text-center">
          {best && (
            <span>
              Лучший день:{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{best.label}</span>{' '}
              · {best.count} задач
            </span>
          )}
          <span>
            Средний темп:{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">{avgPerDay}</span> в
            день
          </span>
        </div>
      </div>
    </section>
  )
}
