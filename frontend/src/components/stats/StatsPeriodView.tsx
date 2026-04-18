import { useMemo } from 'react'
import clsx from 'clsx'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Spinner from '@/components/ui/Spinner'
import { useStats } from '@/hooks/useStats'
import { useTheme } from '@/context/ThemeContext'
import { CHART_COLORS as DEFAULT_COLORS } from '@/lib/colors'
import type { BreakdownItem } from '@/types/stats'
import type { StatsPeriod } from '@/api/stats'

/**
 * Month/Year view — the classic StatsPage layout.
 *
 * Preserved as-is (behavior, styling) during the Week-mode redesign:
 * this view is the fallback for "trailing N-day" analytics that don't
 * need AI reports or delta-vs-previous logic.
 */

const PERIOD_DAYS: Record<StatsPeriod, number> = { week: 7, month: 30, year: 365 }

function fillDailyGaps(
  raw: { date: string; count: number }[],
  periodDays: number,
): { date: string; label: string; count: number }[] {
  const map = new Map(raw.map((d) => [d.date, d.count]))
  const result: { date: string; label: string; count: number }[] = []
  const today = new Date()
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ date: key, label, count: map.get(key) ?? 0 })
  }
  return result
}

function calcStreak(filled: { date: string; count: number }[]): number {
  let streak = 0
  for (let i = filled.length - 1; i >= 0; i--) {
    if (filled[i].count > 0) streak++
    else break
  }
  return streak
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div
        className={clsx(
          'text-2xl font-bold',
          accent === 'green' && 'text-green-600 dark:text-green-400',
          accent === 'red' && 'text-red-500 dark:text-red-400',
          accent === 'amber' && 'text-amber-600 dark:text-amber-400',
          !accent && 'text-gray-900 dark:text-gray-100',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function BreakdownBar({ title, items }: { title: string; items: BreakdownItem[] }) {
  if (items.length === 0) return null
  const total = items.reduce((s, i) => s + i.count, 0)
  if (total === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</h4>
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const pct = Math.round((item.count / total) * 100)
          const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
          return (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{item.label}</span>
              <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{item.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StatsPeriodView({ period }: { period: 'month' | 'year' }) {
  const { theme } = useTheme()
  const { data: stats, isLoading, isError, refetch } = useStats(period)

  const chartData = useMemo(
    () => (stats ? fillDailyGaps(stats.daily_completions, PERIOD_DAYS[period]) : []),
    [stats, period],
  )

  const periodMetrics = useMemo(() => {
    if (!chartData.length) return null
    const total = chartData.reduce((s, d) => s + d.count, 0)
    const best = chartData.reduce((a, b) => (b.count > a.count ? b : a), chartData[0])
    const daysWithTasks = chartData.filter((d) => d.count > 0).length
    const streak = calcStreak(chartData)
    const avgPerDay = daysWithTasks > 0 ? total / PERIOD_DAYS[period] : 0
    return { total, best, daysWithTasks, streak, avgPerDay }
  }, [chartData, period])

  if (isLoading) return <Spinner className="mt-20" />
  if (isError) {
    return (
      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Не удалось загрузить статистику.
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-dark transition-colors"
        >
          Повторить
        </button>
      </div>
    )
  }
  if (!stats) {
    return (
      <div className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
        Пока нет данных для статистики. Создайте задачу или привычку, чтобы начать.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Активные задачи" value={stats.active_tasks} />
        <StatCard label="Выполнено" value={stats.completed_last_month} accent="green" />
        <StatCard label="Просрочено" value={stats.overdue_count} accent="red" />
        <StatCard
          label="Продуктивность"
          value={stats.productivity_percent != null ? `${stats.productivity_percent}%` : '—'}
          accent="amber"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Выполнения по дням</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#F3F4F6'} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                interval={period === 'year' ? 29 : 4}
              />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: theme === 'dark' ? '1px solid #334155' : '1px solid #E5E7EB',
                  backgroundColor: theme === 'dark' ? '#1E293B' : '#fff',
                  color: theme === 'dark' ? '#F1F5F9' : '#111827',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                labelFormatter={(label) => `Дата: ${label}`}
                formatter={(value: number) => [`${value} задач`, 'Выполнено']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#D97706"
                strokeWidth={2}
                fill="url(#colorCount)"
                dot={{ r: 2.5, fill: '#D97706', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#D97706', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Итоги периода</h3>
          {periodMetrics ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Выполнено задач</div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{periodMetrics.total}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Серия дней</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {periodMetrics.streak}
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">дн.</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Ср. в день</div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {periodMetrics.avgPerDay.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Активных дней</div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {periodMetrics.daysWithTasks}
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                      / {PERIOD_DAYS[period]}
                    </span>
                  </div>
                </div>
              </div>

              {periodMetrics.best.count > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Лучший день</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{periodMetrics.best.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">— {periodMetrics.best.count} задач</span>
                  </div>
                </div>
              )}

              {stats.most_active_hours.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Пиковые часы</div>
                  <div className="flex gap-px flex-wrap">
                    {Array.from({ length: 24 }, (_, h) => {
                      const isActive = stats.most_active_hours.includes(h)
                      return (
                        <div
                          key={h}
                          title={`${h}:00${isActive ? ' — активный' : ''}`}
                          className={[
                            'h-4 rounded-sm transition-colors',
                            isActive ? 'bg-amber-500 dark:bg-amber-400' : 'bg-gray-100 dark:bg-gray-700',
                          ].join(' ')}
                          style={{ width: 'calc((100% - 23px) / 24)' }}
                        />
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    <span>0:00</span>
                    <span>12:00</span>
                    <span>23:00</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Нет данных</p>
          )}
        </div>
      </div>

      {(stats.by_priority.length > 0 || stats.by_board.length > 0 || stats.by_tag.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <BreakdownBar title="По приоритету" items={stats.by_priority} />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <BreakdownBar title="По доскам" items={stats.by_board} />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <BreakdownBar title="По тегам" items={stats.by_tag} />
          </div>
        </div>
      )}

      {stats.habit_progress.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Прогресс привычек</h3>
          <div className="space-y-3">
            {stats.habit_progress.map((hp) => (
              <div key={hp.habit_id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{hp.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Стрик: {hp.current_streak} дн.</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-20 sm:w-32 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-green-500 dark:bg-green-400 transition-all"
                      style={{ width: `${Math.min(hp.completion_rate * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-12 text-right">
                    {Math.round(hp.completion_rate * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
