import api from './client'
import type { Habit, HabitCreate, HabitUpdate, HabitLog } from '@/types/habit'

export const habitsApi = {
  list: () =>
    api.get<Habit[]>('/habits').then((r) => r.data),

  create: (data: HabitCreate) =>
    api.post<Habit>('/habits', data).then((r) => r.data),

  update: (id: number, data: HabitUpdate) =>
    api.put<Habit>(`/habits/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/habits/${id}`),

  toggleLog: (id: number, date: string) =>
    api.post<HabitLog | null>(`/habits/${id}/log`, { date }),

  getLogs: (id: number, fromDate?: string, toDate?: string) =>
    api.get<HabitLog[]>(`/habits/${id}/logs`, {
      params: { from_date: fromDate, to_date: toDate },
    }).then((r) => r.data),
}
