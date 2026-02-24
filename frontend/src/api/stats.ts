import api from './client'
import type { Stats } from '@/types/stats'

export const statsApi = {
  get: (period: 'week' | 'month' | 'year' = 'month') =>
    api.get<Stats>('/stats', { params: { period } }).then((r) => r.data),
}
