import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { Board } from '@/types/board'

interface ProjectChipProps {
  boards: Board[]
  selectedId: number | null
  onSelect: (id: number | null) => void
}

/**
 * Compact project picker for the quick-add bar. Renders a small chip whose
 * label is the selected project name (or "Без проекта"). Click opens a
 * vertical dropdown of all owned boards plus a "Без проекта" entry.
 *
 * Closing: clicking outside, picking an item, or pressing Escape.
 */
export default function ProjectChip({ boards, selectedId, onSelect }: ProjectChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = selectedId == null ? null : boards.find((b) => b.id === selectedId) ?? null
  const label = selected ? selected.name : 'Без проекта'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'h-9 px-2.5 rounded-xl text-xs font-semibold border transition-colors max-w-[140px] truncate',
          selected
            ? 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-500 dark:bg-amber-900/50 dark:text-amber-200'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-amber-400 dark:hover:border-amber-500',
        )}
        title={selected ? `Проект: ${label}` : 'Выбрать проект'}
      >
        {label}
      </button>
      {open && (
        <div className="popover absolute right-0 z-40 mt-1 w-56 max-h-64 overflow-y-auto rounded-xl py-1">
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setOpen(false)
            }}
            className={clsx(
              'w-full text-left px-3 py-1.5 text-xs',
              selectedId == null
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60',
            )}
          >
            Без проекта
          </button>
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                onSelect(b.id)
                setOpen(false)
              }}
              className={clsx(
                'w-full text-left px-3 py-1.5 text-xs truncate',
                selectedId === b.id
                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60',
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
