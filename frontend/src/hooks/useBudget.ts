import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  budgetApi,
  type TransactionCreate,
  type TransactionUpdate,
  type PlannedPurchaseCreate,
  type PlannedPurchaseUpdate,
  type BudgetTagCreate,
  type AllocationUpsert,
} from '@/api/budget'
import { useAuth } from '@/context/AuthContext'

export function useTransactions(year?: number, month?: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', user?.user_id, year, month],
    queryFn: () => budgetApi.listTransactions(year, month),
    enabled: !!user?.user_id,
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TransactionCreate) => budgetApi.createTransaction(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TransactionUpdate }) => budgetApi.updateTransaction(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteTransaction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

export function usePlannedPurchases(year: number, month: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['planned', user?.user_id, year, month],
    queryFn: () => budgetApi.listPlanned(year, month),
    enabled: !!user?.user_id,
  })
}

export function useCreatePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlannedPurchaseCreate) => budgetApi.createPlanned(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planned'] }),
  })
}

export function useUpdatePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PlannedPurchaseUpdate }) => budgetApi.updatePlanned(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planned'] }),
  })
}

export function useDeletePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deletePlanned(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planned'] }),
  })
}

// ── Budget Tags ────────────────────────────────────────────────────────────────

export function useBudgetTags() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['budgetTags', user?.user_id],
    queryFn: () => budgetApi.listTags(),
    enabled: !!user?.user_id,
  })
}

export function useCreateBudgetTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BudgetTagCreate) => budgetApi.createTag(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgetTags'] }),
  })
}

export function useDeleteBudgetTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgetTags'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

// ── Allocations ────────────────────────────────────────────────────────────────

export function useAllocations(year: number, month: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['allocations', user?.user_id, year, month],
    queryFn: () => budgetApi.listAllocations(year, month),
    enabled: !!user?.user_id,
  })
}

export function useUpsertAllocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AllocationUpsert) => budgetApi.upsertAllocation(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allocations'] }),
  })
}

export function useDeleteAllocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteAllocation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allocations'] }),
  })
}
