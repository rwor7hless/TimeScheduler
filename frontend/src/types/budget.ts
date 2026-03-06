export type TransactionType = 'expense' | 'income'

export const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Еда',           color: '#F59E0B', icon: '🍔' },
  { id: 'transport',     label: 'Транспорт',     color: '#3B82F6', icon: '🚗' },
  { id: 'housing',       label: 'Жильё',         color: '#8B5CF6', icon: '🏠' },
  { id: 'health',        label: 'Здоровье',      color: '#10B981', icon: '💊' },
  { id: 'entertainment', label: 'Развлечения',   color: '#F97316', icon: '🎮' },
  { id: 'clothing',      label: 'Одежда',        color: '#EC4899', icon: '👗' },
  { id: 'tech',          label: 'Техника',       color: '#06B6D4', icon: '💻' },
  { id: 'education',     label: 'Образование',   color: '#84CC16', icon: '📚' },
  { id: 'travel',        label: 'Путешествия',   color: '#EF4444', icon: '✈️' },
  { id: 'subscriptions', label: 'Подписки',      color: '#6366F1', icon: '🔄' },
  { id: 'other',         label: 'Прочее',        color: '#9CA3AF', icon: '📦' },
] as const

export type ExpenseCategoryId = typeof EXPENSE_CATEGORIES[number]['id']

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: ExpenseCategoryId | null
  description: string
  date: string // yyyy-MM-dd
  createdAt: number
}

export interface PlannedPurchase {
  id: string
  amount: number
  category: ExpenseCategoryId | null
  description: string
  done: boolean
  createdAt: number
}

export interface BudgetMonth {
  year: number
  month: number // 0-based
  transactions: Transaction[]
  plannedPurchases: PlannedPurchase[]
}
