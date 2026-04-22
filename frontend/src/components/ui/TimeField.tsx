import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

interface TimeFieldProps {
  value: string
  onChange: (value: string) => void
  /** 'primary' (indigo accent) | 'danger' (red accent) */
  tone?: 'primary' | 'danger'
  /** Шаг минут: 5, 10, 15, 30. По умолчанию 5. */
  minuteStep?: 5 | 10 | 15 | 30
  className?: string
  disabled?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

const POPOVER_WIDTH = 168
const POPOVER_HEIGHT = 200  // 192 max-h колонок + паддинги
const GAP = 4

export default function TimeField({
  value,
  onChange,
  tone = 'primary',
  minuteStep = 5,
  className,
  disabled,
}: TimeFieldProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const hourColRef = useRef<HTMLDivElement>(null)
  const minuteColRef = useRef<HTMLDivElement>(null)

  const [h = '09', m = '00'] = (value || '09:00').split(':')
  const hourNum = Math.max(0, Math.min(23, parseInt(h, 10) || 0))
  const minuteRaw = parseInt(m, 10) || 0
  const minuteNum = Math.round(minuteRaw / minuteStep) * minuteStep % 60

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep)

  // Закрытие по клику вне и Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      const inRoot = rootRef.current?.contains(target)
      const inPopover = popoverRef.current?.contains(target)
      if (!inRoot && !inPopover) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Позиционирование попапа: выравниваем по кнопке, флипаем если не помещается.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return

    const compute = () => {
      const btn = btnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      // По горизонтали: сначала прижимаем влево к кнопке, если не лезет — к правому краю.
      let left = r.left
      if (left + POPOVER_WIDTH + 8 > vw) {
        left = Math.max(8, r.right - POPOVER_WIDTH)
      }

      // По вертикали: под кнопкой, иначе сверху.
      let top = r.bottom + GAP
      if (top + POPOVER_HEIGHT + 8 > vh) {
        top = Math.max(8, r.top - POPOVER_HEIGHT - GAP)
      }
      setPos({ top, left })
    }

    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open])

  // Прокрутка к выбранному значению при открытии
  useLayoutEffect(() => {
    if (!open) return
    const ITEM = 32  // высота одной строки
    if (hourColRef.current) hourColRef.current.scrollTop = hourNum * ITEM
    if (minuteColRef.current) minuteColRef.current.scrollTop = (minuteNum / minuteStep) * ITEM
  }, [open, hourNum, minuteNum, minuteStep])

  const setH = (v: number) => onChange(`${pad(v)}:${pad(minuteNum)}`)
  const setM = (v: number) => onChange(`${pad(hourNum)}:${pad(v)}`)

  const accent =
    tone === 'danger'
      ? {
          btnText: 'text-red-700 dark:text-red-300',
          btnBorder: 'border-red-200 dark:border-red-900/40',
          btnBg: 'bg-red-50/40 dark:bg-red-950/20',
          btnRing: 'focus:ring-red-400/30',
          activeBg: 'bg-red-500 text-white',
          hoverBg: 'hover:bg-red-50 dark:hover:bg-red-900/20',
        }
      : {
          btnText: 'text-gray-800 dark:text-gray-100',
          btnBorder: 'border-gray-200 dark:border-white/10',
          btnBg: 'bg-white dark:bg-white/5',
          btnRing: 'focus:ring-indigo-400/30',
          activeBg: 'bg-indigo-500 text-white',
          hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
        }

  return (
    <div ref={rootRef} className={clsx('relative inline-block', className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-[84px] h-[34px] px-2 rounded-lg text-sm font-medium tabular-nums border transition-all focus:outline-none focus:ring-2',
          'flex items-center justify-center gap-0.5',
          accent.btnText, accent.btnBorder, accent.btnBg, accent.btnRing,
          open && 'ring-2 ' + (tone === 'danger' ? 'ring-red-400/40' : 'ring-indigo-400/40'),
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span>{pad(hourNum)}</span>
        <span className="text-gray-400 dark:text-gray-500">:</span>
        <span>{pad(minuteNum)}</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className={clsx(
            'fixed z-[60] flex rounded-xl shadow-xl overflow-hidden',
            'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          )}
          style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
        >
          <Column
            items={hours.map((v) => pad(v))}
            activeIndex={hourNum}
            colRef={hourColRef}
            onPick={(i) => setH(i)}
            accent={accent}
          />
          <div className="w-px bg-gray-100 dark:bg-white/10" />
          <Column
            items={minutes.map((v) => pad(v))}
            activeIndex={Math.round(minuteNum / minuteStep)}
            colRef={minuteColRef}
            onPick={(i) => setM(i * minuteStep)}
            accent={accent}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}

interface ColumnProps {
  items: string[]
  activeIndex: number
  colRef: React.MutableRefObject<HTMLDivElement | null>
  onPick: (index: number) => void
  accent: { activeBg: string; hoverBg: string }
}

function Column({ items, activeIndex, colRef, onPick, accent }: ColumnProps) {
  return (
    <div
      ref={(el) => { colRef.current = el }}
      className="flex-1 max-h-[192px] overflow-y-auto overscroll-contain py-1 scrollbar-thin"
    >
      {items.map((label, i) => {
        const active = i === activeIndex
        return (
          <button
            key={label}
            type="button"
            onClick={() => onPick(i)}
            className={clsx(
              'w-full h-8 text-sm font-medium tabular-nums transition-colors flex items-center justify-center',
              active ? accent.activeBg : 'text-gray-700 dark:text-gray-300 ' + accent.hoverBg,
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
