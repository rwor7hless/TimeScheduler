import { useQuery } from '@tanstack/react-query'
import { statsApi, type StatsPeriod } from '@/api/stats'
import { useAuth } from '@/context/AuthContext'

export function useStats(period: StatsPeriod = 'month') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['stats', user?.user_id, 'period', period],
    queryFn: () => statsApi.get({ period }),
    enabled: !!user?.user_id,
  })
}
