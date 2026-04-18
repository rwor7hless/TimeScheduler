import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { statsApi } from '@/api/stats'
import { useAuth } from '@/context/AuthContext'
import type { Stats } from '@/types/stats'

/**
 * Fetches weekly stats for a specific Monday.
 *
 * Also prefetches the previous week's stats AFTER the user navigates at least once —
 * this makes ← navigation feel instant without wasting a request on every mount.
 */
export function useWeekStats(weekStart: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const hasNavigatedRef = useRef(false)

  const query = useQuery<Stats>({
    queryKey: ['stats', user?.user_id, 'week', weekStart],
    queryFn: () => statsApi.get({ weekStart }),
    enabled: !!user?.user_id && !!weekStart,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!user?.user_id || !weekStart || !query.data) return
    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true
      return
    }
    const prev = shiftMondayISO(weekStart, -7)
    qc.prefetchQuery({
      queryKey: ['stats', user.user_id, 'week', prev],
      queryFn: () => statsApi.get({ weekStart: prev }),
      staleTime: 60_000,
    })
  }, [weekStart, user?.user_id, query.data, qc])

  return query
}

export function shiftMondayISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function mondayOfTodayISO(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
