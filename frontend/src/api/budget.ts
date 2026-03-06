import api from './client'
import type { ExpenseCategoryId } from '@/types/budget'

export interface TransactionResponse {
  id: number
  type: 'expense' | 'income'
  amount: number
  category: ExpenseCategoryId | null
  description: string
  date: string
  created_at: string
}

export interface TransactionCreate {
  type: 'expense' | 'income'
  amount: number
  category: ExpenseCategoryId | null
  description: string
  date: string
}

export interface TransactionUpdate {
  type?: 'expense' | 'income'
  amount?: number
  category?: ExpenseCategoryId | null
  description?: string
  date?: string
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

export const budgetApi = {
  listTransactions: (year?: number, month?: number) =>
    api.get<TransactionResponse[]>('/budget/transactions', { params: { year, month } }).then((r) => r.data),

  createTransaction: (data: TransactionCreate) =>
    api.post<TransactionResponse>('/budget/transactions', data).then((r) => r.data),

  updateTransaction: (id: number, data: TransactionUpdate) =>
    api.put<TransactionResponse>(`/budget/transactions/${id}`, data).then((r) => r.data),

  deleteTransaction: (id: number) =>
    api.delete(`/budget/transactions/${id}`),

  listPlanned: (year?: number, month?: number) =>
    api.get<PlannedPurchaseResponse[]>('/budget/planned', { params: { year, month } }).then((r) => r.data),

  createPlanned: (data: PlannedPurchaseCreate) =>
    api.post<PlannedPurchaseResponse>('/budget/planned', data).then((r) => r.data),

  updatePlanned: (id: number, data: PlannedPurchaseUpdate) =>
    api.put<PlannedPurchaseResponse>(`/budget/planned/${id}`, data).then((r) => r.data),

  deletePlanned: (id: number) =>
    api.delete(`/budget/planned/${id}`),
}
