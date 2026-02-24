import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/api/stats'
import { useAuth } from '@/context/AuthContext'

export function useStats(period: 'week' | 'month' | 'year' = 'month') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['stats', user?.user_id, period],
    queryFn: () => statsApi.get(period),
    enabled: !!user?.user_id,
  })
}
