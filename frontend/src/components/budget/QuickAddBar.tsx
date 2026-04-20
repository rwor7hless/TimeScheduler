import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from '@/types/budget'
import { parseBudgetInput, buildBudgetSegments } from '@/utils/parseBudget'
import { friendlyDate } from '@/utils/parseTask'
import { useBudgetTags } from '@/hooks/useBudget'

interface Props {
  onSubmit: (data: {
    type: 'expense' | 'income'
    amount: number
    category: ExpenseCategoryId | null
    description: string
    date: string
    tag_ids: number[]
  }) => void
  autoFocusOnMount?: boolean
}

function getCat(id: ExpenseCategoryId | null) {
  if (!id) return null
  return EXPENSE_CATEGORIES.find((c) => c.id === id) ?? null
}

export default function QuickAddBar({ onSubmit, autoFocusOnMount }: Props) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const { data: allTags = [] } = useBudgetTags()

  const today = useMemo(() => new Date(), [])
  const todayStr = format(today, 'yyyy-MM-dd')

  useEffect(() => {
    if (autoFocusOnMount) inputRef.current?.focus()
  }, [autoFocusOnMount])

  const parsed = useMemo(() => {
    if (!input.trim()) return null
    return parseBudgetInput(input, today)
  }, [input, today])

  const matchedTagIds = useMemo(() => {
    if (!parsed) return []
    const ids: number[] = []
    for (const name of parsed.tagNames) {
      const t = allTags.find((x) => x.name.toLowerCase() === name.toLowerCase())
      if (t) ids.push(t.id)
    }
    return ids
  }, [parsed, allTags])

  const submit = () => {
    if (!parsed || parsed.amount === null) {
      toast.error('Укажи сумму')
      inputRef.current?.focus()
      return
    }
    const date = parsed.date ?? todayStr
    onSubmit({
      type: parsed.type,
      amount: parsed.amount,
      category: parsed.type === 'income' ? null : parsed.category,
      description: parsed.description,
      date,
      tag_ids: matchedTagIds,
    })
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  const handleScroll = () => {
    if (backdropRef.current && inputRef.current) {
      backdropRef.current.scrollLeft = inputRef.current.scrollLeft
    }
  }

  const cat = parsed ? getCat(parsed.category) : null
  const unknownTags = parsed
    ? parsed.tagNames.filter((n) => !allTags.some((t) => t.name.toLowerCase() === n.toLowerCase()))
    : []

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {/* Transparent input + highlighted backdrop (same pattern as TodayPage) */}
        <div className="relative flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus-within:border-blue-400 dark:focus-within:border-blue-500 transition-colors">
          <div
            ref={backdropRef}
            aria-hidden
            className="absolute inset-0 px-3 py-2 text-sm pointer-events-none select-none overflow-hidden whitespace-pre rounded-xl"
          >
            {input === '' ? (
              <span className="text-gray-400 dark:text-gray-500">
                350 обед вчера #работа
              </span>
            ) : (
              buildBudgetSegments(input, parsed?.spans ?? []).map((seg, i) =>
                seg.highlighted ? (
                  <span
                    key={i}
                    className="text-gray-900 dark:text-gray-100 underline decoration-blue-400 decoration-2 underline-offset-2"
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={i} className="text-gray-900 dark:text-gray-100">{seg.text}</span>
                ),
              )
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onScroll={handleScroll}
            className="quick-add relative w-full text-sm px-3 py-2 rounded-xl bg-transparent border-0 text-transparent caret-gray-900 dark:caret-gray-100 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!parsed || parsed.amount === null}
          className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          title="Добавить (Enter)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Preview row */}
      {parsed && input.trim() && (
        <div className="flex items-center gap-1.5 px-1 flex-wrap text-xs">
          {parsed.amount !== null && (
            <span className={
              parsed.type === 'income'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold tabular-nums'
                : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold tabular-nums'
            }>
              {parsed.type === 'income' ? '+' : '−'}{parsed.amount.toLocaleString('ru-RU')} ₽
            </span>
          )}
          {cat && parsed.type === 'expense' && (
            <span
              className="px-1.5 py-0.5 rounded-full text-white text-[11px] font-medium"
              style={{ backgroundColor: cat.color }}
            >
              {cat.icon} {cat.label}
            </span>
          )}
          {parsed.date && (
            <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
              {friendlyDate(parsed.date, todayStr)}
            </span>
          )}
          {matchedTagIds.map((id) => {
            const tag = allTags.find((t) => t.id === id)
            if (!tag) return null
            return (
              <span key={tag.id} className="px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: tag.color }}>
                {tag.name}
              </span>
            )
          })}
          {unknownTags.map((name) => (
            <span key={name} className="px-1.5 py-0.5 rounded-full text-gray-400 border border-dashed border-gray-300 dark:border-gray-600" title="Тег не найден">
              #{name}
            </span>
          ))}
          {parsed.description && (
            <span className="text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
              «{parsed.description}»
            </span>
          )}
          {parsed.amount === null && (
            <span className="text-red-500">нужна сумма</span>
          )}
        </div>
      )}
    </div>
  )
}
