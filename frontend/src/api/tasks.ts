import api from './client'
import type { Task, TaskCreate, TaskUpdate, KanbanReorder, Tag, TagCreate } from '@/types/task'

export const tasksApi = {
  list: (params?: Record<string, string>) =>
    api.get<Task[]>('/tasks', { params }).then((r) => r.data),

  get: (id: number) =>
    api.get<Task>(`/tasks/${id}`).then((r) => r.data),

  create: (data: TaskCreate) =>
    api.post<Task>('/tasks', data).then((r) => r.data),

  update: (id: number, data: TaskCreate) =>
    api.put<Task>(`/tasks/${id}`, data).then((r) => r.data),

  patch: (id: number, data: TaskUpdate) =>
    api.patch<Task>(`/tasks/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/tasks/${id}`),

  reorder: (data: KanbanReorder) =>
    api.patch('/tasks/reorder', data),
}

export const tagsApi = {
  list: () =>
    api.get<Tag[]>('/tags').then((r) => r.data),

  create: (data: TagCreate) =>
    api.post<Tag>('/tags', data).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/tags/${id}`),
}
