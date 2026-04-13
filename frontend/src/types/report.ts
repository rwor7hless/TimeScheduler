export type ReportStatus = 'pending' | 'done' | 'error'

export interface WeeklyReport {
  id: number
  user_id: number
  week_start: string   // YYYY-MM-DD (Monday)
  status: ReportStatus
  content: string | null
  error_msg: string | null
  created_at: string
  updated_at: string
}
