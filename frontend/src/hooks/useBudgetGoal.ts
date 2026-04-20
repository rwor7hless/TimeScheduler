import { useEffect, useState } from 'react'

export interface BudgetGoal {
  enabled: boolean
  expectedIncome: number   // ₽ per month
  savingsRate: number      // 0-100
}

export const DEFAULT_BUDGET_GOAL: BudgetGoal = {
  enabled: false,
  expectedIncome: 0,
  savingsRate: 20,
}

const STORAGE_KEY = 'budget.goal'

function read(): BudgetGoal {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BUDGET_GOAL
    const parsed = JSON.parse(raw) as Partial<BudgetGoal>
    return {
      enabled: !!parsed.enabled,
      expectedIncome: Number(parsed.expectedIncome) || 0,
      savingsRate: Math.max(0, Math.min(100, Number(parsed.savingsRate) || 0)),
    }
  } catch {
    return DEFAULT_BUDGET_GOAL
  }
}

export function useBudgetGoal() {
  const [goal, setGoalState] = useState<BudgetGoal>(read)

  const setGoal = (next: BudgetGoal) => {
    const clean: BudgetGoal = {
      enabled: !!next.enabled,
      expectedIncome: Math.max(0, Number(next.expectedIncome) || 0),
      savingsRate: Math.max(0, Math.min(100, Number(next.savingsRate) || 0)),
    }
    setGoalState(clean)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)) } catch { /* ignore */ }
  }

  // Sync across tabs / windows
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      setGoalState(read())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return [goal, setGoal] as const
}

/**
 * Effective daily budget — based on savings goal if enabled, otherwise the
 * "sum of allocations / days" fallback that comes from the backend summary.
 */
export function effectiveDailyBudget(
  goal: BudgetGoal,
  daysTotal: number,
  fallback: number,
): number {
  if (!goal.enabled || goal.expectedIncome <= 0 || daysTotal <= 0) return fallback
  const monthly = goal.expectedIncome * (1 - goal.savingsRate / 100)
  return monthly / daysTotal
}
