import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import Spinner from '@/components/ui/Spinner'
import { useWeekStats } from '@/hooks/useWeekStats'
import { useReports } from '@/hooks/useReports'
import type { BreakdownItem } from '@/types/stats'
import { CHART_COLORS as DEFAULT_COLORS } from '@/lib/colors'
import { WeekNavigator } from './WeekNavigator'
import { WeekReportBody } from './WeekReportBody'
import { KpiCard } from './KpiCard'
import { DailyBarsMicro } from './DailyBarsMicro'
import { HabitsWeekGrid } from './HabitsWeekGrid'
import { PeakHoursStrip } from './PeakHoursStrip'

interface Props {
  weekStart: string
  onWeekChange: (ws: string) => void
}

function BreakdownBar({ title, items }: { title: string; items: BreakdownItem[] }) {
  if (items.length === 0) return null
  const total = items.reduce((s, i) => s + i.count, 0)
  if (total === 0) return null
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-fg-mid">{title}</h4>
      <div className="space-y-1">
        {items.map((item, idx) => {
          const pct = Math.round((item.count / total) * 100)
          const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
          return (
            <div
              key={item.label}
              className="group flex items-center gap-2 -mx-1 px-1 py-1 cursor-default transition-colors hover:bg-bg-raised"
            >
              <div
                className="w-2 h-2 flex-shrink-0 transition-transform duration-200 group-hover:scale-150"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-fg-body flex-1 truncate group-hover:text-fg transition-colors">
                {item.label}
              </span>
              <div className="w-20 h-1.5 bg-bg-hover overflow-hidden">
                <div
                  className="h-full transition-all duration-200 group-hover:brightness-110"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-xs text-fg-mid w-8 text-right tabular-nums">
                {item.count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StatsWeekView({ weekStart, onWeekChange }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useWeekStats(weekStart)
  const { data: reports } = useReports()
  const earliestReport = reports?.[reports.length - 1]?.week_start

  const blockVariants = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.2, 0.6, 0.2, 1] } },
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            delayChildren: shouldReduceMotion ? 0 : 0.05,
            staggerChildren: shouldReduceMotion ? 0 : 0.08,
          },
        },
      }}
      className="space-y-6"
    >
      <motion.div variants={blockVariants}>
        <WeekNavigator weekStart={weekStart} onChange={onWeekChange} minDate={earliestReport} />
      </motion.div>

      {isLoading && <Spinner className="mt-10" />}

      {isError && (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <div className="text-sm text-fg-mid">
            Не удалось загрузить неделю.
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-1.5 text-xs font-medium bg-accent text-bg hover:bg-accent-dark transition-colors"
          >
            Повторить
          </button>
        </div>
      )}

      {stats && (
        <>
          <motion.div variants={blockVariants} className="grid grid-cols-4 narrow:grid-cols-2 gap-3">
            <KpiCard label="Активные" value={stats.active_tasks} />
            <KpiCard label="Просрочено" value={stats.overdue_count} accent="red" />
            <KpiCard
              label="Ср. закрытие"
              value={stats.avg_completion_hours != null ? stats.avg_completion_hours : '—'}
              sub={stats.avg_completion_hours != null ? 'ч' : undefined}
              accent="violet"
            />
            <KpiCard
              label="Привычки"
              value={
                stats.habit_progress.length > 0
                  ? Math.round(
                      (stats.habit_progress.reduce((s, h) => s + h.completion_rate, 0) /
                        stats.habit_progress.length) *
                        100,
                    )
                  : '—'
              }
              sub={stats.habit_progress.length > 0 ? '%' : undefined}
              accent="sky"
            />
          </motion.div>

          <motion.div variants={blockVariants}>
            <DailyBarsMicro weekStart={weekStart} dailyCompletions={stats.daily_completions} />
          </motion.div>

          <motion.div variants={blockVariants}>
            <WeekReportBody weekStart={weekStart} />
          </motion.div>

          <motion.div variants={blockVariants}>
            <HabitsWeekGrid habits={stats.habit_progress} />
          </motion.div>

          <motion.div variants={blockVariants}>
            <PeakHoursStrip hours={stats.most_active_hours} />
          </motion.div>

          {(stats.by_priority.length > 0 || stats.by_board.length > 0 || stats.by_tag.length > 0) && (
            <motion.div variants={blockVariants} className="grid grid-cols-3 narrow:grid-cols-1 gap-4">
              <div className="bg-bg-cell border border-line p-4">
                <BreakdownBar title="По приоритету" items={stats.by_priority} />
              </div>
              <div className="bg-bg-cell border border-line p-4">
                <BreakdownBar title="По доскам" items={stats.by_board} />
              </div>
              <div className="bg-bg-cell border border-line p-4">
                <BreakdownBar title="По тегам" items={stats.by_tag} />
              </div>
            </motion.div>
          )}

          <motion.div
            variants={blockVariants}
            className="flex flex-wrap items-center justify-end gap-3 pt-2"
          >
            <Link
              to="/notifications"
              className="text-sm text-fg-mid hover:text-accent transition-colors"
            >
              История отчётов →
            </Link>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
