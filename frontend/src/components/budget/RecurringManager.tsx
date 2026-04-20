import { useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from '@/types/budget'
import {
  useRecurring,
  useCreateRecurring,
  useUpdateRecurring,
  useDeleteRecurring,
} from '@/hooks/useBudget'
import type { RecurringResponse } from '@/api/budget'

function fmt(n: number) { return n.toLocaleString('ru-RU') }

function getCat(id: string | null | undefined) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function RecurringManager({ isOpen, onClose }: Props) {
  const { data: templates = [] } = useRecurring()
  const create = useCreateRecurring()
  const update = useUpdateRecurring()
  const del = useDeleteRecurring()

  const [editing, setEditing] = useState<RecurringResponse | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (tpl: RecurringResponse) => { setEditing(tpl); setFormOpen(true) }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Регулярные платежи">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Автосоздание транзакций в указанный день каждого месяца.
            </p>
            <Button size="sm" onClick={openCreate}>+ Добавить</Button>
          </div>

          {templates.length === 0 && (
            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="text-3xl mb-2">🔄</div>
              <p className="text-sm text-gray-400">Шаблонов нет.</p>
              <p className="text-xs text-gray-400 mt-1">Напр., аренда 50 000 ₽ первого числа.</p>
            </div>
          )}

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {templates.map((tpl) => {
              const cat = getCat(tpl.category)
              return (
                <div key={tpl.id} className={clsx(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  tpl.is_paused
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 opacity-60'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                )}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0" style={{ backgroundColor: cat.color + '22' }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {tpl.description || cat.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {tpl.day_of_month}-го числа · {tpl.type === 'income' ? '+' : '−'}{fmt(tpl.amount)} ₽
                      {tpl.last_generated_date && <span className="ml-2 text-gray-400">· посл. {tpl.last_generated_date}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: tpl.id, data: { is_paused: !tpl.is_paused } })}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1"
                    title={tpl.is_paused ? 'Возобновить' : 'Пауза'}
                  >
                    {tpl.is_paused ? '▶' : '❚❚'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(tpl)}
                    className="text-gray-400 hover:text-amber-500 p-1"
                    title="Редактировать"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(tpl.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Удалить"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      <RecurringForm
        key={formOpen ? `form-${editing?.id ?? 'new'}` : 'closed'}
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        editing={editing}
        onCreate={(data) => {
          create.mutate(data, {
            onSuccess: () => { toast.success('Шаблон создан'); setFormOpen(false) },
            onError: () => toast.error('Ошибка при создании'),
          })
        }}
        onUpdate={(id, data) => {
          update.mutate({ id, data }, {
            onSuccess: () => { toast.success('Сохранено'); setFormOpen(false); setEditing(null) },
            onError: () => toast.error('Ошибка при сохранении'),
          })
        }}
      />

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Удалить шаблон?"
        message="Ранее созданные транзакции останутся в истории."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={async () => {
          if (!deleteId) return
          del.mutate(deleteId, {
            onSuccess: () => toast.success('Удалено'),
            onError: () => toast.error('Ошибка'),
          })
          setDeleteId(null)
        }}
      />
    </>
  )
}

function RecurringForm({
  isOpen, onClose, editing, onCreate, onUpdate,
}: {
  isOpen: boolean
  onClose: () => void
  editing: RecurringResponse | null
  onCreate: (data: { type: 'expense' | 'income'; amount: number; category: string | null; description: string; day_of_month: number; start_date: string; is_paused: boolean }) => void
  onUpdate: (id: number, data: { amount: number; category: string | null; description: string; day_of_month: number; is_paused: boolean }) => void
}) {
  const [type, setType] = useState<'expense' | 'income'>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing?.amount.toString() ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [category, setCategory] = useState<ExpenseCategoryId>((editing?.category as ExpenseCategoryId) ?? 'other')
  const [day, setDay] = useState(editing?.day_of_month?.toString() ?? '1')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount.replace(',', '.'))
    const d = parseInt(day, 10)
    if (!num || num <= 0) { toast.error('Введите сумму'); return }
    if (!d || d < 1 || d > 31) { toast.error('День — число от 1 до 31'); return }

    if (editing) {
      onUpdate(editing.id, {
        amount: num,
        category: type === 'expense' ? category : null,
        description: description.trim(),
        day_of_month: d,
        is_paused: editing.is_paused,
      })
    } else {
      onCreate({
        type,
        amount: num,
        category: type === 'expense' ? category : null,
        description: description.trim(),
        day_of_month: d,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        is_paused: false,
      })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Изменить шаблон' : 'Новый шаблон'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editing && (
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={clsx(
                  'flex-1 py-1.5 text-xs rounded-md font-medium',
                  type === t ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
                )}
              >
                {t === 'expense' ? 'Расход' : 'Доход'}
              </button>
            ))}
          </div>
        )}
        <Input label="Сумма (₽)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required autoFocus />
        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Напр., Аренда" />
        <Input label="День месяца" type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} required />
        {type === 'expense' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Категория</label>
            <div className="grid grid-cols-3 gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium',
                    category === c.id ? 'border-transparent text-white shadow-sm' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400',
                  )}
                  style={category === c.id ? { backgroundColor: c.color } : undefined}
                >
                  <span>{c.icon}</span>
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit">{editing ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </form>
    </Modal>
  )
}
