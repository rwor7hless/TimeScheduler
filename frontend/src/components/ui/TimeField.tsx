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
          btnText: 'text-danger',
          btnBorder: 'border-line',
          btnBg: 'bg-bg-cell',
          activeBg: 'bg-danger text-bg',
          hoverBg: 'hover:bg-bg-hover',
        }
      : {
          btnText: 'text-fg',
          btnBorder: 'border-line',
          btnBg: 'bg-bg-cell',
          activeBg: 'bg-accent text-bg',
          hoverBg: 'hover:bg-bg-hover',
        }

  return (
    <div ref={rootRef} className={clsx('relative inline-block', className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-[84px] h-[34px] narrow:h-11 px-2 text-sm font-medium tabular-nums border transition-all focus:outline-none',
          'flex items-center justify-center gap-0.5',
          accent.btnText, accent.btnBorder, accent.btnBg,
          open && ' ' + (tone === 'danger' ? '' : ''),
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span>{pad(hourNum)}</span>
        <span className="text-fg-mid">:</span>
        <span>{pad(minuteNum)}</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className={clsx(
            'fixed z-[60] flex overflow-hidden',
            'bg-bg-cell border border-line',
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
          <div className="w-px bg-line" />
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
              'w-full h-8 narrow:h-11 text-sm font-medium tabular-nums transition-colors flex items-center justify-center',
              active ? accent.activeBg : 'text-fg-body ' + accent.hoverBg,
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
