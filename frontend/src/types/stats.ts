export interface HabitProgress {
  habit_id: number
  name: string
  completion_rate: number
  current_streak: number
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
}
