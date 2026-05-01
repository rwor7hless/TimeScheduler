import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, tagsApi } from '@/api/tasks'
import { boardsApi } from '@/api/boards'
import type { Board } from '@/types/board'
import type { BoardReorder } from '@/types/boardGroup'
import { useAuth } from '@/context/AuthContext'
import type { Task, TaskCreate, TaskUpdate, ReorderPayload, TagCreate } from '@/types/task'

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
    mutationFn: (data: { name: string; group_id?: number | null }) => boardsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useUpdateBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: { name?: string; group_id?: number | null; sort_order?: number }
    }) => boardsApi.update(id, data),
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

export function useReorderBoards() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BoardReorder) => boardsApi.reorder(data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: ['boards'] })
      const snapshots = qc.getQueriesData<Board[]>({ queryKey: ['boards'] })
      const ord = new Map(data.ordered_ids.map((id, i) => [id, i]))
      for (const [key, list] of snapshots) {
        if (!list) continue
        const next = list.map((b) =>
          b.group_id === data.group_id && ord.has(b.id)
            ? { ...b, sort_order: ord.get(b.id)! }
            : b,
        )
        qc.setQueryData<Board[]>(key, next)
      }
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, list] of ctx.snapshots) {
          qc.setQueryData(key, list)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['boards'] })
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
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: ['tasks'] })

      // Snapshot previous values — array caches only; single-task caches
      // are kept out of the optimistic update.
      const previousQueries = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })

      // Optimistically update list queries only. The `queryKey: ['tasks']`
      // prefix also matches single-task caches (['tasks', userId, id]) whose
      // data is a Task object, not a Task[] — mapping over it would throw
      // and wipe the cache, making rows visually vanish on status change.
      qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map((task) => {
          if (task.id === id) {
            return { ...task, ...data } as Task
          }
          // Also update subtasks
          if (task.subtasks?.length) {
            return {
              ...task,
              subtasks: task.subtasks.map((sub) =>
                sub.id === id ? { ...sub, ...data } as Task : sub
              ),
            }
          }
          return task
        })
      })

      return { previousQueries }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          qc.setQueryData(queryKey, data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previousQueries = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })

      qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old
          .filter((task) => task.id !== id)
          .map((task) => ({
            ...task,
            subtasks: task.subtasks?.filter((sub) => sub.id !== id) ?? [],
          }))
      })

      return { previousQueries }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          qc.setQueryData(queryKey, data)
        }
      }
    },
    onSettled: () => {
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
    mutationFn: (data: ReorderPayload) => tasksApi.reorder(data),
    onMutate: async ({ ordered_ids }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })
      const positionById = new Map<number, number>()
      ordered_ids.forEach((id, idx) => positionById.set(id, idx))
      qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map((task) =>
          positionById.has(task.id)
            ? ({ ...task, position: positionById.get(task.id)! } as Task)
            : task,
        )
      })
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previous) return
      for (const [key, data] of ctx.previous) {
        qc.setQueryData(key, data)
      }
    },
    onSettled: () => {
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
