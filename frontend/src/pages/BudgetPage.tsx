import { useState, useMemo, useCallback } from 'react'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useTheme } from '@/context/ThemeContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategoryId,
  type Transaction,
  type PlannedPurchase,
  type BudgetMonth,
} from '@/types/budget'

// ─── LocalStorage helpers ───────────────────────────────────────────────────

const LS_KEY = 'budget_data'

function loadData(): BudgetMonth[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveData(data: BudgetMonth[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

function getOrCreateMonth(data: BudgetMonth[], year: number, month: number): BudgetMonth {
  return data.find(m => m.year === year && m.month === month) ?? {
    year, month, transactions: [], plannedPurchases: [],
  }
}

// ─── Category helpers ───────────────────────────────────────────────────────

function getCat(id: ExpenseCategoryId | null) {
  return EXPENSE_CATEGORIES.find(c => c.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'expenses' | 'income' | 'planned' | 'history'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'Обзор'       },
  { id: 'expenses',  label: 'Расходы'     },
  { id: 'income',    label: 'Доходы'      },
  { id: 'planned',   label: 'Планируемые' },
  { id: 'history',   label: 'История'     },
]

// ─── Small components ───────────────────────────────────────────────────────

function AmountBadge({ amount, type, dim }: { amount: number; type: 'expense' | 'income'; dim?: boolean }) {
  return (
    <span className={clsx(
      'font-semibold tabular-nums',
      dim ? 'text-yellow-600 dark:text-yellow-400' :
        type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
    )}>
      {type === 'income' ? '+' : '−'}{amount.toLocaleString('ru-RU')} ₽
    </span>
  )
}

function CategoryPill({ id }: { id: ExpenseCategoryId | null }) {
  const cat = getCat(id)
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: cat.color }}
    >
      {cat.icon} {cat.label}
    </span>
  )
}

// ─── Transaction card ───────────────────────────────────────────────────────

function TransactionCard({
  tx,
  dim,
  onDelete,
}: {
  tx: Transaction
  dim?: boolean
  onDelete: () => void
}) {
  return (
    <div className={clsx(
      'group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
      dim
        ? 'border-yellow-200 bg-yellow-50/60 dark:bg-yellow-900/10 dark:border-yellow-800/40'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    )}>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
        style={{ backgroundColor: getCat(tx.category).color + '22' }}
      >
        {getCat(tx.category).icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{tx.description || '—'}</span>
          {dim && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded-full">
              планируемое
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <CategoryPill id={tx.category} />
          <span className="text-xs text-gray-400 dark:text-gray-500">{format(parseISO(tx.date), 'd MMM', { locale: ru })}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <AmountBadge amount={tx.amount} type={tx.type} dim={dim} />
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Planned purchase card ──────────────────────────────────────────────────

function PlannedCard({
  item,
  onToggle,
  onDelete,
}: {
  item: PlannedPurchase
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className={clsx(
      'group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
      item.done
        ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-800/40 opacity-60'
        : 'border-yellow-200 bg-yellow-50/60 dark:bg-yellow-900/10 dark:border-yellow-800/40'
    )}>
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
          item.done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-yellow-400 text-transparent hover:border-yellow-500'
        )}
      >
        {item.done && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base"
        style={{ backgroundColor: getCat(item.category).color + '22' }}
      >
        {getCat(item.category).icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={clsx('font-medium text-sm text-gray-900 dark:text-gray-100 truncate', item.done && 'line-through text-gray-400')}>{item.description || '—'}</div>
        <CategoryPill id={item.category} />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-semibold tabular-nums text-yellow-600 dark:text-yellow-400">
          ~{item.amount.toLocaleString('ru-RU')} ₽
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Add transaction modal ──────────────────────────────────────────────────

function AddTransactionModal({
  isOpen,
  onClose,
  onAdd,
  defaultType,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void
  defaultType: 'expense' | 'income'
}) {
  const [type, setType] = useState<'expense' | 'income'>(defaultType)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ExpenseCategoryId>('other')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount.replace(',', '.'))
    if (!num || num <= 0) { toast.error('Введите корректную сумму'); return }
    onAdd({ type, amount: num, description: description.trim(), category: type === 'expense' ? category : null, date })
    setAmount(''); setDescription(''); setCategory('other')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={type === 'expense' ? 'Новый расход' : 'Новый доход'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={clsx(
                'flex-1 py-1.5 text-sm rounded-md transition-colors font-medium',
                type === t ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {t === 'expense' ? 'Расход' : 'Доход'}
            </button>
          ))}
        </div>

        <Input
          label="Сумма (₽)"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          required
          autoFocus
        />
        <Input
          label="Описание"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Напр., Продукты, Зарплата…"
        />
        <Input
          label="Дата"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />

        {type === 'expense' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Категория</label>
            <div className="grid grid-cols-3 gap-1.5">
              {EXPENSE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    category === cat.id
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  )}
                  style={category === cat.id ? { backgroundColor: cat.color } : undefined}
                >
                  <span>{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit">Добавить</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Add planned purchase modal ─────────────────────────────────────────────

function AddPlannedModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (item: Omit<PlannedPurchase, 'id' | 'createdAt' | 'done'>) => void
}) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ExpenseCategoryId>('other')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount.replace(',', '.'))
    if (!num || num <= 0) { toast.error('Введите корректную сумму'); return }
    onAdd({ amount: num, description: description.trim(), category })
    setAmount(''); setDescription(''); setCategory('other')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Планируемая покупка">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Сумма (₽)"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          required
          autoFocus
        />
        <Input
          label="Описание"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Напр., Новый телефон…"
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Категория</label>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPENSE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  category === cat.id
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                )}
                style={category === cat.id ? { backgroundColor: cat.color } : undefined}
              >
                <span>{cat.icon}</span>
                <span className="truncate">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit">Добавить</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Overview tab ───────────────────────────────────────────────────────────

function OverviewTab({
  currentMonth,
  allData,
  isDark,
}: {
  currentMonth: BudgetMonth
  allData: BudgetMonth[]
  isDark: boolean
}) {
  const { transactions, plannedPurchases } = currentMonth

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const pendingPlanned = plannedPurchases.filter(p => !p.done).reduce((s, p) => s + p.amount, 0)
  const balance = totalIncome - totalExpense

  // By-category pie
  const catData = useMemo(() => {
    const map = new Map<string, { label: string; color: string; value: number }>()
    transactions.filter(t => t.type === 'expense' && t.category).forEach(t => {
      const cat = getCat(t.category)
      const existing = map.get(cat.id) ?? { label: cat.label, color: cat.color, value: 0 }
      map.set(cat.id, { ...existing, value: existing.value + t.amount })
    })
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [transactions])

  // Monthly bar chart (last 6 months)
  const monthlyData = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = allData.find(m => m.year === d.getFullYear() && m.month === d.getMonth())
      const income  = m?.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0
      const expense = m?.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0
      result.push({ label: format(d, 'MMM', { locale: ru }), income, expense })
    }
    return result
  }, [allData])

  const tooltipStyle = {
    fontSize: 12, borderRadius: 8,
    backgroundColor: isDark ? '#1E293B' : '#fff',
    border: isDark ? '1px solid #334155' : '1px solid #E5E7EB',
    boxShadow: 'none',
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Доходы</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {totalIncome.toLocaleString('ru-RU')} ₽
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Расходы</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {totalExpense.toLocaleString('ru-RU')} ₽
          </div>
        </div>
        <div className={clsx('rounded-xl p-4', balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20')}>
          <div className={clsx('text-xs font-medium mb-1', balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400')}>Баланс</div>
          <div className={clsx('text-2xl font-bold tabular-nums', balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400')}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString('ru-RU')} ₽
          </div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
          <div className="text-xs text-yellow-700 dark:text-yellow-400 font-medium mb-1">Планируемые</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">
            ~{pendingPlanned.toLocaleString('ru-RU')} ₽
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly bar chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Доходы vs расходы по месяцам</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={3}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString('ru-RU')} ₽`} />
              <Bar dataKey="income"  fill="#10B981" radius={[4,4,0,0]} name="Доходы" maxBarSize={28} />
              <Bar dataKey="expense" fill="#EF4444" radius={[4,4,0,0]} name="Расходы" maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Расходы по категориям</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={catData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {catData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [`${v.toLocaleString('ru-RU')} ₽`, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 11, color: isDark ? '#CBD5E1' : '#4B5563' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
              Нет расходов в этом месяце
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalIncome > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Потрачено от дохода</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {Math.round((totalExpense / totalIncome) * 100)}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                totalExpense > totalIncome ? 'bg-red-500' : totalExpense / totalIncome > 0.8 ? 'bg-orange-500' : 'bg-emerald-500'
              )}
              style={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }}
            />
          </div>
          {pendingPlanned > 0 && (
            <>
              <div className="flex justify-between text-sm mt-3 mb-2">
                <span className="text-gray-500 dark:text-gray-400">С учётом планируемых</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  {Math.round(((totalExpense + pendingPlanned) / totalIncome) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-yellow-400 transition-all"
                  style={{ width: `${Math.min(((totalExpense + pendingPlanned) / totalIncome) * 100, 100)}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [tab, setTab] = useState<Tab>('overview')
  const [allData, setAllData] = useState<BudgetMonth[]>(loadData)

  // Current month navigation
  const [viewDate, setViewDate] = useState(new Date())
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const currentMonth = useMemo(() => getOrCreateMonth(allData, year, month), [allData, year, month])

  const persist = useCallback((updater: (prev: BudgetMonth[]) => BudgetMonth[]) => {
    setAllData(prev => {
      const next = updater(prev)
      saveData(next)
      return next
    })
  }, [])

  const upsertMonth = useCallback((updated: BudgetMonth) => {
    persist(prev => {
      const idx = prev.findIndex(m => m.year === updated.year && m.month === updated.month)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = updated; return next
      }
      return [...prev, updated]
    })
  }, [persist])

  // ─── Transaction actions ─────────────────────────────────────────────────

  const [addTxOpen, setAddTxOpen] = useState(false)
  const [addTxType, setAddTxType] = useState<'expense' | 'income'>('expense')
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'tx'; id: string } | { kind: 'planned'; id: string } | null>(null)

  const openAdd = (type: 'expense' | 'income') => { setAddTxType(type); setAddTxOpen(true) }

  const handleAddTx = (tx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = { ...tx, id: genId(), createdAt: Date.now() }
    upsertMonth({ ...currentMonth, transactions: [...currentMonth.transactions, newTx] })
    setAddTxOpen(false)
    toast.success(tx.type === 'income' ? 'Доход добавлен' : 'Расход добавлен')
  }

  const handleDeleteTx = (id: string) => {
    upsertMonth({ ...currentMonth, transactions: currentMonth.transactions.filter(t => t.id !== id) })
    toast.success('Удалено')
  }

  // ─── Planned actions ─────────────────────────────────────────────────────

  const [addPlannedOpen, setAddPlannedOpen] = useState(false)

  const handleAddPlanned = (item: Omit<PlannedPurchase, 'id' | 'createdAt' | 'done'>) => {
    const newItem: PlannedPurchase = { ...item, id: genId(), createdAt: Date.now(), done: false }
    upsertMonth({ ...currentMonth, plannedPurchases: [...currentMonth.plannedPurchases, newItem] })
    setAddPlannedOpen(false)
    toast.success('Покупка добавлена в план')
  }

  const handleTogglePlanned = (id: string) => {
    upsertMonth({
      ...currentMonth,
      plannedPurchases: currentMonth.plannedPurchases.map(p =>
        p.id === id ? { ...p, done: !p.done } : p
      ),
    })
  }

  const handleDeletePlanned = (id: string) => {
    upsertMonth({ ...currentMonth, plannedPurchases: currentMonth.plannedPurchases.filter(p => p.id !== id) })
    toast.success('Удалено')
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const expenses = currentMonth.transactions.filter(t => t.type === 'expense').sort((a, b) => b.createdAt - a.createdAt)
  const incomes  = currentMonth.transactions.filter(t => t.type === 'income').sort((a, b) => b.createdAt - a.createdAt)
  const planned  = [...currentMonth.plannedPurchases].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))

  // All transactions in history view (real + virtual from planned that are done)
  const historyTx: (Transaction & { dim?: boolean })[] = useMemo(() => {
    const real = currentMonth.transactions.map(t => ({ ...t, dim: false }))
    const pendingVirtual: (Transaction & { dim: boolean })[] = currentMonth.plannedPurchases
      .filter(p => !p.done)
      .map(p => ({
        id: `planned_${p.id}`,
        type: 'expense' as const,
        amount: p.amount,
        category: p.category,
        description: p.description,
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: p.createdAt,
        dim: true,
      }))
    return [...real, ...pendingVirtual].sort((a, b) => b.createdAt - a.createdAt)
  }, [currentMonth])

  const monthTitle = format(new Date(year, month, 1), 'LLLL yyyy', { locale: ru })
    .replace(/^./, s => s.toUpperCase())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Бюджет</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[130px] text-center">{monthTitle}</span>
            <button
              type="button"
              onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={() => openAdd('expense')}>+ Расход</Button>
          <Button size="sm" variant="secondary" onClick={() => openAdd('income')}>+ Доход</Button>
          <Button size="sm" variant="secondary" onClick={() => setAddPlannedOpen(true)}>+ Планируемое</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 text-sm rounded-md transition-colors font-medium whitespace-nowrap',
              tab === t.id
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <OverviewTab currentMonth={currentMonth} allData={allData} isDark={isDark} />
      )}

      {tab === 'expenses' && (
        <div className="space-y-2">
          {expenses.length === 0 ? (
            <p className="text-center py-16 text-sm text-gray-400">Расходов нет. Добавьте первый расход.</p>
          ) : (
            expenses.map(tx => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                onDelete={() => setDeleteTarget({ kind: 'tx', id: tx.id })}
              />
            ))
          )}
        </div>
      )}

      {tab === 'income' && (
        <div className="space-y-2">
          {incomes.length === 0 ? (
            <p className="text-center py-16 text-sm text-gray-400">Доходов нет. Добавьте зарплату или другой доход.</p>
          ) : (
            incomes.map(tx => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                onDelete={() => setDeleteTarget({ kind: 'tx', id: tx.id })}
              />
            ))
          )}
        </div>
      )}

      {tab === 'planned' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Планируемые покупки отображаются в истории серым. Отметьте как выполненную — они станут реальными расходами автоматически.
          </p>
          {planned.length === 0 ? (
            <p className="text-center py-16 text-sm text-gray-400">Нет планируемых покупок.</p>
          ) : (
            planned.map(item => (
              <PlannedCard
                key={item.id}
                item={item}
                onToggle={() => handleTogglePlanned(item.id)}
                onDelete={() => setDeleteTarget({ kind: 'planned', id: item.id })}
              />
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Жёлтым выделены предстоящие (планируемые) траты — ещё не подтверждённые.
          </p>
          {historyTx.length === 0 ? (
            <p className="text-center py-16 text-sm text-gray-400">История пуста.</p>
          ) : (
            historyTx.map(tx => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                dim={tx.dim}
                onDelete={() => {
                  if (tx.id.startsWith('planned_')) {
                    const plannedId = tx.id.replace('planned_', '')
                    setDeleteTarget({ kind: 'planned', id: plannedId })
                  } else {
                    setDeleteTarget({ kind: 'tx', id: tx.id })
                  }
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Modals */}
      <AddTransactionModal
        isOpen={addTxOpen}
        onClose={() => setAddTxOpen(false)}
        onAdd={handleAddTx}
        defaultType={addTxType}
      />
      <AddPlannedModal
        isOpen={addPlannedOpen}
        onClose={() => setAddPlannedOpen(false)}
        onAdd={handleAddPlanned}
      />
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Удалить запись?"
        message="Это действие нельзя отменить."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={async () => {
          if (!deleteTarget) return
          if (deleteTarget.kind === 'tx') handleDeleteTx(deleteTarget.id)
          else handleDeletePlanned(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
