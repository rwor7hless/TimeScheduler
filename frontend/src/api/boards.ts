import api from './client'
import type { Board } from '@/types/board'

export const boardsApi = {
  list: () => api.get<Board[]>('/boards').then((r) => r.data),
  create: (name: string) => api.post<Board>('/boards', { name }).then((r) => r.data),
  update: (id: number, name: string) =>
    api.patch<Board>(`/boards/${id}`, { name }).then((r) => r.data),
  delete: (id: number) => api.delete(`/boards/${id}`),
}

