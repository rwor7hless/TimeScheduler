export type TransactionType = 'expense' | 'income'

/**
 * Поле `icon` — семантический id иконки из BudgetCategoryIcon (см.
 * components/ui/icons.tsx). Для встроенных категорий оно дублирует
 * `id`, для user-created в БД может быть любой строкой — компонент
 * iconвернёт IconBox как fallback.
 */
export const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Еда',           color: '#F59E0B', icon: 'food' },
  { id: 'transport',     label: 'Транспорт',     color: '#3B82F6', icon: 'transport' },
  { id: 'housing',       label: 'Жильё',         color: '#8B5CF6', icon: 'housing' },
  { id: 'health',        label: 'Здоровье',      color: '#10B981', icon: 'health' },
  { id: 'entertainment', label: 'Развлечения',   color: '#F97316', icon: 'entertainment' },
  { id: 'clothing',      label: 'Одежда',        color: '#EC4899', icon: 'clothing' },
  { id: 'tech',          label: 'Техника',       color: '#06B6D4', icon: 'tech' },
  { id: 'education',     label: 'Образование',   color: '#84CC16', icon: 'education' },
  { id: 'travel',        label: 'Путешествия',   color: '#EF4444', icon: 'travel' },
  { id: 'subscriptions', label: 'Подписки',      color: '#6366F1', icon: 'subscriptions' },
  { id: 'other',         label: 'Прочее',        color: '#9CA3AF', icon: 'other' },
] as const

export type ExpenseCategoryId = typeof EXPENSE_CATEGORIES[number]['id']
