import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { useConvertPlanned } from '@/hooks/useBudget'
import type { PlannedPurchaseResponse } from '@/api/budget'

interface Props {
  isOpen: boolean
  plan: PlannedPurchaseResponse | null
  onClose: () => void
}

export default function ConvertPlannedModal({ isOpen, plan, onClose }: Props) {
  const convert = useConvertPlanned()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    if (isOpen && plan) {
      setAmount(plan.amount.toString())
      setDate(format(new Date(), 'yyyy-MM-dd'))
    }
  }, [isOpen, plan])

  if (!plan) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount.replace(',', '.'))
    if (!num || num <= 0) { toast.error('Введите сумму'); return }
    convert.mutate(
      { id: plan.id, data: { amount: num, date } },
      {
        onSuccess: () => {
          toast.success('Перенесено в расходы')
          onClose()
        },
        onError: () => toast.error('Ошибка'),
      },
    )
  }

  const diff = parseFloat(amount.replace(',', '.')) - plan.amount
  const diffAbs = Math.round(Math.abs(diff))
  const diffPct = plan.amount > 0 ? Math.round((Math.abs(diff) / plan.amount) * 100) : 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="В расходы">
      <form onSubmit={submit} className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          «{plan.description || '—'}»
          {plan.category && <span className="text-gray-400"> · {plan.category}</span>}
        </div>
        <Input
          label={`Сумма (план ~${plan.amount.toLocaleString('ru-RU')} ₽)`}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        {!isNaN(diff) && Math.abs(diff) > 0.01 && (
          <div className={diff > 0 ? 'text-xs text-red-500' : 'text-xs text-emerald-600 dark:text-emerald-400'}>
            {diff > 0 ? '+' : '−'}{diffAbs} ₽ ({diffPct}%) от плана
          </div>
        )}
        <Input
          label="Дата"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit">Записать</Button>
        </div>
      </form>
    </Modal>
  )
}
