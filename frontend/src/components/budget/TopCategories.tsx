import clsx from 'clsx'
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from '@/types/budget'
import type { SummaryResponse, SummaryCategory } from '@/api/budget'

function getCat(id: string | null | undefined) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('ru-RU')
}

export default function TopCategories({
  summary,
  onPick,
}: {
  summary: SummaryResponse
  onPick?: (category: ExpenseCategoryId | null) => void
}) {
  const top: SummaryCategory[] = summary.by_category
    .filter((c) => c.spent > 0)
    .slice(0, 5)

  const maxSpent = Math.max(...top.map((c) => c.spent), 1)

  if (top.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Топ категорий</div>
        <div className="text-xs text-gray-400">{top.length} из {summary.by_category.filter((c) => c.spent > 0).length}</div>
      </div>
      <div className="space-y-2">
        {top.map((c) => {
          const cat = getCat(c.category)
          const barPct = (c.spent / maxSpent) * 100
          const overBudget = c.allocated > 0 && c.spent > c.allocated
          return (
            <button
              key={c.category ?? 'none'}
              type="button"
              onClick={() => onPick?.(c.category as ExpenseCategoryId | null)}
              className="w-full group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: cat.color + '22' }}
              >
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{cat.label}</span>
                  <span className={clsx('text-sm font-semibold tabular-nums', overBudget ? 'text-red-500' : 'text-gray-800 dark:text-gray-100')}>
                    {fmt(c.spent)} ₽
                  </span>
                </div>
                <div className="mt-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barPct}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
                <div className="mt-0.5 flex justify-between text-[10px] text-gray-400">
                  {c.allocated > 0 ? (
                    <>
                      <span>{Math.round(c.pct)}% от лимита {fmt(c.allocated)} ₽</span>
                      <span>{c.remaining >= 0 ? `осталось ${fmt(c.remaining)} ₽` : `−${fmt(Math.abs(c.remaining))} ₽`}</span>
                    </>
                  ) : (
                    <span>без лимита</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
