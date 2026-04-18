import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'
import { useAuth } from '@/context/AuthContext'
import type { WeeklyReport } from '@/types/report'

const LAST_SEEN_KEY = 'reports_last_seen'

export function useReports() {
  const { user } = useAuth()
  const query = useQuery<WeeklyReport[]>({
    queryKey: ['reports', user?.user_id],
    queryFn: () => reportsApi.list(),
    enabled: !!user?.user_id,
  })
  return query
}

/** Количество готовых отчётов, появившихся после последнего посещения страницы. */
export function useUnreadReportsCount(): number {
  const { data: reports } = useReports()
  if (!reports) return 0
  const lastSeen = localStorage.getItem(LAST_SEEN_KEY)
  return reports.filter(
    (r) => r.status === 'done' && (!lastSeen || r.updated_at > lastSeen),
  ).length
}

/** Вызвать при открытии страницы уведомлений — сбрасывает счётчик. */
export function markReportsSeen() {
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
}

export function useGenerateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (weekStart?: string) => reportsApi.generate(weekStart),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
