import api from './client'
import type { Stats } from '@/types/stats'

export type StatsPeriod = 'week' | 'month' | 'year'

interface StatsQuery {
  period?: StatsPeriod
  /** YYYY-MM-DD (Monday). When set, the backend returns fixed-week metrics
   *  + previous_period_metrics for delta badges. `period` is ignored. */
  weekStart?: string
}

export const statsApi = {
  get: ({ period = 'month', weekStart }: StatsQuery = {}) =>
    api
      .get<Stats>('/stats', {
        params: weekStart ? { week_start: weekStart } : { period },
      })
      .then((r) => r.data),
}
