export interface HabitProgress {
  habit_id: number
  name: string
  completion_rate: number
  current_streak: number
  /** Chronological per-day completion flags for the requested window.
   *  Length 7 for week_start mode (Mon..Sun), period_days otherwise. */
  days: boolean[]
}

export interface DailyCompletion {
  date: string
  count: number
}

export interface BreakdownItem {
  label: string
  count: number
  color: string | null
}

export interface PreviousPeriodMetrics {
  completed_count: number
  productivity_percent: number | null
  active_days: number
  habits_done_pct: number | null
}

export interface Stats {
  active_tasks: number
  completed_last_month: number
  overdue_count: number
  avg_completion_hours: number | null
  productivity_percent: number | null
  most_active_hours: number[]
  habit_progress: HabitProgress[]
  daily_completions: DailyCompletion[]
  by_priority: BreakdownItem[]
  by_board: BreakdownItem[]
  by_tag: BreakdownItem[]
  /** Echoed from the server so the client trusts the server's Monday. */
  week_start: string | null
  previous_period_metrics: PreviousPeriodMetrics | null
}
