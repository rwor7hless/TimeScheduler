import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { habitsApi } from '@/api/habits'
import { useAuth } from '@/context/AuthContext'
import type { HabitCreate, HabitUpdate } from '@/types/habit'

export function useHabits() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['habits', user?.user_id],
    queryFn: () => habitsApi.list(),
    enabled: !!user?.user_id,
  })
}

export function useCreateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: HabitCreate) => habitsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useUpdateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: HabitUpdate }) => habitsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => habitsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useToggleHabitLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) => habitsApi.toggleLog(id, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
