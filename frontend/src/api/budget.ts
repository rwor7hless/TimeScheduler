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

export interface BudgetTagUpdate {
  name?: string
  color?: string
}

export interface BudgetCategoryResponse {
  id: number
  key: string
  label: string
  icon: string
  color: string
  sort_order: number
  is_archived: boolean
}

export interface BudgetCategoryCreate {
  key?: string
  label: string
  icon?: string
  color?: string
  sort_order?: number
}

export interface BudgetCategoryUpdate {
  label?: string
  icon?: string
  color?: string
  sort_order?: number
  is_archived?: boolean
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
  source_planned_id?: number | null
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
  tags: BudgetTagResponse[]
  source_recurring_id?: number | null
}

export interface PlannedPurchaseCreate {
  year: number
  month: number
  amount: number
  category: ExpenseCategoryId | null
  description: string
  done?: boolean
  tag_ids?: number[]
}

export interface PlannedPurchaseUpdate {
  amount?: number
  category?: ExpenseCategoryId | null
  description?: string
  done?: boolean
  tag_ids?: number[]
}

export interface PlannedConvertRequest {
  amount?: number
  date?: string
  tag_ids?: number[]
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

export interface RecurringResponse {
  id: number
  type: 'expense' | 'income'
  amount: number
  category: string | null
  description: string
  tag_ids: number[]
  day_of_month: number
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  is_paused: boolean
  created_at: string
}

export interface RecurringCreate {
  type: 'expense' | 'income'
  amount: number
  category?: string | null
  description?: string
  tag_ids?: number[]
  day_of_month: number
  start_date: string
  end_date?: string | null
  is_paused?: boolean
}

export interface RecurringUpdate {
  type?: 'expense' | 'income'
  amount?: number
  category?: string | null
  description?: string
  tag_ids?: number[]
  day_of_month?: number
  start_date?: string
  end_date?: string | null
  is_paused?: boolean
}

// ── Summary types ─────────────────────────────────────────────────────────────

export interface SummaryTotals {
  income: number
  expense: number
  balance: number
  planned_pending: number
  planned_done: number
}

export interface SummaryCategory {
  category: string | null
  allocated: number
  spent: number
  planned_pending: number
  remaining: number
  pct: number
}

export interface SummaryDay {
  date: string
  expense: number
  income: number
}

export interface SummaryTrend {
  prev_expense: number
  delta_abs: number
  delta_pct: number | null
}

export interface SummaryProjection {
  days_passed: number
  days_total: number
  days_left: number
  rate_per_day: number
  projected_total: number
  daily_budget: number
}

export interface SummaryResponse {
  year: number
  month: number
  totals: SummaryTotals
  by_category: SummaryCategory[]
  daily: SummaryDay[]
  trend: SummaryTrend
  projection: SummaryProjection
}

// ── History types ─────────────────────────────────────────────────────────────

export interface HistoryQuery {
  q?: string
  type?: 'expense' | 'income'
  tag_ids?: number[]
  category?: string
  from?: string
  to?: string
  amount_min?: number
  amount_max?: number
  sort?: 'date' | 'amount'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface HistoryResponse {
  items: TransactionResponse[]
  total: number
  offset: number
  limit: number
}

export const budgetApi = {
  // Tags
  listTags: () =>
    api.get<BudgetTagResponse[]>('/budget/tags').then((r) => r.data),

  createTag: (data: BudgetTagCreate) =>
    api.post<BudgetTagResponse>('/budget/tags', data).then((r) => r.data),

  updateTag: (id: number, data: BudgetTagUpdate) =>
    api.put<BudgetTagResponse>(`/budget/tags/${id}`, data).then((r) => r.data),

  deleteTag: (id: number) =>
    api.delete(`/budget/tags/${id}`),

  // Categories
  listCategories: (includeArchived = false) =>
    api
      .get<BudgetCategoryResponse[]>('/budget/categories', { params: { include_archived: includeArchived } })
      .then((r) => r.data),

  createCategory: (data: BudgetCategoryCreate) =>
    api.post<BudgetCategoryResponse>('/budget/categories', data).then((r) => r.data),

  updateCategory: (id: number, data: BudgetCategoryUpdate) =>
    api.put<BudgetCategoryResponse>(`/budget/categories/${id}`, data).then((r) => r.data),

  deleteCategory: (id: number) =>
    api.delete(`/budget/categories/${id}`),

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

  convertPlanned: (id: number, data: PlannedConvertRequest) =>
    api.post<TransactionResponse>(`/budget/planned/${id}/convert`, data).then((r) => r.data),

  // Recurring
  listRecurring: () =>
    api.get<RecurringResponse[]>('/budget/recurring').then((r) => r.data),

  createRecurring: (data: RecurringCreate) =>
    api.post<RecurringResponse>('/budget/recurring', data).then((r) => r.data),

  updateRecurring: (id: number, data: RecurringUpdate) =>
    api.put<RecurringResponse>(`/budget/recurring/${id}`, data).then((r) => r.data),

  deleteRecurring: (id: number) =>
    api.delete(`/budget/recurring/${id}`),

  // Summary / History
  getSummary: (year: number, month: number) =>
    api.get<SummaryResponse>('/budget/summary', { params: { year, month } }).then((r) => r.data),

  getHistory: (q: HistoryQuery = {}) =>
    api.get<HistoryResponse>('/budget/history', { params: q }).then((r) => r.data),

  exportUrl: (q: { year?: number; month?: number; from?: string; to?: string; type?: 'expense' | 'income' } = {}) => {
    const params = new URLSearchParams()
    Object.entries(q).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.set(k, String(v))
    })
    const qs = params.toString()
    return `/api/budget/export${qs ? '?' + qs : ''}`
  },

  downloadCsv: async (q: { year?: number; month?: number; from?: string; to?: string; type?: 'expense' | 'income' } = {}) => {
    const response = await api.get('/budget/export', { params: q, responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const disposition = response.headers['content-disposition'] as string | undefined
    const match = disposition && /filename="?([^"]+)"?/.exec(disposition)
    link.download = match ? match[1] : 'budget.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}
