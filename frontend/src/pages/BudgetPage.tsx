import React, { useState, useMemo, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
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
  useBudgetTags,
  useCreateBudgetTag,
  useAllocations,
  useUpsertAllocation,
  useDeleteAllocation,
  useBudgetSummary,
  useBudgetHistory,
} from '@/hooks/useBudget'
import { budgetApi } from '@/api/budget'
import type { TransactionResponse, PlannedPurchaseResponse, BudgetTagResponse, AllocationResponse, SummaryResponse, HistoryQuery } from '@/api/budget'
import PulseStrip from '@/components/budget/PulseStrip'
import DailySpendChart from '@/components/budget/DailySpendChart'
import TopCategories from '@/components/budget/TopCategories'
import CategorySparkline from '@/components/budget/CategorySparkline'
import QuickAddBar from '@/components/budget/QuickAddBar'
import RecurringManager from '@/components/budget/RecurringManager'
import ConvertPlannedModal from '@/components/budget/ConvertPlannedModal'
import TagManager from '@/components/budget/TagManager'
import { BudgetCategoryIcon, IconTarget, IconTag, IconRepeat } from '@/components/ui/icons'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCat(id: ExpenseCategoryId | null | undefined) {
  return EXPENSE_CATEGORIES.find(c => c.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

function fmt(n: number) { return n.toLocaleString('ru-RU') }

// ─── Small display components ─────────────────────────────────────────────────

function CategoryPill({ id }: { id: ExpenseCategoryId | null | undefined }) {
  const cat = getCat(id)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: cat.color }}>
      <BudgetCategoryIcon id={cat.icon} size={12} />
      {cat.label}
    </span>
  )
}

// ─── Category picker ─────────────────────────────────────────────────────────

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
            <BudgetCategoryIcon id={cat.icon} size={14} />
            <span className="truncate">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Tag picker ───────────────────────────────────────────────────────────────

function TagPicker({
  allTags, selectedIds, onChange, onCreateTag,
}: {
  allTags: BudgetTagResponse[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  onCreateTag: (name: string, color: string) => void
}) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6B7280')
  const [showCreate, setShowCreate] = useState(false)

  const toggle = (id: number) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    onCreateTag(name, newColor)
    setNewName('')
    setShowCreate(false)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Теги</label>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={clsx(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
              selectedIds.includes(tag.id)
                ? 'text-white border-transparent'
                : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 bg-transparent hover:opacity-80'
            )}
            style={selectedIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color + '66' }}
          >
            {tag.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCreate(s => !s)}
          className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 transition-all"
        >
          + тег
        </button>
      </div>
      {showCreate && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
            placeholder="Название тега"
            className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400"
          />
          <button type="button" onClick={handleCreate} className="text-sm px-3 py-1.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors">
            OK
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Description autocomplete ────────────────────────────────────────────────

function DescriptionAutocomplete({
  value, onChange, suggestions, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
    : suggestions

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Описание</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors pr-8"
        />
        {suggestions.length > 0 && (
          <button type="button" tabIndex={-1} onClick={() => setOpen(o => !o)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
            </svg>
          </button>
        )}
        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg truncate"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Entry modal ─────────────────────────────────────────────────────────────

type ModalTab = 'expense' | 'income' | 'planned'

interface EntryModalProps {
  isOpen: boolean
  onClose: () => void
  onAddTx: (data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string; tag_ids: number[] }) => void
  onAddPlanned: (data: { amount: number; category: ExpenseCategoryId | null; description: string }) => void
  editTx?: TransactionResponse | null
  editPlanned?: PlannedPurchaseResponse | null
  onUpdateTx?: (id: number, data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string; tag_ids: number[] }) => void
  onUpdatePlanned?: (id: number, data: { amount: number; category: ExpenseCategoryId | null; description: string }) => void
  defaultTab?: ModalTab
  allTags: BudgetTagResponse[]
  onCreateTag: (name: string, color: string) => void
  defaultCategory?: ExpenseCategoryId
  lockedCategory?: boolean
  descriptionSuggestions?: string[]
}

function EntryModal({
  isOpen, onClose,
  onAddTx, onAddPlanned,
  editTx, editPlanned,
  onUpdateTx, onUpdatePlanned,
  defaultTab = 'expense',
  allTags, onCreateTag,
  defaultCategory,
  lockedCategory,
  descriptionSuggestions = [],
}: EntryModalProps) {
  const isEdit = !!(editTx || editPlanned)
  const initTab: ModalTab = editTx ? (editTx.type as ModalTab) : editPlanned ? 'planned' : defaultTab

  const [modalTab, setModalTab] = useState<ModalTab>(initTab)
  const [amount, setAmount]     = useState(editTx?.amount.toString() ?? editPlanned?.amount.toString() ?? '')
  const [description, setDescription] = useState(editTx?.description ?? editPlanned?.description ?? '')
  const [category, setCategory] = useState<ExpenseCategoryId>((editTx?.category ?? editPlanned?.category ?? defaultCategory ?? 'other') as ExpenseCategoryId)
  const [date, setDate]         = useState(editTx?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [tagIds, setTagIds]     = useState<number[]>(editTx?.tags.map(t => t.id) ?? [])

  useEffect(() => {
    if (!isOpen) return
    if (editTx) {
      setModalTab(editTx.type as ModalTab)
      setAmount(editTx.amount.toString())
      setDescription(editTx.description)
      setCategory((editTx.category ?? 'other') as ExpenseCategoryId)
      setDate(editTx.date)
      setTagIds(editTx.tags.map(t => t.id))
    } else if (editPlanned) {
      setModalTab('planned')
      setAmount(editPlanned.amount.toString())
      setDescription(editPlanned.description)
      setCategory((editPlanned.category ?? 'other') as ExpenseCategoryId)
      setTagIds([])
    } else {
      setModalTab(defaultTab)
      setAmount('')
      setDescription('')
      setCategory(defaultCategory ?? 'other')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setTagIds([])
    }
  }, [isOpen, editTx, editPlanned]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount.replace(',', '.'))
    if (!num || num <= 0) { toast.error('Введите корректную сумму'); return }
    if (isEdit) {
      if (editTx && onUpdateTx) {
        onUpdateTx(editTx.id, { type: modalTab as 'expense' | 'income', amount: num, description: description.trim(), category: modalTab === 'expense' ? category : null, date, tag_ids: tagIds })
      } else if (editPlanned && onUpdatePlanned) {
        onUpdatePlanned(editPlanned.id, { amount: num, description: description.trim(), category })
      }
    } else {
      if (modalTab === 'planned') {
        onAddPlanned({ amount: num, description: description.trim(), category })
      } else {
        onAddTx({ type: modalTab, amount: num, description: description.trim(), category: modalTab === 'expense' ? category : null, date, tag_ids: tagIds })
      }
    }
    onClose()
  }

  const title = isEdit
    ? (editPlanned ? 'Редактировать план' : 'Редактировать запись')
    : lockedCategory
      ? `Расход в «${getCat(category).label}»`
      : 'Новая статья'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && !lockedCategory && (
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {(['expense', 'income', 'planned'] as ModalTab[]).map(t => (
              <button key={t} type="button" onClick={() => setModalTab(t)} className={clsx('flex-1 py-1.5 text-xs rounded-md font-medium', modalTab === t ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}>
                {t === 'expense' ? 'Расход' : t === 'income' ? 'Доход' : 'Планируемое'}
              </button>
            ))}
          </div>
        )}
        <Input label="Сумма (₽)" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required autoFocus />
        <DescriptionAutocomplete
          value={description}
          onChange={setDescription}
          suggestions={descriptionSuggestions}
          placeholder={modalTab === 'income' ? 'Напр., Зарплата…' : 'Напр., Продукты…'}
        />
        <div aria-hidden={modalTab === 'income'} style={{ opacity: modalTab === 'income' ? 0 : 1, pointerEvents: modalTab === 'income' ? 'none' : 'auto' }}>
          {lockedCategory ? (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Категория</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: getCat(category).color + '33', color: getCat(category).color }}>
                  <BudgetCategoryIcon id={getCat(category).icon} size={13} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{getCat(category).label}</span>
                <span className="ml-auto text-xs text-gray-400">из лимита</span>
              </div>
            </div>
          ) : (
            <CategoryPicker value={category} onChange={setCategory} />
          )}
        </div>
        <div aria-hidden={modalTab === 'planned'} style={{ opacity: modalTab === 'planned' ? 0 : 1, pointerEvents: modalTab === 'planned' ? 'none' : 'auto' }}>
          <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {modalTab !== 'planned' && (
          <TagPicker allTags={allTags} selectedIds={tagIds} onChange={setTagIds} onCreateTag={onCreateTag} />
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit">{isEdit ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Allocation modal ─────────────────────────────────────────────────────────

function AllocationModal({
  isOpen, onClose, onSave, initial,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (category: ExpenseCategoryId, limit_amount: number) => void
  initial?: { category: ExpenseCategoryId; limit_amount: number }
}) {
  const [category, setCategory] = useState<ExpenseCategoryId>(initial?.category ?? 'other')
  const [amount, setAmount] = useState(initial?.limit_amount.toString() ?? '')

  useEffect(() => {
    if (!isOpen) return
    setCategory(initial?.category ?? 'other')
    setAmount(initial?.limit_amount.toString() ?? '')
  }, [isOpen, initial])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount.replace(',', '.'))
    if (!num || num <= 0) { toast.error('Введите корректную сумму'); return }
    onSave(category, num)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Изменить лимит' : 'Новый лимит'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <CategoryPicker value={category} onChange={setCategory} />
        <Input label="Лимит (₽)" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required autoFocus />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit">Сохранить</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Allocation card ──────────────────────────────────────────────────────────

function AllocationCard({
  alloc, categoryTransactions, categoryPlanned,
  onEdit, onDelete, onAddExpense, onAddPlanned,
  onDeleteTx, onCheckPlanned, onEditPlanned, onDeletePlanned,
}: {
  alloc: AllocationResponse
  categoryTransactions: TransactionResponse[]
  categoryPlanned: PlannedPurchaseResponse[]
  onEdit: () => void
  onDelete: () => void
  onAddExpense: () => void
  onAddPlanned: () => void
  onDeleteTx: (id: number) => void
  onCheckPlanned: (item: PlannedPurchaseResponse) => void
  onEditPlanned: (item: PlannedPurchaseResponse) => void
  onDeletePlanned: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cat = getCat(alloc.category as ExpenseCategoryId)
  const spent = categoryTransactions.reduce((s, t) => s + t.amount, 0)
  const pendingPlanned = categoryPlanned.filter(p => !p.done)
  const plannedAmount = pendingPlanned.reduce((s, p) => s + p.amount, 0)
  const pct = alloc.limit_amount > 0 ? Math.min((spent / alloc.limit_amount) * 100, 100) : 0
  const pctWithPlanned = alloc.limit_amount > 0 ? Math.min(((spent + plannedAmount) / alloc.limit_amount) * 100, 100) : 0
  const remaining = alloc.limit_amount - spent
  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'
  const txCount = categoryTransactions.length
  const pendingCount = pendingPlanned.length

  const expandLabel = [
    txCount > 0 ? `${txCount} ${txCount === 1 ? 'трата' : txCount < 5 ? 'траты' : 'трат'}` : null,
    pendingCount > 0 ? `${pendingCount} в плане` : null,
  ].filter(Boolean).join(' · ') || 'Пусто'

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-xl border transition-all', pct >= 90 ? 'border-red-200 dark:border-red-800/40' : 'border-gray-200 dark:border-gray-700')}>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.color + '22', color: cat.color }}>
            <BudgetCategoryIcon id={cat.icon} size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{cat.label}</span>
              <span className={clsx('text-sm font-bold tabular-nums', remaining >= 0 ? 'text-gray-800 dark:text-gray-100' : 'text-red-500')}>
                {remaining >= 0 ? `${fmt(remaining)} ₽` : `−${fmt(Math.abs(remaining))} ₽`}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-gray-400">потрачено {fmt(spent)} из {fmt(alloc.limit_amount)} ₽</span>
              <span className={clsx('text-xs font-medium', remaining >= 0 ? 'text-gray-400' : 'text-red-400')}>
                {remaining >= 0 ? 'осталось' : 'перерасход'}
              </span>
            </div>
          </div>
          <div className="hidden sm:block flex-shrink-0" title="Траты по дням за последние 14 дней">
            <CategorySparkline
              transactions={categoryTransactions}
              color={cat.color}
              limit={alloc.limit_amount}
              width={72}
              height={22}
            />
          </div>
        </div>

        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
          <div className="h-full rounded-full transition-all duration-500 relative" style={{ width: `${pctWithPlanned}%`, backgroundColor: '#F3F4F6' }}>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: pctWithPlanned > 0 ? `${(pct / pctWithPlanned) * 100}%` : '0%', backgroundColor: barColor }} />
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="flex justify-end mb-1">
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              + {fmt(plannedAmount)} ₽ в плане → остаток {remaining - plannedAmount >= 0 ? fmt(remaining - plannedAmount) : `−${fmt(Math.abs(remaining - plannedAmount))}`} ₽
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <button type="button" onClick={() => setExpanded(e => !e)} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
            </svg>
            {expandLabel}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onEdit} className="text-gray-400 hover:text-amber-500 transition-colors" title="Изменить лимит">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button type="button" onClick={onDelete} className="text-gray-400 hover:text-red-400 transition-colors" title="Удалить лимит">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
            <button type="button" onClick={onAddExpense} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Расход
            </button>
            <button type="button" onClick={onAddPlanned} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              В план
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {txCount > 0 && (
            <div>
              <div className="px-4 pt-2.5 pb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Реальные траты</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {categoryTransactions.map(tx => (
                  <div key={tx.id} className="group/tx flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 dark:text-gray-200 truncate">{tx.description || '—'}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{format(parseISO(tx.date), 'd MMM', { locale: ru })}</span>
                        {tx.tags.map(tag => (
                          <span key={tag.id} className="px-1.5 py-px rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-red-500 dark:text-red-400 flex-shrink-0">−{fmt(tx.amount)} ₽</span>
                    <button type="button" onClick={() => onDeleteTx(tx.id)} className="opacity-0 group-hover/tx:opacity-100 w-5 h-5 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {categoryPlanned.length > 0 && (
            <div className={txCount > 0 ? 'border-t border-dashed border-gray-200 dark:border-gray-600' : ''}>
              <div className="px-4 pt-2.5 pb-1">
                <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Запланировано</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {categoryPlanned.map(item => (
                  <div key={item.id} className="group/p flex items-center gap-3 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onCheckPlanned(item)}
                      title={item.done ? 'Вернуть в план' : 'Перенести в расходы'}
                      className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-violet-400 hover:border-violet-500')}
                    >
                      {item.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>
                    <div className={clsx('flex-1 min-w-0', item.done && 'opacity-50')}>
                      <div className={clsx('text-sm text-gray-800 dark:text-gray-200 truncate', item.done && 'line-through')}>{item.description || '—'}</div>
                    </div>
                    <span className={clsx('text-sm font-semibold tabular-nums flex-shrink-0', item.done ? 'text-gray-400 line-through' : 'text-yellow-600 dark:text-yellow-400')}>
                      ~{fmt(item.amount)} ₽
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover/p:opacity-100 transition-opacity flex-shrink-0">
                      {!item.done && (
                        <button type="button" onClick={() => onEditPlanned(item)} className="w-5 h-5 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-amber-500 transition-colors">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      )}
                      <button type="button" onClick={() => onDeletePlanned(item.id)} className="w-5 h-5 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {txCount === 0 && categoryPlanned.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Трат и планов нет.</p>
          )}

          <div className="flex border-t border-gray-100 dark:border-gray-700 rounded-b-xl overflow-hidden">
            <button type="button" onClick={onAddExpense} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 font-medium transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Добавить расход
            </button>
            <div className="w-px bg-gray-100 dark:bg-gray-700" />
            <button type="button" onClick={onAddPlanned} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 font-medium transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Запланировать
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Month tab ────────────────────────────────────────────────────────────────

function MonthTab({
  transactions, plannedPurchases, allocations, summary,
  onAddAlloc, onEditAlloc, onDeleteAlloc,
  onAddExpenseForCat, onAddPlannedForCat,
  onDeleteTx, onCheckPlanned, onEditPlanned, onDeletePlanned,
  onAddFreeExpense,
}: {
  transactions: TransactionResponse[]
  plannedPurchases: PlannedPurchaseResponse[]
  allocations: AllocationResponse[]
  summary: SummaryResponse | undefined
  onAddAlloc: () => void
  onEditAlloc: (a: AllocationResponse) => void
  onDeleteAlloc: (id: number) => void
  onAddExpenseForCat: (cat: ExpenseCategoryId, lock: boolean) => void
  onAddPlannedForCat: (cat: ExpenseCategoryId) => void
  onDeleteTx: (id: number) => void
  onCheckPlanned: (item: PlannedPurchaseResponse) => void
  onEditPlanned: (item: PlannedPurchaseResponse) => void
  onDeletePlanned: (id: number) => void
  onAddFreeExpense: () => void
}) {
  const totalIncome  = summary?.totals.income ?? transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = summary?.totals.expense ?? transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const allocatedCats = useMemo(() => new Set(allocations.map(a => a.category)), [allocations])

  const txByCategory = useMemo(() => {
    const map = new Map<string, TransactionResponse[]>()
    transactions.filter(t => t.type === 'expense' && t.category).forEach(t => {
      const arr = map.get(t.category!) ?? []; arr.push(t); map.set(t.category!, arr)
    })
    return map
  }, [transactions])

  const plannedByCategory = useMemo(() => {
    const map = new Map<string, PlannedPurchaseResponse[]>()
    plannedPurchases.forEach(p => {
      const key = p.category ?? '__none__'
      const arr = map.get(key) ?? []; arr.push(p); map.set(key, arr)
    })
    return map
  }, [plannedPurchases])

  // Expenses that don't belong to any allocation category
  const freeExpenses = useMemo(() => {
    return transactions.filter(t => t.type === 'expense' && (!t.category || !allocatedCats.has(t.category)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, allocatedCats])

  const orphanPlanned = useMemo(() => {
    return plannedPurchases.filter(p => !p.category || !allocatedCats.has(p.category))
  }, [plannedPurchases, allocatedCats])

  return (
    <div className="space-y-4">
      {/* Pulse strip — days / rate / projection / trend */}
      {summary && <PulseStrip summary={summary} />}

      {/* Income + expense compact row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-medium">Доход</div>
          <div className="mt-0.5 text-lg font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">+{fmt(totalIncome)} ₽</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="text-[10px] uppercase tracking-wide text-red-500 dark:text-red-400 font-medium">Расход</div>
          <div className="mt-0.5 text-lg font-semibold text-red-500 dark:text-red-400 tabular-nums">−{fmt(totalExpense)} ₽</div>
        </div>
      </div>

      {/* Daily spend chart + top categories (side by side on desktop) */}
      {summary && (totalExpense > 0 || allocations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-3">
            <DailySpendChart summary={summary} />
          </div>
          <div className="lg:col-span-2">
            <TopCategories summary={summary} />
          </div>
        </div>
      )}

      {/* Allocation cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Лимиты</h3>
        <Button size="sm" variant="secondary" onClick={onAddAlloc}>+ Лимит</Button>
      </div>

      {allocations.length === 0 && (
        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <div className="mb-2 flex justify-center text-ink-muted">
            <IconTarget size={32} />
          </div>
          <p className="text-sm text-gray-400 font-medium">Лимитов нет</p>
          <p className="text-xs text-gray-400 mt-1">Задайте лимит на категорию — напр., 10 000 ₽ на еду.</p>
          <Button size="sm" className="mt-3" onClick={onAddAlloc}>+ Создать лимит</Button>
        </div>
      )}

      {allocations.map(alloc => (
        <AllocationCard
          key={alloc.id}
          alloc={alloc}
          categoryTransactions={(txByCategory.get(alloc.category) ?? []).sort((a, b) => b.date.localeCompare(a.date))}
          categoryPlanned={(plannedByCategory.get(alloc.category) ?? []).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))}
          onEdit={() => onEditAlloc(alloc)}
          onDelete={() => onDeleteAlloc(alloc.id)}
          onAddExpense={() => onAddExpenseForCat(alloc.category as ExpenseCategoryId, true)}
          onAddPlanned={() => onAddPlannedForCat(alloc.category as ExpenseCategoryId)}
          onDeleteTx={onDeleteTx}
          onCheckPlanned={onCheckPlanned}
          onEditPlanned={onEditPlanned}
          onDeletePlanned={onDeletePlanned}
        />
      ))}

      {/* Free expenses (not covered by any limit) */}
      {(freeExpenses.length > 0 || orphanPlanned.length > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Вне лимитов</span>
            <button type="button" onClick={onAddFreeExpense} className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 font-medium transition-colors">+ Расход</button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {freeExpenses.map(tx => (
              <div key={tx.id} className="group/tx flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getCat(tx.category).color + '22', color: getCat(tx.category).color }}>
                  <BudgetCategoryIcon id={getCat(tx.category).icon} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 dark:text-gray-200 truncate">{tx.description || '—'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CategoryPill id={tx.category} />
                    <span className="text-xs text-gray-400">{format(parseISO(tx.date), 'd MMM', { locale: ru })}</span>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-red-500 dark:text-red-400 flex-shrink-0">−{fmt(tx.amount)} ₽</span>
                <button type="button" onClick={() => onDeleteTx(tx.id)} className="opacity-0 group-hover/tx:opacity-100 w-5 h-5 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all flex-shrink-0">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
            {orphanPlanned.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)).map(item => (
              <div key={item.id} className="group/p flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => onCheckPlanned(item)}
                  className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-yellow-400 hover:border-yellow-500')}
                >
                  {item.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
                <div className={clsx('flex-1 min-w-0', item.done && 'opacity-50')}>
                  <div className={clsx('text-sm text-gray-800 dark:text-gray-200 truncate', item.done && 'line-through')}>{item.description || '—'}</div>
                  {item.category && <CategoryPill id={item.category as ExpenseCategoryId} />}
                </div>
                <span className={clsx('text-sm font-semibold tabular-nums flex-shrink-0', item.done ? 'text-gray-400 line-through' : 'text-yellow-600 dark:text-yellow-400')}>
                  ~{fmt(item.amount)} ₽
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover/p:opacity-100 transition-opacity flex-shrink-0">
                  {!item.done && (
                    <button type="button" onClick={() => onEditPlanned(item)} className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-amber-500 transition-colors">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                  <button type="button" onClick={() => onDeletePlanned(item.id)} className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── History tab ──────────────────────────────────────────────────────────────

const DATE_PRESETS: { key: string; label: string; compute: () => { from: string; to: string } }[] = [
  { key: 'm', label: 'Месяц', compute: () => {
    const n = new Date()
    return {
      from: format(new Date(n.getFullYear(), n.getMonth(), 1), 'yyyy-MM-dd'),
      to: format(new Date(n.getFullYear(), n.getMonth() + 1, 0), 'yyyy-MM-dd'),
    }
  }},
  { key: '30d', label: '30 дней', compute: () => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 29)
    return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') }
  }},
  { key: 'y', label: 'Год', compute: () => {
    const n = new Date()
    return {
      from: `${n.getFullYear()}-01-01`,
      to: `${n.getFullYear()}-12-31`,
    }
  }},
]

function HistoryTab({
  allTags, onEditTx, onDeleteTx,
}: {
  allTags: BudgetTagResponse[]
  onEditTx: (tx: TransactionResponse) => void
  onDeleteTx: (id: number) => void
}) {
  const [typeFilter, setTypeFilter] = useState<'' | 'expense' | 'income'>('')
  const [tagIds, setTagIds] = useState<number[]>([])
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [sort, setSort] = useState<'date' | 'amount'>('date')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const h = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(h)
  }, [q])

  useEffect(() => {
    setOffset(0)
  }, [typeFilter, tagIds.length, qDebounced, from, to, amountMin, amountMax, sort, order])

  const queryArgs = useMemo<HistoryQuery>(() => {
    const obj: HistoryQuery = { limit, offset, sort, order }
    if (typeFilter) obj.type = typeFilter
    if (tagIds.length) obj.tag_ids = tagIds
    if (qDebounced) obj.q = qDebounced
    if (from) obj.from = from
    if (to) obj.to = to
    const aMin = parseFloat(amountMin.replace(',', '.'))
    const aMax = parseFloat(amountMax.replace(',', '.'))
    if (!isNaN(aMin)) obj.amount_min = aMin
    if (!isNaN(aMax)) obj.amount_max = aMax
    return obj
  }, [typeFilter, tagIds, qDebounced, from, to, amountMin, amountMax, sort, order, limit, offset])

  const { data, isFetching } = useBudgetHistory(queryArgs)
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const resetFilters = () => {
    setTypeFilter(''); setTagIds([]); setQ(''); setFrom(''); setTo('')
    setAmountMin(''); setAmountMax(''); setSort('date'); setOrder('desc')
  }

  const applyPreset = (key: string) => {
    const p = DATE_PRESETS.find((x) => x.key === key)
    if (!p) return
    const r = p.compute()
    setFrom(r.from)
    setTo(r.to)
  }

  const handleDownload = async () => {
    try {
      const params: { from?: string; to?: string; type?: 'expense' | 'income' } = {}
      if (from) params.from = from
      if (to) params.to = to
      if (typeFilter) params.type = typeFilter
      await budgetApi.downloadCsv(params)
      toast.success('CSV скачан')
    } catch {
      toast.error('Не удалось скачать CSV')
    }
  }

  const toggleTag = (id: number) =>
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <div className="space-y-3">
      {/* Primary filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {([['', 'Все'], ['expense', 'Расходы'], ['income', 'Доходы']] as [typeof typeFilter, string][]).map(([v, label]) => (
            <button
              key={v || 'all'}
              type="button"
              onClick={() => setTypeFilter(v)}
              className={clsx('px-3 py-1.5 text-xs rounded-md font-medium transition-colors', typeFilter === v ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по описанию…"
          className="flex-1 min-w-[160px] px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400"
        />
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => { setSort('date'); setOrder(sort === 'date' && order === 'desc' ? 'asc' : 'desc') }}
            className={clsx('px-2 py-1.5 text-xs rounded-md font-medium', sort === 'date' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}
            title="Сортировка по дате"
          >
            Дата {sort === 'date' ? (order === 'desc' ? '↓' : '↑') : ''}
          </button>
          <button
            type="button"
            onClick={() => { setSort('amount'); setOrder(sort === 'amount' && order === 'desc' ? 'asc' : 'desc') }}
            className={clsx('px-2 py-1.5 text-xs rounded-md font-medium', sort === 'amount' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}
            title="Сортировка по сумме"
          >
            ₽ {sort === 'amount' ? (order === 'desc' ? '↓' : '↑') : ''}
          </button>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Скачать CSV"
        >
          ⬇ CSV
        </button>
      </div>

      {/* Secondary: dates + amount range + presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">От</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400">До</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400">₽</span>
          <input type="text" inputMode="decimal" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="мин" className="w-16 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none" />
          <span className="text-gray-400">—</span>
          <input type="text" inputMode="decimal" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="макс" className="w-16 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none" />
        </div>
        <div className="flex gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className="px-2 py-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          сбросить
        </button>
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => {
            const active = tagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-all', active ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:opacity-80')}
                style={active ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color + '66' }}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Status line */}
      <div className="text-xs text-gray-400">
        {isFetching ? 'Загрузка…' : `Найдено ${total}`}
      </div>

      {items.length === 0 && !isFetching ? (
        <p className="text-center py-16 text-sm text-gray-400">Ничего не найдено.</p>
      ) : (
        <div className="space-y-2">
          {items.map(tx => (
            <div key={`tx-${tx.id}`} className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getCat(tx.category).color + '22', color: getCat(tx.category).color }}>
                <BudgetCategoryIcon id={getCat(tx.category).icon} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{tx.description || '—'}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {tx.type === 'expense' && <CategoryPill id={tx.category} />}
                  <span className="text-xs text-gray-400">{format(parseISO(tx.date), 'd MMM yyyy', { locale: ru })}</span>
                  {tx.tags.map(tag => (
                    <span key={tag.id} className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                  ))}
                </div>
              </div>
              <span className={clsx('font-semibold tabular-nums flex-shrink-0 text-sm', tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)} ₽
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button type="button" onClick={() => onEditTx(tx)} className="w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-amber-500 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button type="button" onClick={() => onDeleteTx(tx.id)} className="w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          ))}
          {items.length < total && (
            <button
              type="button"
              onClick={() => setOffset((x) => x + limit)}
              disabled={isFetching}
              className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {isFetching ? 'Загрузка…' : `Показать ещё (${total - items.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Year tab ─────────────────────────────────────────────────────────────────

function YearTab({ allTransactions, viewYear }: { allTransactions: TransactionResponse[]; viewYear: number }) {
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

  const tooltipStyle = { fontSize: 12 }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Доходы за год</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{fmt(totalIncome)} ₽</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Расходы за год</div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(totalExpense)} ₽</div>
        </div>
        <div className={clsx('rounded-xl p-4', totalSaved >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20')}>
          <div className={clsx('text-xs font-medium mb-1', totalSaved >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400')}>Отложено</div>
          <div className={clsx('text-xl font-bold tabular-nums', totalSaved >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400')}>
            {totalSaved >= 0 ? '+' : ''}{fmt(totalSaved)} ₽
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Доходы и расходы по месяцам</h3>
        <div style={{ color: 'var(--color-muted)' }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barGap={2}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'currentColor' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${fmt(v)} ₽`} />
              <Bar dataKey="income"  fill="#10B981" radius={[4,4,0,0]} name="Доходы"  maxBarSize={24} />
              <Bar dataKey="expense" fill="#EF4444" radius={[4,4,0,0]} name="Расходы" maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Накопления по месяцам (доход − расход)</h3>
        <div style={{ color: 'var(--color-muted)' }}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'currentColor' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${fmt(v)} ₽`} />
              <Bar dataKey="saved" name="Отложено" maxBarSize={28} radius={[4,4,0,0]}>
                {months.map((m, i) => <Cell key={i} fill={m.saved >= 0 ? '#3B82F6' : '#F97316'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300 w-24 text-right flex-shrink-0">{fmt(cat.value)} ₽</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Расходов за {viewYear} год нет</p>
          )}
        </div>

        {catData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Доля категорий</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                  {catData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${fmt(v)} ₽`, name]} />
                <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
                <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.income > 0 ? `+${fmt(m.income)} ₽` : '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-500 dark:text-red-400">{m.expense > 0 ? `−${fmt(m.expense)} ₽` : '—'}</td>
                <td className={clsx('px-4 py-2 text-right tabular-nums font-medium', m.saved >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400')}>
                  {m.income === 0 && m.expense === 0 ? '—' : `${m.saved >= 0 ? '+' : ''}${fmt(m.saved)} ₽`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'month' | 'history' | 'year'

const TABS: { id: Tab; label: string }[] = [
  { id: 'month',   label: 'Месяц'   },
  { id: 'history', label: 'История' },
  { id: 'year',    label: 'Год'     },
]

export default function BudgetPage() {

  const [tab, setTab]           = useState<Tab>('month')
  const [viewDate, setViewDate] = useState(new Date())
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const { data: transactions = [], isLoading: txLoading } = useTransactions(year, month)
  const { data: plannedPurchases = [] }                   = usePlannedPurchases(year, month)
  const { data: allTransactions = [] }                    = useTransactions()
  const { data: allTags = [] }                            = useBudgetTags()
  const { data: allocations = [] }                        = useAllocations(year, month)
  const { data: summary }                                 = useBudgetSummary(year, month)

  const createTx    = useCreateTransaction()
  const updateTx    = useUpdateTransaction()
  const deleteTx    = useDeleteTransaction()
  const createPlan  = useCreatePlanned()
  const updatePlan  = useUpdatePlanned()
  const deletePlan  = useDeletePlanned()
  const createTag   = useCreateBudgetTag()
  const upsertAlloc = useUpsertAllocation()
  const deleteAlloc = useDeleteAllocation()

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [entryOpen, setEntryOpen]             = useState(false)
  const [entryDefaultTab, setEntryDefaultTab] = useState<ModalTab>('expense')
  const [entryDefaultCat, setEntryDefaultCat] = useState<ExpenseCategoryId | undefined>(undefined)
  const [entryLockCat, setEntryLockCat]       = useState(false)
  const [editTx, setEditTx]                   = useState<TransactionResponse | null>(null)
  const [editPlanned, setEditPlanned]         = useState<PlannedPurchaseResponse | null>(null)
  const [allocOpen, setAllocOpen]             = useState(false)
  const [editAlloc, setEditAlloc]             = useState<AllocationResponse | null>(null)
  const [deleteTarget, setDeleteTarget]       = useState<{ kind: 'tx' | 'planned' | 'alloc'; id: number } | null>(null)
  const [recurringOpen, setRecurringOpen]     = useState(false)
  const [tagManagerOpen, setTagManagerOpen]   = useState(false)
  const [convertPlan, setConvertPlan]         = useState<PlannedPurchaseResponse | null>(null)

  // Keyboard shortcuts: N — new, ←/→ — prev/next period, 1/2/3 — tabs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (target && target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault()
        setEditTx(null); setEditPlanned(null)
        setEntryDefaultTab('expense')
        setEntryDefaultCat(undefined)
        setEntryLockCat(false)
        setEntryOpen(true)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setViewDate((d) => tab === 'year'
          ? new Date(d.getFullYear() - 1, d.getMonth(), 1)
          : new Date(d.getFullYear(), d.getMonth() - 1, 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setViewDate((d) => tab === 'year'
          ? new Date(d.getFullYear() + 1, d.getMonth(), 1)
          : new Date(d.getFullYear(), d.getMonth() + 1, 1))
      } else if (e.key === '1') {
        setTab('month')
      } else if (e.key === '2') {
        setTab('history')
      } else if (e.key === '3') {
        setTab('year')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tab])

  const descriptionSuggestions = useMemo(() => {
    const seen = new Set<string>()
    return allTransactions.reduce<string[]>((acc, t) => {
      if (t.description && !seen.has(t.description)) { seen.add(t.description); acc.push(t.description) }
      return acc
    }, [])
  }, [allTransactions])

  // ─── Open helpers ─────────────────────────────────────────────────────────
  const openAdd = (forceTab: ModalTab = 'expense', forceCategory?: ExpenseCategoryId, lockCat = false) => {
    setEditTx(null); setEditPlanned(null)
    setEntryDefaultTab(forceTab)
    setEntryDefaultCat(forceCategory)
    setEntryLockCat(lockCat)
    setEntryOpen(true)
  }
  const openEditTx = (tx: TransactionResponse) => {
    setEditPlanned(null); setEditTx(tx); setEntryDefaultCat(undefined); setEntryLockCat(false); setEntryOpen(true)
  }
  const openEditPlanned = (item: PlannedPurchaseResponse) => {
    setEditTx(null); setEditPlanned(item); setEntryDefaultCat(undefined); setEntryLockCat(false); setEntryOpen(true)
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleAddTx = (data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string; tag_ids: number[] }) => {
    createTx.mutate(data, {
      onSuccess: () => toast.success(data.type === 'income' ? 'Доход добавлен' : 'Расход добавлен'),
      onError: () => toast.error('Ошибка при добавлении'),
    })
  }

  const handleUpdateTx = (id: number, data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string; tag_ids: number[] }) => {
    updateTx.mutate({ id, data }, {
      onSuccess: () => toast.success('Сохранено'),
      onError: () => toast.error('Ошибка при сохранении'),
    })
  }

  const handleDeleteTx = (id: number) => {
    deleteTx.mutate(id, { onSuccess: () => toast.success('Удалено'), onError: () => toast.error('Ошибка') })
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
      onError: () => toast.error('Ошибка'),
    })
  }

  const handleCheckPlanned = (item: PlannedPurchaseResponse) => {
    if (item.done) {
      toast('Уже в расходах')
      return
    }
    setConvertPlan(item)
  }

  const handleDeletePlanned = (id: number) => {
    deletePlan.mutate(id, { onSuccess: () => toast.success('Удалено'), onError: () => toast.error('Ошибка') })
  }

  const handleCreateTag = (name: string, color: string) => {
    createTag.mutate({ name, color }, {
      onSuccess: () => toast.success(`Тег «${name}» создан`),
      onError: () => toast.error('Ошибка при создании тега'),
    })
  }

  const handleSaveAlloc = (category: ExpenseCategoryId, limit_amount: number) => {
    upsertAlloc.mutate({ year, month, category, limit_amount }, {
      onSuccess: () => toast.success('Лимит сохранён'),
      onError: () => toast.error('Ошибка при сохранении'),
    })
  }

  const handleDeleteAlloc = (id: number) => {
    deleteAlloc.mutate(id, { onSuccess: () => toast.success('Лимит удалён'), onError: () => toast.error('Ошибка') })
  }

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
      </div>

      {/* Tabs + Recurring button */}
      <div className="flex gap-2 items-center">
        <div className="ts-subtabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(tab === t.id && 'active')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setRecurringOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Регулярные платежи"
        >
          <IconRepeat size={14} /> <span className="hidden sm:inline">Регулярные</span>
        </button>
        <button
          type="button"
          onClick={() => setTagManagerOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Теги"
        >
          <IconTag size={14} /> <span className="hidden sm:inline">Теги</span>
        </button>
      </div>

      {/* Quick add bar — visible on Month & History */}
      {(tab === 'month' || tab === 'history') && (
        <QuickAddBar onSubmit={handleAddTx} />
      )}

      {txLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'month' && (
            <MonthTab
              transactions={transactions}
              plannedPurchases={plannedPurchases}
              allocations={allocations}
              summary={summary}
              onAddAlloc={() => { setEditAlloc(null); setAllocOpen(true) }}
              onEditAlloc={a => { setEditAlloc(a); setAllocOpen(true) }}
              onDeleteAlloc={id => setDeleteTarget({ kind: 'alloc', id })}
              onAddExpenseForCat={(cat, lock) => openAdd('expense', cat, lock)}
              onAddPlannedForCat={cat => openAdd('planned', cat)}
              onDeleteTx={id => setDeleteTarget({ kind: 'tx', id })}
              onCheckPlanned={handleCheckPlanned}
              onEditPlanned={openEditPlanned}
              onDeletePlanned={id => setDeleteTarget({ kind: 'planned', id })}
              onAddFreeExpense={() => openAdd('expense')}
            />
          )}
          {tab === 'history' && (
            <HistoryTab
              allTags={allTags}
              onEditTx={openEditTx}
              onDeleteTx={id => setDeleteTarget({ kind: 'tx', id })}
            />
          )}
          {tab === 'year' && <YearTab allTransactions={allTransactions} viewYear={year} />}
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
        allTags={allTags}
        onCreateTag={handleCreateTag}
        defaultCategory={entryDefaultCat}
        lockedCategory={entryLockCat}
        descriptionSuggestions={descriptionSuggestions}
      />

      {/* Allocation modal */}
      <AllocationModal
        isOpen={allocOpen}
        onClose={() => { setAllocOpen(false); setEditAlloc(null) }}
        onSave={handleSaveAlloc}
        initial={editAlloc ? { category: editAlloc.category as ExpenseCategoryId, limit_amount: editAlloc.limit_amount } : undefined}
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
          else if (deleteTarget.kind === 'planned') handleDeletePlanned(deleteTarget.id)
          else if (deleteTarget.kind === 'alloc') handleDeleteAlloc(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />

      {/* Recurring templates manager */}
      <RecurringManager
        isOpen={recurringOpen}
        onClose={() => setRecurringOpen(false)}
      />

      {/* Tag manager */}
      <TagManager
        isOpen={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
      />

      {/* Plan → Transaction convert */}
      <ConvertPlannedModal
        isOpen={convertPlan !== null}
        plan={convertPlan}
        onClose={() => setConvertPlan(null)}
      />

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => openAdd()}
          className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all"
          title="Новая статья"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
  )
}
