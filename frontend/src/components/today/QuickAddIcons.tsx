import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

export interface QuickAddOverrides {
  scheduledDate: string | null // YYYY-MM-DD
  startTime: string | null // HH:MM
  endTime: string | null // HH:MM
  deadline: string | null // YYYY-MM-DD
  repeatDays: number[] // 0=Mon..6=Sun
}

export const EMPTY_OVERRIDES: QuickAddOverrides = {
  scheduledDate: null,
  startTime: null,
  endTime: null,
  deadline: null,
  repeatDays: [],
}

const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const

interface Props {
  value: QuickAddOverrides
  onChange: (next: QuickAddOverrides) => void
}

/** Two transparent icon buttons (date + repeat) inline with the today quick-add input.
 *  Click toggles a small popover anchored under each. Highlights when value is set. */
export default function QuickAddIcons({ value, onChange }: Props) {
  const [open, setOpen] = useState<'date' | 'repeat' | null>(null)
  const dateRef = useRef<HTMLDivElement>(null)
  const repeatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (dateRef.current?.contains(t) || repeatRef.current?.contains(t)) return
      setOpen(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const dateActive =
    value.scheduledDate !== null ||
    value.startTime !== null ||
    value.endTime !== null ||
    value.deadline !== null
  const repeatActive = value.repeatDays.length > 0

  const iconClasses = (active: boolean) =>
    clsx(
      'p-2 rounded-xl border transition-colors',
      active
        ? 'border-amber-400 text-amber-500 bg-amber-50 dark:bg-amber-900/20'
        : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
    )

  return (
    <>
      <div ref={dateRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => (o === 'date' ? null : 'date'))}
          title="Дата и дедлайн"
          aria-label="Дата и дедлайн"
          className={iconClasses(dateActive || open === 'date')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
        </button>
        {open === 'date' && (
          <div className="popover-glass absolute right-0 z-40 mt-2 w-72 rounded-xl p-3 space-y-2 text-sm">
            <div>
              <label className="block text-[11px] uppercase opacity-60 mb-1 tracking-wider">Дата</label>
              <input
                type="date"
                value={value.scheduledDate ?? ''}
                onChange={(e) =>
                  onChange({ ...value, scheduledDate: e.target.value || null })
                }
                className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] uppercase opacity-60 mb-1 tracking-wider">Начало</label>
                <input
                  type="time"
                  value={value.startTime ?? ''}
                  onChange={(e) =>
                    onChange({ ...value, startTime: e.target.value || null })
                  }
                  className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase opacity-60 mb-1 tracking-wider">Конец</label>
                <input
                  type="time"
                  value={value.endTime ?? ''}
                  onChange={(e) =>
                    onChange({ ...value, endTime: e.target.value || null })
                  }
                  className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase opacity-60 mb-1 tracking-wider">Дедлайн</label>
              <input
                type="date"
                value={value.deadline ?? ''}
                onChange={(e) =>
                  onChange({ ...value, deadline: e.target.value || null })
                }
                className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-transparent"
              />
            </div>
            <div className="flex justify-between pt-1">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    scheduledDate: null,
                    startTime: null,
                    endTime: null,
                    deadline: null,
                  })
                }
                className="text-xs opacity-60 hover:opacity-100"
              >
                Сбросить
              </button>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="text-xs text-amber-500 hover:underline"
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </div>

      <div ref={repeatRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => (o === 'repeat' ? null : 'repeat'))}
          title="Повторение"
          aria-label="Повторение"
          className={iconClasses(repeatActive || open === 'repeat')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>
        {open === 'repeat' && (
          <div className="popover-glass absolute right-0 z-40 mt-2 w-72 rounded-xl p-3 space-y-2 text-sm">
            <div className="text-[11px] uppercase opacity-60 tracking-wider">Повторять по дням</div>
            <div className="flex gap-1">
              {WEEKDAYS.map((label, i) => {
                const active = value.repeatDays.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? value.repeatDays.filter((d) => d !== i)
                        : [...value.repeatDays, i].sort((a, b) => a - b)
                      onChange({ ...value, repeatDays: next })
                    }}
                    className={clsx(
                      'flex-1 min-w-[34px] py-1 rounded border text-[11px] font-medium transition-colors',
                      active
                        ? 'border-amber-400 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-500',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] opacity-60">
              Задача будет повторяться в выбранные дни недели.
            </p>
            <div className="flex justify-between pt-1">
              <button
                type="button"
                onClick={() => onChange({ ...value, repeatDays: [] })}
                className="text-xs opacity-60 hover:opacity-100"
              >
                Сбросить
              </button>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="text-xs text-amber-500 hover:underline"
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
