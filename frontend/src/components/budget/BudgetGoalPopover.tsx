import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useBudgetGoal, effectiveDailyBudget } from '@/hooks/useBudgetGoal'

interface Props {
  daysTotal: number
  allocationsDailyBudget: number
  anchor: 'right' | 'left'
}

function fmt(n: number) { return Math.round(n).toLocaleString('ru-RU') }

export default function BudgetGoalPopover({ daysTotal, allocationsDailyBudget, anchor }: Props) {
  const [goal, setGoal] = useBudgetGoal()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const effective = effectiveDailyBudget(goal, daysTotal, allocationsDailyBudget)

  const label = goal.enabled && goal.expectedIncome > 0
    ? `откладывать ${Math.round(goal.savingsRate)}% · ${fmt(effective)} ₽/день`
    : allocationsDailyBudget > 0
      ? `бюджет ${fmt(allocationsDailyBudget)} ₽/день`
      : 'настроить бюджет'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline decoration-dotted underline-offset-2 transition-colors"
      >
        {label}
      </button>
      {open && (
        <div
          className={clsx(
            'absolute top-full mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 z-30 space-y-3',
            anchor === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
              Считать от цели накоплений
            </label>
            <button
              type="button"
              onClick={() => setGoal({ ...goal, enabled: !goal.enabled })}
              aria-pressed={goal.enabled}
              className={clsx(
                'w-9 h-5 rounded-full transition-colors flex-shrink-0',
                goal.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
              )}
            >
              <span
                className={clsx(
                  'block w-4 h-4 rounded-full bg-white shadow transform transition-transform',
                  goal.enabled ? 'translate-x-[18px]' : 'translate-x-[2px]',
                )}
              />
            </button>
          </div>

          <div className={clsx('space-y-2', !goal.enabled && 'opacity-50 pointer-events-none select-none')}>
            <label className="block">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Ожидаемый доход, ₽ / мес</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={goal.expectedIncome || ''}
                onChange={(e) => setGoal({ ...goal, expectedIncome: parseFloat(e.target.value) || 0 })}
                placeholder="100 000"
                className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 tabular-nums"
              />
            </label>
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Откладывать</span>
                <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{Math.round(goal.savingsRate)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={goal.savingsRate}
                onChange={(e) => setGoal({ ...goal, savingsRate: parseInt(e.target.value) || 0 })}
                className="mt-1 w-full accent-blue-500"
              />
            </label>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            <div>
              Дневной бюджет:{' '}
              <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{fmt(effective)} ₽</span>
            </div>
            {goal.enabled && goal.expectedIncome > 0 ? (
              <div className="text-[11px] text-gray-400">
                ({fmt(goal.expectedIncome)} × {100 - Math.round(goal.savingsRate)}%) / {daysTotal} дн
              </div>
            ) : (
              <div className="text-[11px] text-gray-400">
                из суммы лимитов категорий / {daysTotal} дн
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
