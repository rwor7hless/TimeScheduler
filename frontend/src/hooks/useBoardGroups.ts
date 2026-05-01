import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { boardGroupsApi } from '@/api/boardGroups'
import type { BoardGroup, BoardGroupCreate, BoardGroupUpdate } from '@/types/boardGroup'

const KEY = ['board-groups'] as const

export function useBoardGroups() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => boardGroupsApi.list(),
    staleTime: 30_000,
  })
}

export function useCreateBoardGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BoardGroupCreate) => boardGroupsApi.create(data),
    onSuccess: (g) => {
      qc.setQueryData<BoardGroup[]>(KEY, (prev) => (prev ? [...prev, g] : [g]))
    },
  })
}

export function useRenameBoardGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BoardGroupUpdate }) =>
      boardGroupsApi.update(id, data),
    onSuccess: (g) => {
      qc.setQueryData<BoardGroup[]>(KEY, (prev) =>
        prev ? prev.map((x) => (x.id === g.id ? g : x)) : [g],
      )
    },
  })
}

export function useDeleteBoardGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cascade }: { id: number; cascade: boolean }) =>
      boardGroupsApi.delete(id, cascade),
    onSuccess: (_, { id }) => {
      qc.setQueryData<BoardGroup[]>(KEY, (prev) =>
        prev ? prev.filter((x) => x.id !== id) : [],
      )
      // Boards may have detached or been cascade-deleted; refresh.
      qc.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useReorderBoardGroups() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ordered_ids: number[]) =>
      boardGroupsApi.reorder({ ordered_ids }),
    onMutate: async (ordered_ids) => {
      await qc.cancelQueries({ queryKey: KEY })
      const previous = qc.getQueryData<BoardGroup[]>(KEY)
      if (previous) {
        const byId = new Map(previous.map((g) => [g.id, g]))
        const next = ordered_ids
          .map((id, idx) => {
            const g = byId.get(id)
            return g ? { ...g, sort_order: idx } : null
          })
          .filter((g): g is BoardGroup => g !== null)
        qc.setQueryData<BoardGroup[]>(KEY, next)
      }
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}
