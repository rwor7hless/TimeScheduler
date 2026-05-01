import api from './client'
import type { Board } from '@/types/board'
import type { BoardReorder } from '@/types/boardGroup'

export const boardsApi = {
  list: () => api.get<Board[]>('/boards').then((r) => r.data),
  create: (data: { name: string; group_id?: number | null }) =>
    api.post<Board>('/boards', data).then((r) => r.data),
  update: (
    id: number,
    data: { name?: string; group_id?: number | null; sort_order?: number },
  ) => api.patch<Board>(`/boards/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/boards/${id}`),
  reorder: (data: BoardReorder) => api.patch('/boards/reorder', data),
}
