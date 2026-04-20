import clsx from 'clsx'
import { useBudgetGoal, effectiveDailyBudget } from '@/hooks/useBudgetGoal'
import type { SummaryResponse } from '@/api/budget'

function fmt(n: number) {
  return Math.round(n).toLocaleString('ru-RU')
}

function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

export default function PulseStrip({ summary }: { summary: SummaryResponse }) {
  const { projection, trend, totals } = summary
  const [goal] = useBudgetGoal()

  const dailyBudget = effectiveDailyBudget(goal, projection.days_total, projection.daily_budget)
  const rateVsBudget = dailyBudget > 0 ? projection.rate_per_day / dailyBudget : 0
  const rateColor =
    rateVsBudget === 0 ? 'text-gray-600 dark:text-gray-300' :
    rateVsBudget < 0.9 ? 'text-emerald-600 dark:text-emerald-400' :
    rateVsBudget < 1.1 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-500 dark:text-red-400'

  const totalBudget = dailyBudget * projection.days_total
  const projectedDelta = totalBudget > 0 ? projection.projected_total - totalBudget : 0
  const projectionColor =
    totalBudget === 0 ? 'text-gray-600 dark:text-gray-300' :
    projectedDelta <= 0 ? 'text-emerald-600 dark:text-emerald-400' :
    projectedDelta < totalBudget * 0.1 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-500 dark:text-red-400'

  const trendColor =
    trend.delta_pct === null ? 'text-gray-600 dark:text-gray-300' :
    trend.delta_abs <= 0 ? 'text-emerald-600 dark:text-emerald-400' :
    'text-red-500 dark:text-red-400'

  const trendArrow = trend.delta_pct === null ? '·' :
    trend.delta_abs < 0 ? '↓' : trend.delta_abs > 0 ? '↑' : '·'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Days progress */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">Месяц</div>
        <div className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
          {projection.days_passed} / {projection.days_total}
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          осталось <span className="font-medium">{projection.days_left}</span> {pluralDays(projection.days_left)}
        </div>
        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-400 transition-all"
            style={{ width: `${projection.days_total > 0 ? (projection.days_passed / projection.days_total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Rate per day */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-gray-400">Темп</div>
          {goal.enabled && goal.expectedIncome > 0 && (
            <span className="text-[10px] text-blue-500 dark:text-blue-400" title="Бюджет по цели накоплений">
              цель {Math.round(goal.savingsRate)}%
            </span>
          )}
        </div>
        <div className={clsx('mt-1 text-xl font-bold tabular-nums', rateColor)}>
          {fmt(projection.rate_per_day)} ₽
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {dailyBudget > 0 ? (
            <>
              бюджет <span className="font-medium">{fmt(dailyBudget)} ₽/день</span>
            </>
          ) : (
            'в день (без лимитов)'
          )}
        </div>
        {dailyBudget > 0 && (
          <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full transition-all',
                rateVsBudget < 0.9 ? 'bg-emerald-400' :
                rateVsBudget < 1.1 ? 'bg-amber-400' : 'bg-red-400'
              )}
              style={{ width: `${Math.min(rateVsBudget * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Projection */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">Прогноз</div>
        <div className={clsx('mt-1 text-xl font-bold tabular-nums', projectionColor)}>
          {fmt(projection.projected_total)} ₽
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {totalBudget > 0 ? (
            projectedDelta > 0 ? (
              <>перерасход <span className="font-medium">+{fmt(projectedDelta)} ₽</span></>
            ) : (
              <>запас <span className="font-medium">{fmt(Math.abs(projectedDelta))} ₽</span></>
            )
          ) : (
            `по ${fmt(projection.rate_per_day)} ₽/день до конца`
          )}
        </div>
        <div className="mt-2 text-[10px] text-gray-400">
          сейчас {fmt(totals.expense)} ₽
        </div>
      </div>

      {/* Trend vs prev month */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">К прошлому месяцу</div>
        <div className={clsx('mt-1 text-xl font-bold tabular-nums flex items-baseline gap-1', trendColor)}>
          <span>{trendArrow}</span>
          <span>
            {trend.delta_pct === null
              ? '—'
              : `${trend.delta_pct > 0 ? '+' : ''}${Math.round(trend.delta_pct)}%`}
          </span>
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          было <span className="font-medium">{fmt(trend.prev_expense)} ₽</span>
        </div>
        <div className="mt-2 text-[10px] text-gray-400">
          {trend.delta_abs === 0
            ? 'разницы нет'
            : trend.delta_abs > 0
              ? `+${fmt(trend.delta_abs)} ₽`
              : `−${fmt(Math.abs(trend.delta_abs))} ₽`}
        </div>
      </div>
    </div>
  )
}
