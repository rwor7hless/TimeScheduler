import api from './client'
import type {
  BoardGroup,
  BoardGroupCreate,
  BoardGroupReorder,
  BoardGroupUpdate,
} from '@/types/boardGroup'

export const boardGroupsApi = {
  list: () => api.get<BoardGroup[]>('/board-groups').then((r) => r.data),
  create: (data: BoardGroupCreate) =>
    api.post<BoardGroup>('/board-groups', data).then((r) => r.data),
  update: (id: number, data: BoardGroupUpdate) =>
    api.patch<BoardGroup>(`/board-groups/${id}`, data).then((r) => r.data),
  delete: (id: number, cascade: boolean) =>
    api.delete(`/board-groups/${id}`, { params: { cascade } }),
  reorder: (data: BoardGroupReorder) =>
    api.patch('/board-groups/reorder', data),
}
