export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type KanbanStatus = 'todo' | 'in_progress' | 'done'

export interface Tag {
  id: number
  name: string
  color: string
}

export const TASK_COLOR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

export interface Task {
  id: number
  title: string
  color: string
  description: string | null
  priority: Priority
  status: KanbanStatus
  kanban_order: number
  scheduled_start: string | null
  scheduled_end: string | null
  deadline: string | null
  repeat_days: number[] | null  // 0=Mon..6=Sun
  completed_at: string | null
  created_at: string
  updated_at: string
  tags: Tag[]
  board_id: number | null
  is_archived: boolean
  tg_remind: boolean
  tg_remind_at: string | null
  tg_reminded: boolean
}

export interface TaskCreate {
  title: string
  description?: string | null
  color?: string | null
  priority?: Priority
  status?: KanbanStatus
  scheduled_start?: string | null
  scheduled_end?: string | null
  deadline?: string | null
  repeat_days?: number[]
  tag_ids?: number[]
  board_id?: number | null
  tg_remind?: boolean
  tg_remind_at?: string | null
}

export interface TaskUpdate {
  title?: string
  description?: string | null
  color?: string | null
  priority?: Priority
  status?: KanbanStatus
  scheduled_start?: string | null
  scheduled_end?: string | null
  deadline?: string | null
  repeat_days?: number[] | null
  tag_ids?: number[]
  board_id?: number | null
  tg_remind?: boolean | null
  tg_remind_at?: string | null
}

export const WEEKDAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const

export interface KanbanReorder {
  status: KanbanStatus
  ordered_ids: number[]
}

export interface TagCreate {
  name: string
  color?: string
}
