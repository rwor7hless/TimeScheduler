import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTheme } from '@/context/ThemeContext'
import { useBudgetGoal, effectiveDailyBudget } from '@/hooks/useBudgetGoal'
import BudgetGoalPopover from '@/components/budget/BudgetGoalPopover'
import type { SummaryResponse } from '@/api/budget'

function fmt(n: number) {
  return Math.round(n).toLocaleString('ru-RU')
}

export default function DailySpendChart({ summary }: { summary: SummaryResponse }) {
  const { isDark, colors } = useTheme()
  const [goal] = useBudgetGoal()

  const data = useMemo(() => {
    return summary.daily.map((d) => {
      const day = Number(d.date.slice(-2))
      return {
        day,
        date: d.date,
        expense: d.expense,
        income: d.income,
      }
    })
  }, [summary.daily])

  const allocationsDailyBudget = summary.projection.daily_budget
  const dailyBudget = effectiveDailyBudget(goal, summary.projection.days_total, allocationsDailyBudget)
  const maxExpense = Math.max(...data.map((d) => d.expense), dailyBudget)

  const gridColor = isDark ? '#374151' : '#E5E7EB'
  const textColor = isDark ? '#9CA3AF' : '#6B7280'
  const totalExpense = data.reduce((s, d) => s + d.expense, 0)

  if (totalExpense === 0 && dailyBudget === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Траты по дням
        </div>
        <div className="text-xs text-gray-400 text-center py-8">
          Ещё нет трат в этом месяце.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Траты по дням</div>
        <BudgetGoalPopover
          daysTotal={summary.projection.days_total}
          allocationsDailyBudget={allocationsDailyBudget}
          anchor="right"
        />
      </div>
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: textColor }}
              interval={2}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: textColor }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                borderColor: gridColor,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: isDark ? '#F3F4F6' : '#111827' }}
              formatter={(v: number) => [`${fmt(v)} ₽`, 'Траты']}
              labelFormatter={(_label, payload) => {
                const p = payload && payload[0]
                if (!p) return ''
                const date = (p.payload as { date: string }).date
                return format(parseISO(date), 'd MMMM', { locale: ru })
              }}
            />
            {dailyBudget > 0 && (
              <ReferenceLine
                y={dailyBudget}
                stroke={isDark ? colors.accentLight : colors.accent}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Bar dataKey="expense" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    dailyBudget > 0 && d.expense > dailyBudget
                      ? (isDark ? '#F87171' : '#EF4444')
                      : (isDark ? '#60A5FA' : '#3B82F6')
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {maxExpense === 0 && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          Ещё нет трат в этом месяце.
        </div>
      )}
    </div>
  )
}
