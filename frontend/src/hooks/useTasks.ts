import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, tagsApi } from '@/api/tasks'
import { boardsApi } from '@/api/boards'
import type { Board } from '@/types/board'
import { useAuth } from '@/context/AuthContext'
import type { TaskCreate, TaskUpdate, KanbanReorder, TagCreate } from '@/types/task'

export function useTasks(params?: Record<string, string>) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', user?.user_id, params],
    queryFn: () => tasksApi.list(params),
    enabled: !!user?.user_id,
  })
}

export function useBoards() {
  const { user } = useAuth()
  return useQuery<Board[]>({
    queryKey: ['boards', user?.user_id],
    queryFn: () => boardsApi.list(),
    enabled: !!user?.user_id,
  })
}

export function useCreateBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => boardsApi.create(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useDeleteBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => boardsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useTask(id: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', user?.user_id, id],
    queryFn: () => tasksApi.get(id),
    enabled: !!user?.user_id && id > 0,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TaskCreate) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskCreate }) => tasksApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function usePatchTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskUpdate }) => tasksApi.patch(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useArchivedTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', user?.user_id, 'archived'],
    queryFn: () => tasksApi.listArchived(),
    enabled: !!user?.user_id,
  })
}

export function useArchiveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useUnarchiveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.unarchive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: KanbanReorder) => tasksApi.reorder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useTags() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tags', user?.user_id],
    queryFn: () => tagsApi.list(),
    enabled: !!user?.user_id,
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TagCreate) => tagsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tagsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}
