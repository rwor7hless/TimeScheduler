import api from './client'
import type { ExpenseCategoryId } from '@/types/budget'

export interface BudgetTagResponse {
  id: number
  name: string
  color: string
}

export interface BudgetTagCreate {
  name: string
  color?: string
}

export interface TransactionResponse {
  id: number
  type: 'expense' | 'income'
  amount: number
  category: ExpenseCategoryId | null
  description: string
  date: string
  created_at: string
  tags: BudgetTagResponse[]
}

export interface TransactionCreate {
  type: 'expense' | 'income'
  amount: number
  category: ExpenseCategoryId | null
  description: string
  date: string
  tag_ids?: number[]
}

export interface TransactionUpdate {
  type?: 'expense' | 'income'
  amount?: number
  category?: ExpenseCategoryId | null
  description?: string
  date?: string
  tag_ids?: number[]
}

export interface PlannedPurchaseResponse {
  id: number
  year: number
  month: number
  amount: number
  category: ExpenseCategoryId | null
  description: string
  done: boolean
  created_at: string
}

export interface PlannedPurchaseCreate {
  year: number
  month: number
  amount: number
  category: ExpenseCategoryId | null
  description: string
  done?: boolean
}

export interface PlannedPurchaseUpdate {
  amount?: number
  category?: ExpenseCategoryId | null
  description?: string
  done?: boolean
}

export interface AllocationResponse {
  id: number
  year: number
  month: number
  category: string
  limit_amount: number
  created_at: string
}

export interface AllocationUpsert {
  year: number
  month: number
  category: string
  limit_amount: number
}

export const budgetApi = {
  // Tags
  listTags: () =>
    api.get<BudgetTagResponse[]>('/budget/tags').then((r) => r.data),

  createTag: (data: BudgetTagCreate) =>
    api.post<BudgetTagResponse>('/budget/tags', data).then((r) => r.data),

  deleteTag: (id: number) =>
    api.delete(`/budget/tags/${id}`),

  // Allocations
  listAllocations: (year: number, month: number) =>
    api.get<AllocationResponse[]>('/budget/allocations', { params: { year, month } }).then((r) => r.data),

  upsertAllocation: (data: AllocationUpsert) =>
    api.post<AllocationResponse>('/budget/allocations', data).then((r) => r.data),

  deleteAllocation: (id: number) =>
    api.delete(`/budget/allocations/${id}`),

  // Transactions
  listTransactions: (year?: number, month?: number) =>
    api.get<TransactionResponse[]>('/budget/transactions', { params: { year, month } }).then((r) => r.data),

  createTransaction: (data: TransactionCreate) =>
    api.post<TransactionResponse>('/budget/transactions', data).then((r) => r.data),

  updateTransaction: (id: number, data: TransactionUpdate) =>
    api.put<TransactionResponse>(`/budget/transactions/${id}`, data).then((r) => r.data),

  deleteTransaction: (id: number) =>
    api.delete(`/budget/transactions/${id}`),

  // Planned
  listPlanned: (year?: number, month?: number) =>
    api.get<PlannedPurchaseResponse[]>('/budget/planned', { params: { year, month } }).then((r) => r.data),

  createPlanned: (data: PlannedPurchaseCreate) =>
    api.post<PlannedPurchaseResponse>('/budget/planned', data).then((r) => r.data),

  updatePlanned: (id: number, data: PlannedPurchaseUpdate) =>
    api.put<PlannedPurchaseResponse>(`/budget/planned/${id}`, data).then((r) => r.data),

  deletePlanned: (id: number) =>
    api.delete(`/budget/planned/${id}`),
}
