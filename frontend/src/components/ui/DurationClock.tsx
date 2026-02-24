import { useRef, useState, useCallback, useEffect, useId } from 'react'
import { Popover } from '@headlessui/react'
import clsx from 'clsx'

interface DurationClockProps {
  startTime: string
  endTime: string
  onRangeChange: (start: string, end: string) => void
  label?: string
  className?: string
  /** Встроенный режим — циферблат в форме без попапа */
  embedded?: boolean
  /** Компактный размер (для модалки задачи) */
  compact?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

function timeToMinutes(h: number, m: number): number {
  return h * 60 + m
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = Math.round((total % 60) / 5) * 5 % 60
  return `${pad(h)}:${pad(m)}`
}

function parseTime(s: string): number {
  const [h, m] = (s || '09:00').split(':').map((x) => parseInt(x, 10) || 0)
  return timeToMinutes(h, m)
}

function snapTo5(minutes: number): number {
  return Math.round(minutes / 5) * 5
}

function floorTo5(minutes: number): number {
  return Math.floor(minutes / 5) * 5
}

const inputClass =
  'w-12 px-2 py-2 text-base text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400/50 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none appearance-none'
const inputClassCompact =
  'w-9 px-1.5 py-1 text-xs text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500/30 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none appearance-none'

const SIZE_EMBEDDED = 280
const SIZE_EMBEDDED_COMPACT = 160
const SIZE_POPOVER = 480

export default function DurationClock({
  startTime,
  endTime,
  onRangeChange,
  label,
  className,
  embedded = false,
  compact = false,
}: DurationClockProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = `arc-${useId().replace(/:/g, '')}`
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [startH, setStartH] = useState('')
  const [startMin, setStartMin] = useState('')
  const [endH, setEndH] = useState('')
  const [endMin, setEndMin] = useState('')

  useEffect(() => {
    const [sh, sm] = startTime.split(':')
    const [eh, em] = endTime.split(':')
    setStartH(sh || '09')
    setStartMin(sm || '00')
    setEndH(eh || '10')
    setEndMin(em || '00')
  }, [startTime, endTime])

  const applyManualInput = useCallback(() => {
    const sh = Math.min(23, Math.max(0, parseInt(startH, 10) || 0))
    const sm = floorTo5(Math.min(59, Math.max(0, parseInt(startMin, 10) || 0)))
    const eh = Math.min(23, Math.max(0, parseInt(endH, 10) || 0))
    const em = floorTo5(Math.min(59, Math.max(0, parseInt(endMin, 10) || 0)))
    const s = `${pad(sh)}:${pad(sm)}`
    const e = `${pad(eh)}:${pad(em)}`
    const sMin = sh * 60 + sm
    const eMin = eh * 60 + em
    if (eMin > sMin && eMin - sMin <= 24 * 60 - 5) {
      onRangeChange(s, e)
    } else {
      const [rh, rm] = startTime.split(':')
      const [eh2, em2] = endTime.split(':')
      setStartH(rh || '09')
      setStartMin(rm || '00')
      setEndH(eh2 || '10')
      setEndMin(em2 || '00')
    }
  }, [onRangeChange, startH, startMin, endH, endMin, startTime, endTime])

  const startTotalM = parseTime(startTime)
  const endTotalM = parseTime(endTime)

  const getAngleFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const dx = e.clientX - x
    const dy = e.clientY - y
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (angle < 0) angle += 360
    return angle
  }, [])

  const angleToMinutes = useCallback((angle: number) => {
    const total = (angle / 360) * 24 * 60
    return snapTo5(total) % (24 * 60)
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const angle = getAngleFromEvent(e)
      const m = angleToMinutes(angle)
      setIsDragging(true)
      setDragStart(m)
      onRangeChange(minutesToTime(m), minutesToTime(m + 60))
    },
    [getAngleFromEvent, angleToMinutes, onRangeChange]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || dragStart === null) return
      const angle = getAngleFromEvent(e)
      let endMins = angleToMinutes(angle)
      if (endMins <= dragStart) endMins += 24 * 60
      const maxDuration = 24 * 60 - dragStart - 5
      const duration = Math.max(5, Math.min(maxDuration, endMins - dragStart))
      const end = dragStart + duration
      onRangeChange(minutesToTime(dragStart), minutesToTime(end))
    },
    [isDragging, dragStart, getAngleFromEvent, angleToMinutes, onRangeChange]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => handleMouseMove(e)
    const onUp = () => handleMouseUp()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const SIZE = embedded ? (compact ? SIZE_EMBEDDED_COMPACT : SIZE_EMBEDDED) : SIZE_POPOVER
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R = SIZE / 2 - (embedded ? (compact ? 12 : 24) : 40)

  const startAngle = (startTotalM / (24 * 60)) * 360
  const endAngle = (endTotalM / (24 * 60)) * 360
  const sweepAngle = endTotalM >= startTotalM ? endAngle - startAngle : 360 - startAngle + endAngle

  const polarToCart = (angleDeg: number, r: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
  }

  const describeArc = (start: number, sweep: number) => {
    const s = polarToCart(start, R)
    const e = polarToCart(start + sweep, R)
    const large = sweep > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const renderClockContent = (close?: () => void) => (
    <>
      {!embedded && (
        <div className="text-center text-sm text-gray-500 mb-2">
          Перетащите по циферблату (округление вниз)
        </div>
      )}
      <div className={clsx('flex-shrink-0', embedded ? (compact ? 'w-[160px] h-[160px]' : 'w-[280px] h-[280px]') : 'w-[min(480px,90vmin)] h-[min(480px,90vmin)]')}>
        <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${SIZE} ${SIZE}`}
                  className="select-none cursor-crosshair"
                  style={{ touchAction: 'none' }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleMouseDown(e)
                  }}
                >
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="1"
                  />
                  {Array.from({ length: 288 }).map((_, i) => {
                    const angle = (i / 288) * 360 - 90
                    const rad = (angle * Math.PI) / 180
                    const isHour = i % 12 === 0
                    const r1 = R - (isHour ? 16 : 8)
                    const r2 = R
                    const x1 = CX + r1 * Math.cos(rad)
                    const y1 = CY + r1 * Math.sin(rad)
                    const x2 = CX + r2 * Math.cos(rad)
                    const y2 = CY + r2 * Math.sin(rad)
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isHour ? '#9CA3AF' : '#E5E7EB'}
                        strokeWidth={isHour ? 2 : 1}
                      />
                    )
                  })}
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
                    const angle = (h / 24) * 360 - 90
                    const rad = (angle * Math.PI) / 180
                    const labelR = R - (compact ? 20 : 36)
                    const x = CX + labelR * Math.cos(rad)
                    const y = CY + labelR * Math.sin(rad)
                    return (
                      <text
                        key={h}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={clsx('fill-gray-700 font-semibold', compact ? 'text-[10px]' : 'text-base')}
                      >
                        {pad(h)}
                      </text>
                    )
                  })}
                  {sweepAngle > 0 && (
                    <path
                      d={describeArc(startAngle, sweepAngle)}
                      fill="none"
                      stroke={`url(#${gradId})`}
                      strokeWidth={embedded ? (compact ? 8 : 14) : 24}
                      strokeLinecap="round"
                    />
                  )}
        </svg>
      </div>
      <div className={clsx('flex flex-col flex-shrink-0', embedded ? (compact ? 'gap-1.5 mt-2' : 'gap-3 mt-3') : 'gap-3 mt-4')}>
        <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={startH}
                        onChange={(e) => setStartH(e.target.value)}
                        onBlur={applyManualInput}
                        className={compact ? inputClassCompact : inputClass}
                        placeholder="ч"
                        title="Часы начала"
                      />
                      <span className="text-gray-400">:</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={startMin}
                        onChange={(e) => setStartMin(e.target.value)}
                        onBlur={applyManualInput}
                        className={compact ? inputClassCompact : inputClass}
                        placeholder="м"
                        title="Минуты начала"
                      />
                      <span className="text-xs text-gray-400 ml-0.5">начало</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={endH}
                        onChange={(e) => setEndH(e.target.value)}
                        onBlur={applyManualInput}
                        className={compact ? inputClassCompact : inputClass}
                        placeholder="ч"
                        title="Часы конца"
                      />
                      <span className="text-gray-400">:</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={endMin}
                        onChange={(e) => setEndMin(e.target.value)}
                        onBlur={applyManualInput}
                        className={compact ? inputClassCompact : inputClass}
                        placeholder="м"
                        title="Минуты конца"
                      />
          <span className="text-xs text-gray-400 ml-0.5">конец</span>
        </div>
        <button
          type="button"
          onClick={() => {
            applyManualInput()
            close?.()
          }}
          className={clsx('w-full rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-colors', compact ? 'py-1.5 px-2 text-xs' : 'py-2 px-3 text-sm')}
        >
          Подтвердить
        </button>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className={clsx('space-y-1', className)}>
        {label && (
          <label className="block text-sm font-medium text-gray-700">{label}</label>
        )}
        <div className={clsx('rounded-xl border border-gray-200 bg-white flex flex-col items-center', compact ? 'p-2' : 'p-4')}>
          {renderClockContent()}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <Popover className="relative">
        {({ open }) => (
          <>
            <Popover.Button className="inline-flex items-center gap-1.5 px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400/50 transition-all">
              <span className="tabular-nums">{startTime}</span>
              <span className="text-gray-400">—</span>
              <span className="tabular-nums">{endTime}</span>
              <span className={clsx('ml-0.5 text-gray-400 transition-transform', open && 'rotate-180')}>▾</span>
            </Popover.Button>

            <Popover.Backdrop className="fixed inset-0 z-40 bg-black/30" />
            <Popover.Panel className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {({ close }) => (
                <div
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl max-w-[95vw] max-h-[95vh] overflow-auto flex flex-col items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderClockContent(close)}
                </div>
              )}
            </Popover.Panel>
          </>
        )}
      </Popover>
    </div>
  )
}
