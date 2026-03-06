import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  budgetApi,
  type TransactionCreate,
  type TransactionUpdate,
  type PlannedPurchaseCreate,
  type PlannedPurchaseUpdate,
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
