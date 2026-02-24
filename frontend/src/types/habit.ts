export interface HabitLog {
  id: number
  habit_id: number
  date: string
  completed_at: string
}

export interface Habit {
  id: number
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  logs: HabitLog[]
}

export interface HabitCreate {
  name: string
  description?: string | null
  color?: string
}

export interface HabitUpdate {
  name?: string
  description?: string | null
  color?: string
  is_active?: boolean
}
