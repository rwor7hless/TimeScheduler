import { useState, useMemo, useEffect } from 'react'
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
} from '@/types/budget'
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  usePlannedPurchases,
  useCreatePlanned,
  useUpdatePlanned,
  useDeletePlanned,
} from '@/hooks/useBudget'
import type { TransactionResponse, PlannedPurchaseResponse } from '@/api/budget'

// ─── Category helpers ───────────────────────────────────────────────────────

function getCat(id: ExpenseCategoryId | null) {
  return EXPENSE_CATEGORIES.find(c => c.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'expenses' | 'income' | 'planned' | 'history' | 'year'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'Обзор'       },
  { id: 'expenses',  label: 'Расходы'     },
  { id: 'income',    label: 'Доходы'      },
  { id: 'planned',   label: 'Планируемые' },
  { id: 'history',   label: 'История'     },
  { id: 'year',      label: 'Год'         },
]

type ModalTab = 'expense' | 'income' | 'planned'

// ─── Category picker ────────────────────────────────────────────────────────

function CategoryPicker({ value, onChange }: { value: ExpenseCategoryId; onChange: (v: ExpenseCategoryId) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Категория</label>
      <div className="grid grid-cols-3 gap-1.5">
        {EXPENSE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium',
              value === cat.id
                ? 'border-transparent text-white shadow-sm'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
            )}
            style={value === cat.id ? { backgroundColor: cat.color } : undefined}
          >
            <span>{cat.icon}</span>
            <span className="truncate">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Unified add/edit modal ──────────────────────────────────────────────────

interface EntryModalProps {
  isOpen: boolean
  onClose: () => void
  onAddTx: (data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string }) => void
  onAddPlanned: (data: { amount: number; category: ExpenseCategoryId | null; description: string }) => void
  editTx?: TransactionResponse | null
  editPlanned?: PlannedPurchaseResponse | null
  onUpdateTx?: (id: number, data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string }) => void
  onUpdatePlanned?: (id: number, data: { amount: number; category: ExpenseCategoryId | null; description: string }) => void
  defaultTab?: ModalTab
}

function EntryModal({
  isOpen, onClose,
  onAddTx, onAddPlanned,
  editTx, editPlanned,
  onUpdateTx, onUpdatePlanned,
  defaultTab = 'expense',
}: EntryModalProps) {
  const isEdit = !!(editTx || editPlanned)
  const initTab: ModalTab = editTx ? (editTx.type as ModalTab) : editPlanned ? 'planned' : defaultTab

  const [modalTab, setModalTab] = useState<ModalTab>(initTab)
  const [amount, setAmount]     = useState(editTx?.amount.toString() ?? editPlanned?.amount.toString() ?? '')
  const [description, setDescription] = useState(editTx?.description ?? editPlanned?.description ?? '')
  const [category, setCategory] = useState<ExpenseCategoryId>((editTx?.category ?? editPlanned?.category ?? 'other') as ExpenseCategoryId)
  const [date, setDate]         = useState(editTx?.date ?? format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    if (!isOpen) return
    if (editTx) {
      setModalTab(editTx.type as ModalTab)
      setAmount(editTx.amount.toString())
      setDescription(editTx.description)
      setCategory((editTx.category ?? 'other') as ExpenseCategoryId)
      setDate(editTx.date)
    } else if (editPlanned) {
      setModalTab('planned')
      setAmount(editPlanned.amount.toString())
      setDescription(editPlanned.description)
      setCategory((editPlanned.category ?? 'other') as ExpenseCategoryId)
    } else {
      setModalTab(defaultTab)
      setAmount('')
      setDescription('')
      setCategory('other')
      setDate(format(new Date(), 'yyyy-MM-dd'))
    }
  }, [isOpen, editTx, editPlanned]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount.replace(',', '.'))
    if (!num || num <= 0) { toast.error('Введите корректную сумму'); return }

    if (isEdit) {
      if (editTx && onUpdateTx) {
        onUpdateTx(editTx.id, { type: modalTab as 'expense' | 'income', amount: num, description: description.trim(), category: modalTab === 'expense' ? category : null, date })
      } else if (editPlanned && onUpdatePlanned) {
        onUpdatePlanned(editPlanned.id, { amount: num, description: description.trim(), category })
      }
    } else {
      if (modalTab === 'planned') {
        onAddPlanned({ amount: num, description: description.trim(), category })
      } else {
        onAddTx({ type: modalTab, amount: num, description: description.trim(), category: modalTab === 'expense' ? category : null, date })
      }
    }
    onClose()
  }

  const title = isEdit ? (editPlanned ? 'Редактировать план' : 'Редактировать запись') : 'Новая статья'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {(['expense', 'income', 'planned'] as ModalTab[]).map(t => (
              <button key={t} type="button" onClick={() => setModalTab(t)} className={clsx('flex-1 py-1.5 text-xs rounded-md font-medium', modalTab === t ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}>
                {t === 'expense' ? 'Расход' : t === 'income' ? 'Доход' : 'Планируемое'}
              </button>
            ))}
          </div>
        )}
        <Input label="Сумма (₽)" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required autoFocus />
        <Input label="Описание" value={description} onChange={e => setDescription(e.target.value)} placeholder={modalTab === 'income' ? 'Напр., Зарплата…' : 'Напр., Продукты…'} />
        <div aria-hidden={modalTab === 'income'} style={{ opacity: modalTab === 'income' ? 0 : 1, pointerEvents: modalTab === 'income' ? 'none' : 'auto' }}>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        <div aria-hidden={modalTab === 'planned'} style={{ opacity: modalTab === 'planned' ? 0 : 1, pointerEvents: modalTab === 'planned' ? 'none' : 'auto' }}>
          <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit">{isEdit ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Small display components ────────────────────────────────────────────────

function AmountBadge({ amount, type, dim }: { amount: number; type: 'expense' | 'income'; dim?: boolean }) {
  return (
    <span className={clsx('font-semibold tabular-nums', dim ? 'text-yellow-600 dark:text-yellow-400' : type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
      {type === 'income' ? '+' : '−'}{amount.toLocaleString('ru-RU')} ₽
    </span>
  )
}

function CategoryPill({ id }: { id: ExpenseCategoryId | null }) {
  const cat = getCat(id)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: cat.color }}>
      {cat.icon} {cat.label}
    </span>
  )
}

// ─── Transaction card ────────────────────────────────────────────────────────

function TransactionCard({ tx, dim, onEdit, onDelete }: { tx: TransactionResponse & { dim?: boolean }; dim?: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className={clsx('group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all', dim ? 'border-yellow-200 bg-yellow-50/60 dark:bg-yellow-900/10 dark:border-yellow-800/40' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800')}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg" style={{ backgroundColor: getCat(tx.category).color + '22' }}>
        {getCat(tx.category).icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{tx.description || '—'}</span>
          {dim && <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded-full">планируемое</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <CategoryPill id={tx.category} />
          <span className="text-xs text-gray-400 dark:text-gray-500">{format(parseISO(tx.date), 'd MMM', { locale: ru })}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <AmountBadge amount={tx.amount} type={tx.type as 'expense' | 'income'} dim={dim} />
        {!dim && (
          <button type="button" onClick={onEdit} className="opacity-0 group-hover:opacity-100 ml-2 w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-amber-500 transition-all" title="Редактировать">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
        <button type="button" onClick={onDelete} className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all" title="Удалить">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </div>
  )
}

// ─── Planned purchase card ───────────────────────────────────────────────────

function PlannedCard({ item, onCheck, onEdit, onDelete }: { item: PlannedPurchaseResponse; onCheck: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className={clsx('group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all', item.done ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-800/40 opacity-60' : 'border-yellow-200 bg-yellow-50/60 dark:bg-yellow-900/10 dark:border-yellow-800/40')}>
      <button type="button" onClick={onCheck} title={item.done ? 'Вернуть в план' : 'Перенести в расходы'} className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-yellow-400 text-transparent hover:border-yellow-500')}>
        {item.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </button>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base" style={{ backgroundColor: getCat(item.category).color + '22' }}>
        {getCat(item.category).icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={clsx('font-medium text-sm text-gray-900 dark:text-gray-100 truncate', item.done && 'line-through text-gray-400')}>{item.description || '—'}</div>
        <CategoryPill id={item.category} />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="font-semibold tabular-nums text-yellow-600 dark:text-yellow-400">~{item.amount.toLocaleString('ru-RU')} ₽</span>
        {!item.done && (
          <button type="button" onClick={onEdit} className="opacity-0 group-hover:opacity-100 ml-1 w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-amber-500 transition-all" title="Редактировать">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
        <button type="button" onClick={onDelete} className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all" title="Удалить">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </div>
  )
}

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab({
  transactions, plannedPurchases, isDark,
  allTransactions,
}: {
  transactions: TransactionResponse[]
  plannedPurchases: PlannedPurchaseResponse[]
  isDark: boolean
  allTransactions: TransactionResponse[]
}) {
  const totalIncome    = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense   = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const pendingPlanned = plannedPurchases.filter(p => !p.done).reduce((s, p) => s + p.amount, 0)
  const balance        = totalIncome - totalExpense

  const catData = useMemo(() => {
    const map = new Map<string, { label: string; color: string; value: number }>()
    transactions.filter(t => t.type === 'expense' && t.category).forEach(t => {
      const cat = getCat(t.category)
      const existing = map.get(cat.id) ?? { label: cat.label, color: cat.color, value: 0 }
      map.set(cat.id, { ...existing, value: existing.value + t.amount })
    })
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [transactions])

  const monthlyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const y = d.getFullYear()
      const m1 = d.getMonth() + 1
      const prefix = `${y}-${String(m1).padStart(2, '0')}`
      const monthTxs = allTransactions.filter(t => t.date.startsWith(prefix))
      const income  = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return { label: format(d, 'MMM', { locale: ru }), income, expense }
    })
  }, [allTransactions])

  const tooltipStyle = {
    fontSize: 12, borderRadius: 8,
    backgroundColor: isDark ? '#1E293B' : '#fff',
    border: isDark ? '1px solid #334155' : '1px solid #E5E7EB',
    boxShadow: 'none',
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Доходы</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{totalIncome.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Расходы</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{totalExpense.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className={clsx('rounded-xl p-4', balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20')}>
          <div className={clsx('text-xs font-medium mb-1', balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400')}>Баланс</div>
          <div className={clsx('text-2xl font-bold tabular-nums', balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400')}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString('ru-RU')} ₽
          </div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
          <div className="text-xs text-yellow-700 dark:text-yellow-400 font-medium mb-1">Планируемые</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">~{pendingPlanned.toLocaleString('ru-RU')} ₽</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Доходы vs расходы по месяцам</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={3}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString('ru-RU')} ₽`} />
              <Bar dataKey="income"  fill="#10B981" radius={[4,4,0,0]} name="Доходы"  maxBarSize={28} />
              <Bar dataKey="expense" fill="#EF4444" radius={[4,4,0,0]} name="Расходы" maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Расходы по категориям</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                  {catData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v.toLocaleString('ru-RU')} ₽`, name]} />
                <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11, color: isDark ? '#CBD5E1' : '#4B5563' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Нет расходов в этом месяце</div>
          )}
        </div>
      </div>

      {totalIncome > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Потрачено от дохода</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{Math.round((totalExpense / totalIncome) * 100)}%</span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all', totalExpense > totalIncome ? 'bg-red-500' : totalExpense / totalIncome > 0.8 ? 'bg-orange-500' : 'bg-emerald-500')} style={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }} />
          </div>
          {pendingPlanned > 0 && (
            <>
              <div className="flex justify-between text-sm mt-3 mb-2">
                <span className="text-gray-500 dark:text-gray-400">С учётом планируемых</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">{Math.round(((totalExpense + pendingPlanned) / totalIncome) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${Math.min(((totalExpense + pendingPlanned) / totalIncome) * 100, 100)}%` }} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Year tab ────────────────────────────────────────────────────────────────

function YearTab({ allTransactions, viewYear, isDark }: { allTransactions: TransactionResponse[]; viewYear: number; isDark: boolean }) {
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m1 = i + 1
      const prefix = `${viewYear}-${String(m1).padStart(2, '0')}`
      const monthTxs = allTransactions.filter(t => t.date.startsWith(prefix))
      const income  = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      const saved   = income - expense
      return { label: format(new Date(viewYear, i, 1), 'MMM', { locale: ru }), income, expense, saved }
    })
  }, [allTransactions, viewYear])

  const totalIncome  = months.reduce((s, m) => s + m.income, 0)
  const totalExpense = months.reduce((s, m) => s + m.expense, 0)
  const totalSaved   = totalIncome - totalExpense

  const catData = useMemo(() => {
    const yearTxs = allTransactions.filter(t => t.date.startsWith(`${viewYear}-`))
    const map = new Map<string, { label: string; color: string; value: number }>()
    yearTxs.filter(t => t.type === 'expense' && t.category).forEach(t => {
      const cat = getCat(t.category)
      const existing = map.get(cat.id) ?? { label: cat.label, color: cat.color, value: 0 }
      map.set(cat.id, { ...existing, value: existing.value + t.amount })
    })
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [allTransactions, viewYear])

  const tooltipStyle = {
    fontSize: 12, borderRadius: 8,
    backgroundColor: isDark ? '#1E293B' : '#fff',
    border: isDark ? '1px solid #334155' : '1px solid #E5E7EB',
    boxShadow: 'none',
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Доходы за год</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{totalIncome.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Расходы за год</div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{totalExpense.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className={clsx('rounded-xl p-4', totalSaved >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20')}>
          <div className={clsx('text-xs font-medium mb-1', totalSaved >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400')}>Отложено</div>
          <div className={clsx('text-xl font-bold tabular-nums', totalSaved >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400')}>
            {totalSaved >= 0 ? '+' : ''}{totalSaved.toLocaleString('ru-RU')} ₽
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Доходы и расходы по месяцам</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barGap={2}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString('ru-RU')} ₽`} />
            <Bar dataKey="income"  fill="#10B981" radius={[4,4,0,0]} name="Доходы"  maxBarSize={24} />
            <Bar dataKey="expense" fill="#EF4444" radius={[4,4,0,0]} name="Расходы" maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Накопления по месяцам (доход − расход)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toLocaleString('ru-RU')} ₽`} />
            <Bar dataKey="saved" name="Отложено" maxBarSize={28} radius={[4,4,0,0]} label={false}>
              {months.map((m, i) => <Cell key={i} fill={m.saved >= 0 ? '#3B82F6' : '#F97316'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Расходы по категориям за год</h3>
        {catData.length > 0 ? (
          <div className="flex flex-col gap-2">
            {catData.map(cat => {
              const pct = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0
              return (
                <div key={cat.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-24 flex-shrink-0 truncate">{cat.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                  </div>
                  <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300 w-24 text-right flex-shrink-0">{cat.value.toLocaleString('ru-RU')} ₽</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Расходов за {viewYear} год нет</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">Месяц</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-emerald-600">Доходы</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-red-500">Расходы</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-blue-600">Отложено</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={i} className="border-b last:border-0 border-gray-50 dark:border-gray-700/50">
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300 capitalize">{m.label}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.income > 0 ? `+${m.income.toLocaleString('ru-RU')} ₽` : '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-500 dark:text-red-400">{m.expense > 0 ? `−${m.expense.toLocaleString('ru-RU')} ₽` : '—'}</td>
                <td className={clsx('px-4 py-2 text-right tabular-nums font-medium', m.saved >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400')}>
                  {m.income === 0 && m.expense === 0 ? '—' : `${m.saved >= 0 ? '+' : ''}${m.saved.toLocaleString('ru-RU')} ₽`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [tab, setTab] = useState<Tab>('overview')
  const [viewDate, setViewDate] = useState(new Date())
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth() // 0-based

  const { data: transactions = [], isLoading: txLoading } = useTransactions(year, month)
  const { data: plannedPurchases = [] } = usePlannedPurchases(year, month)

  // For overview 6-month chart and year tab — fetch all (no year/month filter)
  const { data: allTransactions = [] } = useTransactions()

  const createTx    = useCreateTransaction()
  const updateTx    = useUpdateTransaction()
  const deleteTx    = useDeleteTransaction()
  const createPlan  = useCreatePlanned()
  const updatePlan  = useUpdatePlanned()
  const deletePlan  = useDeletePlanned()

  // ─── Entry modal state ───────────────────────────────────────────────────
  const [entryOpen, setEntryOpen]             = useState(false)
  const [entryDefaultTab, setEntryDefaultTab] = useState<ModalTab>('expense')
  const [editTx, setEditTx]                   = useState<TransactionResponse | null>(null)
  const [editPlanned, setEditPlanned]         = useState<PlannedPurchaseResponse | null>(null)

  const openAdd = (t: ModalTab = 'expense') => { setEditTx(null); setEditPlanned(null); setEntryDefaultTab(t); setEntryOpen(true) }
  const openEditTx = (tx: TransactionResponse) => { setEditPlanned(null); setEditTx(tx); setEntryOpen(true) }
  const openEditPlanned = (item: PlannedPurchaseResponse) => { setEditTx(null); setEditPlanned(item); setEntryOpen(true) }

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'tx' | 'planned'; id: number } | null>(null)

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleAddTx = (data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string }) => {
    createTx.mutate({ ...data }, {
      onSuccess: () => toast.success(`${data.type === 'income' ? 'Доход' : 'Расход'} добавлен`),
      onError: () => toast.error('Ошибка при добавлении'),
    })
  }

  const handleUpdateTx = (id: number, data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string }) => {
    updateTx.mutate({ id, data }, {
      onSuccess: () => toast.success('Сохранено'),
      onError: () => toast.error('Ошибка при сохранении'),
    })
  }

  const handleDeleteTx = (id: number) => {
    deleteTx.mutate(id, {
      onSuccess: () => toast.success('Удалено'),
      onError: () => toast.error('Ошибка при удалении'),
    })
  }

  const handleAddPlanned = (data: { amount: number; category: ExpenseCategoryId | null; description: string }) => {
    createPlan.mutate({ ...data, year, month }, {
      onSuccess: () => toast.success('Покупка добавлена в план'),
      onError: () => toast.error('Ошибка при добавлении'),
    })
  }

  const handleUpdatePlanned = (id: number, data: { amount: number; category: ExpenseCategoryId | null; description: string }) => {
    updatePlan.mutate({ id, data }, {
      onSuccess: () => toast.success('Сохранено'),
      onError: () => toast.error('Ошибка при сохранении'),
    })
  }

  const handleCheckPlanned = (item: PlannedPurchaseResponse) => {
    if (item.done) {
      // uncheck — just mark as not done
      updatePlan.mutate({ id: item.id, data: { done: false } })
    } else {
      // check — create real expense + mark done
      createTx.mutate({
        type: 'expense',
        amount: item.amount,
        category: item.category,
        description: item.description,
        date: format(new Date(), 'yyyy-MM-dd'),
      }, {
        onSuccess: () => {
          updatePlan.mutate({ id: item.id, data: { done: true } })
          toast.success('Перенесено в расходы')
        },
        onError: () => toast.error('Ошибка'),
      })
    }
  }

  const handleDeletePlanned = (id: number) => {
    deletePlan.mutate(id, {
      onSuccess: () => toast.success('Удалено'),
      onError: () => toast.error('Ошибка при удалении'),
    })
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const expenses = transactions.filter(t => t.type === 'expense').slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const incomes  = transactions.filter(t => t.type === 'income').slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const planned  = [...plannedPurchases].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))

  const historyTx = useMemo(() => {
    const real = transactions.map(t => ({ ...t, dim: false }))
    const pendingVirtual = plannedPurchases.filter(p => !p.done).map(p => ({
      id: -(p.id),  // negative to avoid collision
      type: 'expense' as const,
      amount: p.amount,
      category: p.category,
      description: p.description,
      date: format(new Date(), 'yyyy-MM-dd'),
      created_at: p.created_at,
      dim: true,
      _plannedId: p.id,
    }))
    return [...real, ...pendingVirtual].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [transactions, plannedPurchases])

  const monthTitle = format(new Date(year, month, 1), 'LLLL yyyy', { locale: ru }).replace(/^./, s => s.toUpperCase())
  const chevronCls = "w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Бюджет</h2>
          <div className="flex items-center gap-1">
            {tab === 'year' ? (
              <>
                <button type="button" onClick={() => setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), 1))} className={chevronCls}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px] text-center">{year}</span>
                <button type="button" onClick={() => setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), 1))} className={chevronCls}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className={chevronCls}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[130px] text-center">{monthTitle}</span>
                <button type="button" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className={chevronCls}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => openAdd('expense')}>+ Новая статья</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={clsx('flex-shrink-0 px-3 py-1.5 text-sm rounded-md transition-colors font-medium whitespace-nowrap', tab === t.id ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>
            {t.label}
          </button>
        ))}
      </div>

      {txLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!txLoading && (
        <>
          {tab === 'overview' && (
            <OverviewTab transactions={transactions} plannedPurchases={plannedPurchases} isDark={isDark} allTransactions={allTransactions} />
          )}

          {tab === 'expenses' && (
            <div className="space-y-2">
              {expenses.length === 0 ? <p className="text-center py-16 text-sm text-gray-400">Расходов нет.</p> : expenses.map(tx => (
                <TransactionCard key={tx.id} tx={tx} onEdit={() => openEditTx(tx)} onDelete={() => setDeleteTarget({ kind: 'tx', id: tx.id })} />
              ))}
            </div>
          )}

          {tab === 'income' && (
            <div className="space-y-2">
              {incomes.length === 0 ? <p className="text-center py-16 text-sm text-gray-400">Доходов нет.</p> : incomes.map(tx => (
                <TransactionCard key={tx.id} tx={tx} onEdit={() => openEditTx(tx)} onDelete={() => setDeleteTarget({ kind: 'tx', id: tx.id })} />
              ))}
            </div>
          )}

          {tab === 'planned' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Поставьте галочку — покупка переедет в расходы. Снимите — вернётся в план.</p>
              {planned.length === 0 ? <p className="text-center py-16 text-sm text-gray-400">Нет планируемых покупок.</p> : planned.map(item => (
                <PlannedCard key={item.id} item={item} onCheck={() => handleCheckPlanned(item)} onEdit={() => openEditPlanned(item)} onDelete={() => setDeleteTarget({ kind: 'planned', id: item.id })} />
              ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Жёлтым — предстоящие (планируемые) траты.</p>
              {historyTx.length === 0 ? <p className="text-center py-16 text-sm text-gray-400">История пуста.</p> : historyTx.map(tx => (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  dim={tx.dim}
                  onEdit={() => { if (!tx.dim) openEditTx(tx as TransactionResponse) }}
                  onDelete={() => {
                    if (tx.dim && '_plannedId' in tx) setDeleteTarget({ kind: 'planned', id: (tx as { _plannedId: number })._plannedId })
                    else setDeleteTarget({ kind: 'tx', id: tx.id })
                  }}
                />
              ))}
            </div>
          )}

          {tab === 'year' && <YearTab allTransactions={allTransactions} viewYear={year} isDark={isDark} />}
        </>
      )}

      {/* Entry modal */}
      <EntryModal
        isOpen={entryOpen}
        onClose={() => { setEntryOpen(false); setEditTx(null); setEditPlanned(null) }}
        onAddTx={handleAddTx}
        onAddPlanned={handleAddPlanned}
        onUpdateTx={handleUpdateTx}
        onUpdatePlanned={handleUpdatePlanned}
        editTx={editTx}
        editPlanned={editPlanned}
        defaultTab={entryDefaultTab}
      />

      {/* Delete confirm */}
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
