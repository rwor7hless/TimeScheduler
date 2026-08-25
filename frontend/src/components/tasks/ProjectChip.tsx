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
          'h-9 narrow:h-11 px-2.5 text-xs font-semibold border transition-colors max-w-[140px] truncate',
          selected
            ? 'border-accent bg-bg-sel text-accent'
            : 'border-line bg-bg-cell text-fg-body hover:border-accent',
        )}
        title={selected ? `Проект: ${label}` : 'Выбрать проект'}
      >
        {label}
      </button>
      {open && (
        <div className="popover absolute right-0 z-40 mt-1 w-56 max-h-64 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setOpen(false)
            }}
            className={clsx(
              'w-full text-left px-3 py-1.5 text-xs',
              selectedId == null
                ? 'bg-bg-sel text-accent'
                : 'text-fg-body hover:bg-bg-raised',
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
                  ? 'bg-bg-sel text-accent'
                  : 'text-fg-body hover:bg-bg-raised',
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
