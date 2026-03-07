import React, { useState, useMemo, useEffect } from 'react'
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
  useBudgetTags,
  useCreateBudgetTag,
  useDeleteBudgetTag,
  useAllocations,
  useUpsertAllocation,
  useDeleteAllocation,
} from '@/hooks/useBudget'
import type { TransactionResponse, PlannedPurchaseResponse, BudgetTagResponse, AllocationResponse } from '@/api/budget'

// ─── Category helpers ────────────────────────────────────────────────────────

function getCat(id: ExpenseCategoryId | null) {
  return EXPENSE_CATEGORIES.find(c => c.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'allocations' | 'expenses' | 'income' | 'history' | 'year'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',     label: 'Обзор'      },
  { id: 'allocations',  label: 'Планирование'},
  { id: 'expenses',     label: 'Расходы'    },
  { id: 'income',       label: 'Доходы'     },
  { id: 'history',      label: 'История'    },
  { id: 'year',         label: 'Год'        },
]

type ModalTab = 'expense' | 'income' | 'planned'

const TAB_TO_MODAL: Partial<Record<Tab, ModalTab>> = {
  expenses: 'expense',
  income: 'income',
  allocations: 'expense',
  history: 'expense',
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
            <span>{cat.icon}</span>
            <span className="truncate">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Tag picker (multi-select) ───────────────────────────────────────────────

function TagPicker({
  allTags,
  selectedIds,
  onChange,
  onCreateTag,
}: {
  allTags: BudgetTagResponse[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  onCreateTag: (name: string, color: string) => void
}) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6B7280')
  const [showCreate, setShowCreate] = useState(false)

  const toggle = (id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

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

// ─── Tag filter row ──────────────────────────────────────────────────────────

function TagFilter({
  allTags,
  activeTagId,
  onSelect,
}: {
  allTags: BudgetTagResponse[]
  activeTagId: number | null
  onSelect: (id: number | null) => void
}) {
  if (allTags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 pb-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={clsx(
          'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
          activeTagId === null
            ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900 border-transparent'
            : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
        )}
      >
        Все
      </button>
      {allTags.map(tag => (
        <button
          key={tag.id}
          type="button"
          onClick={() => onSelect(activeTagId === tag.id ? null : tag.id)}
          className={clsx(
            'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
            activeTagId === tag.id
              ? 'text-white border-transparent'
              : 'text-gray-600 dark:text-gray-300 bg-transparent hover:opacity-80'
          )}
          style={
            activeTagId === tag.id
              ? { backgroundColor: tag.color, borderColor: tag.color }
              : { borderColor: tag.color + '66' }
          }
        >
          {tag.name}
        </button>
      ))}
    </div>
  )
}

// ─── Description autocomplete ────────────────────────────────────────────────

function DescriptionAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
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
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen(o => !o)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
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

// ─── Unified add/edit modal ──────────────────────────────────────────────────

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
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: getCat(category).color + '33' }}>
                  {getCat(category).icon}
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

// ─── Allocation modal ────────────────────────────────────────────────────────

function AllocationModal({
  isOpen,
  onClose,
  onSave,
  initial,
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

// ─── Allocation card (with planned merged in) ─────────────────────────────────

function pluralTx(n: number) {
  return n === 1 ? 'трата' : n < 5 ? 'траты' : 'трат'
}

function AllocationCard({
  alloc,
  categoryTransactions,
  categoryPlanned,
  onEdit,
  onDelete,
  onAddExpense,
  onAddPlanned,
  onDeleteTx,
  onCheckPlanned,
  onEditPlanned,
  onDeletePlanned,
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
  const remainingAfterPlanned = remaining - plannedAmount
  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'
  const txCount = categoryTransactions.length
  const pendingCount = pendingPlanned.length

  const expandLabel = [
    txCount > 0 ? `${txCount} ${pluralTx(txCount)}` : null,
    pendingCount > 0 ? `${pendingCount} в плане` : null,
  ].filter(Boolean).join(' · ') || 'Пусто'

  return (
    <div className={clsx(
      'bg-white dark:bg-gray-800 rounded-xl border transition-all',
      pct >= 90 ? 'border-red-200 dark:border-red-800/40' : 'border-gray-200 dark:border-gray-700',
    )}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: cat.color + '22' }}>
            {cat.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{cat.label}</span>
              <span className={clsx('text-sm font-bold tabular-nums', remaining >= 0 ? 'text-gray-800 dark:text-gray-100' : 'text-red-500')}>
                {remaining >= 0 ? `${remaining.toLocaleString('ru-RU')} ₽` : `−${Math.abs(remaining).toLocaleString('ru-RU')} ₽`}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-gray-400">
                потрачено {spent.toLocaleString('ru-RU')} из {alloc.limit_amount.toLocaleString('ru-RU')} ₽
              </span>
              <span className={clsx('text-xs font-medium', remaining >= 0 ? 'text-gray-400' : 'text-red-400')}>
                {remaining >= 0 ? 'осталось' : 'перерасход'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar — actual spending */}
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
          <div className="h-full rounded-full transition-all duration-500 relative" style={{ width: `${pctWithPlanned}%`, backgroundColor: '#F3F4F6' }}>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: pctWithPlanned > 0 ? `${(pct / pctWithPlanned) * 100}%` : '0%', backgroundColor: barColor }} />
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="flex justify-end mb-1">
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              + {plannedAmount.toLocaleString('ru-RU')} ₽ в плане → остаток {remainingAfterPlanned >= 0 ? remainingAfterPlanned.toLocaleString('ru-RU') : `−${Math.abs(remainingAfterPlanned).toLocaleString('ru-RU')}`} ₽
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
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
            <button type="button" onClick={onAddPlanned} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-white text-xs font-medium transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              В план
            </button>
          </div>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {/* Real transactions */}
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
                    <span className="text-sm font-semibold tabular-nums text-red-500 dark:text-red-400 flex-shrink-0">
                      −{tx.amount.toLocaleString('ru-RU')} ₽
                    </span>
                    <button type="button" onClick={() => onDeleteTx(tx.id)} className="opacity-0 group-hover/tx:opacity-100 w-5 h-5 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Planned items */}
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
                      className={clsx(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-yellow-400 hover:border-yellow-500'
                      )}
                    >
                      {item.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>
                    <div className={clsx('flex-1 min-w-0', item.done && 'opacity-50')}>
                      <div className={clsx('text-sm text-gray-800 dark:text-gray-200 truncate', item.done && 'line-through')}>{item.description || '—'}</div>
                    </div>
                    <span className={clsx('text-sm font-semibold tabular-nums flex-shrink-0', item.done ? 'text-gray-400 line-through' : 'text-yellow-600 dark:text-yellow-400')}>
                      ~{item.amount.toLocaleString('ru-RU')} ₽
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

          {/* Footer actions */}
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

// ─── Planning tab (merged allocations + planned) ──────────────────────────────

function PlanningTab({
  allocations,
  transactions,
  plannedPurchases,
  onAddAlloc,
  onEditAlloc,
  onDeleteAlloc,
  onAddExpenseForCat,
  onAddPlannedForCat,
  onDeleteTx,
  onCheckPlanned,
  onEditPlanned,
  onDeletePlanned,
  onAddPlannedOrphan,
}: {
  allocations: AllocationResponse[]
  transactions: TransactionResponse[]
  plannedPurchases: PlannedPurchaseResponse[]
  onAddAlloc: () => void
  onEditAlloc: (a: AllocationResponse) => void
  onDeleteAlloc: (id: number) => void
  onAddExpenseForCat: (cat: ExpenseCategoryId, lock: boolean) => void
  onAddPlannedForCat: (cat: ExpenseCategoryId) => void
  onDeleteTx: (id: number) => void
  onCheckPlanned: (item: PlannedPurchaseResponse) => void
  onEditPlanned: (item: PlannedPurchaseResponse) => void
  onDeletePlanned: (id: number) => void
  onAddPlannedOrphan: () => void
}) {
  const allocatedCategories = useMemo(() => new Set(allocations.map(a => a.category)), [allocations])

  const txByCategory = useMemo(() => {
    const map = new Map<string, TransactionResponse[]>()
    transactions.filter(t => t.type === 'expense' && t.category).forEach(t => {
      const arr = map.get(t.category!) ?? []
      arr.push(t)
      map.set(t.category!, arr)
    })
    return map
  }, [transactions])

  const plannedByCategory = useMemo(() => {
    const map = new Map<string, PlannedPurchaseResponse[]>()
    plannedPurchases.forEach(p => {
      const key = p.category ?? '__none__'
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    })
    return map
  }, [plannedPurchases])

  // Planned items that don't belong to any allocation
  const orphanPlanned = useMemo(() => {
    return plannedPurchases.filter(p => !p.category || !allocatedCategories.has(p.category))
  }, [plannedPurchases, allocatedCategories])

  const totalBudgeted = allocations.reduce((s, a) => s + a.limit_amount, 0)
  const totalSpent = allocations.reduce((s, a) => s + (txByCategory.get(a.category) ?? []).reduce((ss, t) => ss + t.amount, 0), 0)
  const totalPending = allocations.reduce((s, a) => {
    return s + (plannedByCategory.get(a.category) ?? []).filter(p => !p.done).reduce((ss, p) => ss + p.amount, 0)
  }, 0)

  return (
    <div className="space-y-3">
      {/* Summary */}
      {allocations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Бюджет месяца</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
              {totalSpent.toLocaleString('ru-RU')} / {totalBudgeted.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
            {/* planned layer */}
            <div className="absolute inset-0 rounded-full" style={{ width: `${totalBudgeted > 0 ? Math.min(((totalSpent + totalPending) / totalBudgeted) * 100, 100) : 0}%`, backgroundColor: '#FEF08A' }} />
            {/* spent layer */}
            <div className="absolute inset-0 rounded-full transition-all duration-500" style={{
              width: `${totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0}%`,
              backgroundColor: totalBudgeted > 0 && totalSpent / totalBudgeted >= 0.9 ? '#EF4444' : totalBudgeted > 0 && totalSpent / totalBudgeted >= 0.7 ? '#F59E0B' : '#10B981',
            }} />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-gray-400">
            <span>потрачено {totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0}%</span>
            {totalPending > 0 && <span className="text-yellow-600 dark:text-yellow-400">+ {totalPending.toLocaleString('ru-RU')} ₽ в плане</span>}
            <span>осталось {(totalBudgeted - totalSpent).toLocaleString('ru-RU')} ₽</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {allocations.length > 0 ? 'Раскройте карточку для трат и планов.' : 'Задайте лимиты и добавьте планы.'}
        </p>
        <Button size="sm" variant="secondary" onClick={onAddAlloc}>+ Лимит</Button>
      </div>

      {allocations.length === 0 && orphanPlanned.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-sm text-gray-400 font-medium">Начните планировать бюджет</p>
          <p className="text-xs text-gray-400 mt-1">Создайте лимит (напр. 10 000 ₽ на еду) и добавьте планируемые покупки.</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button size="sm" onClick={onAddAlloc}>+ Лимит</Button>
            <Button size="sm" variant="secondary" onClick={onAddPlannedOrphan}>+ Планируемое</Button>
          </div>
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

      {/* Orphan planned (no matching allocation) */}
      {orphanPlanned.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Прочие планы</span>
            <button type="button" onClick={onAddPlannedOrphan} className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 font-medium transition-colors">+ Добавить</button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
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
                  ~{item.amount.toLocaleString('ru-RU')} ₽
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

// ─── Small display components ─────────────────────────────────────────────────

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

// ─── Transaction card ─────────────────────────────────────────────────────────

function TransactionCard({ tx, dim, onEdit, onDelete }: { tx: TransactionResponse & { dim?: boolean; tags?: BudgetTagResponse[] }; dim?: boolean; onEdit: () => void; onDelete: () => void }) {
  const tags = tx.tags ?? []
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
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <CategoryPill id={tx.category} />
          <span className="text-xs text-gray-400 dark:text-gray-500">{format(parseISO(tx.date), 'd MMM', { locale: ru })}</span>
          {tags.map(tag => (
            <span key={tag.id} className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>
              {tag.name}
            </span>
          ))}
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


// ─── Overview tab ─────────────────────────────────────────────────────────────

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

// ─── Year tab ─────────────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [tab, setTab] = useState<Tab>('overview')
  const [viewDate, setViewDate] = useState(new Date())
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth() // 0-based

  const { data: transactions = [], isLoading: txLoading } = useTransactions(year, month)
  const { data: plannedPurchases = [] } = usePlannedPurchases(year, month)
  const { data: allTransactions = [] } = useTransactions()
  const { data: allTags = [] } = useBudgetTags()
  const { data: allocations = [] } = useAllocations(year, month)

  const createTx      = useCreateTransaction()
  const updateTx      = useUpdateTransaction()
  const deleteTx      = useDeleteTransaction()
  const createPlan    = useCreatePlanned()
  const updatePlan    = useUpdatePlanned()
  const deletePlan    = useDeletePlanned()
  const createTag     = useCreateBudgetTag()
  const deleteTag     = useDeleteBudgetTag()
  const upsertAlloc   = useUpsertAllocation()
  const deleteAlloc   = useDeleteAllocation()

  // ─── Entry modal state ────────────────────────────────────────────────────
  const [entryOpen, setEntryOpen]             = useState(false)
  const [entryDefaultTab, setEntryDefaultTab] = useState<ModalTab>('expense')
  const [entryDefaultCat, setEntryDefaultCat] = useState<ExpenseCategoryId | undefined>(undefined)
  const [entryLockCat, setEntryLockCat]       = useState(false)
  const [editTx, setEditTx]                   = useState<TransactionResponse | null>(null)
  const [editPlanned, setEditPlanned]         = useState<PlannedPurchaseResponse | null>(null)

  // Description suggestions from all transactions (unique non-empty descriptions)
  const descriptionSuggestions = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const t of allTransactions) {
      if (t.description && !seen.has(t.description)) {
        seen.add(t.description)
        result.push(t.description)
      }
    }
    return result
  }, [allTransactions])

  // ─── Allocation modal state ───────────────────────────────────────────────
  const [allocOpen, setAllocOpen] = useState(false)
  const [editAlloc, setEditAlloc] = useState<AllocationResponse | null>(null)

  // ─── Tag filter state ─────────────────────────────────────────────────────
  const [filterTagId, setFilterTagId] = useState<number | null>(null)

  // ─── Smart modal open ─────────────────────────────────────────────────────
  const openAdd = (forceTab?: ModalTab, forceCategory?: ExpenseCategoryId, lockCat = false) => {
    setEditTx(null)
    setEditPlanned(null)
    setEntryDefaultTab(forceTab ?? TAB_TO_MODAL[tab] ?? 'expense')
    setEntryDefaultCat(forceCategory)
    setEntryLockCat(lockCat)
    setEntryOpen(true)
  }
  const openEditTx = (tx: TransactionResponse) => { setEditPlanned(null); setEditTx(tx); setEntryDefaultCat(undefined); setEntryLockCat(false); setEntryOpen(true) }
  const openEditPlanned = (item: PlannedPurchaseResponse) => { setEditTx(null); setEditPlanned(item); setEntryDefaultCat(undefined); setEntryLockCat(false); setEntryOpen(true) }

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'tx' | 'planned' | 'alloc' | 'tag'; id: number } | null>(null)

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleAddTx = (data: { type: 'expense' | 'income'; amount: number; category: ExpenseCategoryId | null; description: string; date: string; tag_ids: number[] }) => {
    createTx.mutate({ ...data }, {
      onSuccess: () => toast.success(`${data.type === 'income' ? 'Доход' : 'Расход'} добавлен`),
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
      updatePlan.mutate({ id: item.id, data: { done: false } })
    } else {
      createTx.mutate({
        type: 'expense',
        amount: item.amount,
        category: item.category,
        description: item.description,
        date: format(new Date(), 'yyyy-MM-dd'),
        tag_ids: [],
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

  const handleCreateTag = (name: string, color: string) => {
    createTag.mutate({ name, color }, {
      onSuccess: () => toast.success(`Тег «${name}» создан`),
      onError: () => toast.error('Ошибка при создании тега'),
    })
  }

  const handleDeleteTag = (id: number) => {
    deleteTag.mutate(id, {
      onSuccess: () => {
        toast.success('Тег удалён')
        if (filterTagId === id) setFilterTagId(null)
      },
      onError: () => toast.error('Ошибка при удалении тега'),
    })
  }

  const handleSaveAlloc = (category: ExpenseCategoryId, limit_amount: number) => {
    upsertAlloc.mutate({ year, month, category, limit_amount }, {
      onSuccess: () => toast.success('Лимит сохранён'),
      onError: () => toast.error('Ошибка при сохранении лимита'),
    })
  }

  const handleDeleteAlloc = (id: number) => {
    deleteAlloc.mutate(id, {
      onSuccess: () => toast.success('Лимит удалён'),
      onError: () => toast.error('Ошибка при удалении'),
    })
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const filterByTag = (txs: TransactionResponse[]) => {
    if (!filterTagId) return txs
    return txs.filter(t => t.tags.some(tag => tag.id === filterTagId))
  }

  const expenses = filterByTag(transactions.filter(t => t.type === 'expense').slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
  const incomes  = filterByTag(transactions.filter(t => t.type === 'income').slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))

  const historyTx = useMemo(() => {
    const real = transactions.map(t => ({ ...t, dim: false }))
    const pendingVirtual = plannedPurchases.filter(p => !p.done).map(p => ({
      id: -(p.id),
      type: 'expense' as const,
      amount: p.amount,
      category: p.category,
      description: p.description,
      date: format(new Date(), 'yyyy-MM-dd'),
      created_at: p.created_at,
      tags: [] as BudgetTagResponse[],
      dim: true,
      _plannedId: p.id,
    }))
    return filterByTag([...real, ...pendingVirtual]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [transactions, plannedPurchases, filterTagId]) // eslint-disable-line react-hooks/exhaustive-deps

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

          {tab === 'allocations' && (
            <PlanningTab
              allocations={allocations}
              transactions={transactions}
              plannedPurchases={plannedPurchases}
              onAddAlloc={() => { setEditAlloc(null); setAllocOpen(true) }}
              onEditAlloc={a => { setEditAlloc(a); setAllocOpen(true) }}
              onDeleteAlloc={id => setDeleteTarget({ kind: 'alloc', id })}
              onAddExpenseForCat={(cat, lock) => openAdd('expense', cat, lock)}
              onAddPlannedForCat={cat => openAdd('planned', cat)}
              onDeleteTx={id => setDeleteTarget({ kind: 'tx', id })}
              onCheckPlanned={handleCheckPlanned}
              onEditPlanned={openEditPlanned}
              onDeletePlanned={id => setDeleteTarget({ kind: 'planned', id })}
              onAddPlannedOrphan={() => openAdd('planned')}
            />
          )}

          {tab === 'expenses' && (
            <div className="space-y-2">
              <TagFilter allTags={allTags} activeTagId={filterTagId} onSelect={setFilterTagId} />
              {expenses.length === 0 ? <p className="text-center py-16 text-sm text-gray-400">{filterTagId ? 'Нет расходов с выбранным тегом.' : 'Расходов нет.'}</p> : expenses.map(tx => (
                <TransactionCard key={tx.id} tx={tx} onEdit={() => openEditTx(tx)} onDelete={() => setDeleteTarget({ kind: 'tx', id: tx.id })} />
              ))}
            </div>
          )}

          {tab === 'income' && (
            <div className="space-y-2">
              <TagFilter allTags={allTags} activeTagId={filterTagId} onSelect={setFilterTagId} />
              {incomes.length === 0 ? <p className="text-center py-16 text-sm text-gray-400">{filterTagId ? 'Нет доходов с выбранным тегом.' : 'Доходов нет.'}</p> : incomes.map(tx => (
                <TransactionCard key={tx.id} tx={tx} onEdit={() => openEditTx(tx)} onDelete={() => setDeleteTarget({ kind: 'tx', id: tx.id })} />
              ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              <TagFilter allTags={allTags} activeTagId={filterTagId} onSelect={setFilterTagId} />
              <p className="text-xs text-gray-500 dark:text-gray-400">Жёлтым — предстоящие (планируемые) траты.</p>
              {historyTx.length === 0 ? <p className="text-center py-16 text-sm text-gray-400">История пуста.</p> : historyTx.map(tx => (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  dim={(tx as { dim?: boolean }).dim}
                  onEdit={() => { if (!(tx as { dim?: boolean }).dim) openEditTx(tx as TransactionResponse) }}
                  onDelete={() => {
                    if ((tx as { dim?: boolean }).dim && '_plannedId' in tx) setDeleteTarget({ kind: 'planned', id: (tx as { _plannedId: number })._plannedId })
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
          else if (deleteTarget.kind === 'tag') handleDeleteTag(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />

      {/* Floating FAB */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
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
