import { PALETTE } from '@/lib/colors'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Tag {
  id: number
  name: string
  color: string
}

/** Задаче при создании достаётся случайный цвет из общей палитры данных. */
export const TASK_COLOR_PALETTE = PALETTE

export interface Task {
  id: number
  title: string
  color: string
  description: string | null
  priority: Priority
  done: boolean
  position: number
  scheduled_start: string | null
  scheduled_end: string | null
  deadline: string | null
  repeat_days: number[] | null  // 0=Mon..6=Sun
  completed_at: string | null
  created_at: string
  updated_at: string
  tags: Tag[]
  board_id: number | null
  parent_id: number | null
  is_archived: boolean
  tg_remind: boolean
  tg_remind_at: string | null
  tg_reminded: boolean
  my_day: boolean
  subtasks: Task[]
}

export interface TaskCreate {
  title: string
  description?: string | null
  color?: string | null
  priority?: Priority
  done?: boolean
  scheduled_start?: string | null
  scheduled_end?: string | null
  deadline?: string | null
  repeat_days?: number[]
  tag_ids?: number[]
  board_id?: number | null
  parent_id?: number | null
  tg_remind?: boolean
  tg_remind_at?: string | null
  my_day?: boolean
}

export interface TaskUpdate {
  title?: string
  description?: string | null
  color?: string | null
  priority?: Priority
  done?: boolean | null
  scheduled_start?: string | null
  scheduled_end?: string | null
  deadline?: string | null
  repeat_days?: number[] | null
  tag_ids?: number[]
  board_id?: number | null
  tg_remind?: boolean | null
  tg_remind_at?: string | null
  my_day?: boolean | null
}

export interface ReorderPayload {
  ordered_ids: number[]
}

export interface TagCreate {
  name: string
  color?: string
}

export const WEEKDAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const
