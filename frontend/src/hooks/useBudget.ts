import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  budgetApi,
  type TransactionCreate,
  type TransactionUpdate,
  type TransactionResponse,
  type PlannedPurchaseCreate,
  type PlannedPurchaseUpdate,
  type PlannedConvertRequest,
  type BudgetTagCreate,
  type BudgetTagUpdate,
  type AllocationUpsert,
  type BudgetCategoryCreate,
  type BudgetCategoryUpdate,
  type RecurringCreate,
  type RecurringUpdate,
  type HistoryQuery,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
      qc.invalidateQueries({ queryKey: ['budget-history'] })
    },
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation<
    TransactionResponse,
    unknown,
    { id: number; data: TransactionUpdate },
    { prevLists: [readonly unknown[], TransactionResponse[] | undefined][] }
  >({
    mutationFn: ({ id, data }) => budgetApi.updateTransaction(id, data),
    onMutate: async ({ id, data }) => {
      // Оптимистичный апдейт: во всех кешах ['transactions', ...] мутируем запись.
      await qc.cancelQueries({ queryKey: ['transactions'] })
      const prevLists = qc.getQueriesData<TransactionResponse[]>({ queryKey: ['transactions'] })
      for (const [key, list] of prevLists) {
        if (!list) continue
        qc.setQueryData<TransactionResponse[]>(key, (current) =>
          (current ?? []).map((t) => (t.id === id ? { ...t, ...(data as Partial<TransactionResponse>) } : t)),
        )
      }
      return { prevLists }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return
      for (const [key, list] of ctx.prevLists) {
        qc.setQueryData(key, list)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
      qc.invalidateQueries({ queryKey: ['budget-history'] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
      qc.invalidateQueries({ queryKey: ['budget-history'] })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useUpdatePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PlannedPurchaseUpdate }) => budgetApi.updatePlanned(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useDeletePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deletePlanned(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useConvertPlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PlannedConvertRequest }) => budgetApi.convertPlanned(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['planned'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
      qc.invalidateQueries({ queryKey: ['budget-history'] })
    },
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

export function useUpdateBudgetTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BudgetTagUpdate }) => budgetApi.updateTag(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgetTags'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['planned'] })
    },
  })
}

export function useDeleteBudgetTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgetTags'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['planned'] })
    },
  })
}

// ── Budget Categories ──────────────────────────────────────────────────────────

export function useBudgetCategories(includeArchived = false) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['budgetCategories', user?.user_id, includeArchived],
    queryFn: () => budgetApi.listCategories(includeArchived),
    enabled: !!user?.user_id,
  })
}

export function useCreateBudgetCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BudgetCategoryCreate) => budgetApi.createCategory(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgetCategories'] }),
  })
}

export function useUpdateBudgetCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BudgetCategoryUpdate }) => budgetApi.updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgetCategories'] }),
  })
}

export function useDeleteBudgetCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgetCategories'] }),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocations'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useDeleteAllocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteAllocation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocations'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function useBudgetSummary(year: number, month: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['budget-summary', user?.user_id, year, month],
    queryFn: () => budgetApi.getSummary(year, month),
    enabled: !!user?.user_id,
  })
}

// ── History ───────────────────────────────────────────────────────────────────

export function useBudgetHistory(query: HistoryQuery) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['budget-history', user?.user_id, query],
    queryFn: () => budgetApi.getHistory(query),
    enabled: !!user?.user_id,
  })
}

// ── Recurring ─────────────────────────────────────────────────────────────────

export function useRecurring() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['recurring', user?.user_id],
    queryFn: () => budgetApi.listRecurring(),
    enabled: !!user?.user_id,
  })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RecurringCreate) => budgetApi.createRecurring(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RecurringUpdate }) => budgetApi.updateRecurring(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteRecurring(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}
