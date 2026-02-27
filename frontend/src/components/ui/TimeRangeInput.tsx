import { useState, useEffect, useCallback } from 'react'

interface TimeRangeInputProps {
  startTime: string
  endTime: string
  onRangeChange: (start: string, end: string) => void
  label?: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function floorTo5(minutes: number): number {
  return Math.floor(minutes / 5) * 5
}

const inputClass =
  'w-10 px-1.5 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:ring-offset-1 focus:border-amber-400/50 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none appearance-none'

export default function TimeRangeInput({
  startTime,
  endTime,
  onRangeChange,
  label,
  className = '',
}: TimeRangeInputProps) {
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

  const applyInput = useCallback(() => {
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

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={23}
          value={startH}
          onChange={(e) => setStartH(e.target.value)}
          onBlur={applyInput}
          className={inputClass}
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
          onBlur={applyInput}
          className={inputClass}
          placeholder="м"
          title="Минуты начала"
        />
        <span className="text-gray-300 mx-1">→</span>
        <input
          type="number"
          min={0}
          max={23}
          value={endH}
          onChange={(e) => setEndH(e.target.value)}
          onBlur={applyInput}
          className={inputClass}
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
          onBlur={applyInput}
          className={inputClass}
          placeholder="м"
          title="Минуты конца"
        />
      </div>
    </div>
  )
}
