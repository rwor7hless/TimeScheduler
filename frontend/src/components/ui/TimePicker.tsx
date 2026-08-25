import clsx from 'clsx'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function SpinNum({ value, min, max, step = 1, onChange }: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  const range = max - min + step
  const inc = () => onChange(min + (value - min + step) % range)
  const dec = () => onChange(min + (value - min - step + range) % range)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) inc(); else dec()
  }

  return (
    <div
      onWheel={handleWheel}
      className="flex flex-col items-center select-none"
    >
      <button
        type="button"
        onClick={inc}
        className="w-7 h-5 narrow:w-11 narrow:h-9 flex items-center justify-center text-fg-mid hover:text-accent transition-colors hover:bg-bg-hover"
        tabIndex={-1}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <span className="text-sm font-semibold tabular-nums text-fg leading-none w-7 text-center py-0.5">
        {pad(value)}
      </span>
      <button
        type="button"
        onClick={dec}
        className="w-7 h-5 narrow:w-11 narrow:h-9 flex items-center justify-center text-fg-mid hover:text-accent transition-colors hover:bg-bg-hover"
        tabIndex={-1}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  )
}

export default function TimePicker({ value, onChange, label, className }: TimePickerProps) {
  const [h = '09', m = '00'] = value ? value.split(':') : ['09', '00']
  const hourNum = parseInt(h, 10) || 0
  const minRaw = parseInt(m, 10) || 0
  const minNum = Math.round(minRaw / 5) * 5 % 60

  const setH = (v: number) => onChange(`${pad(v)}:${pad(minNum)}`)
  const setM = (v: number) => onChange(`${pad(hourNum)}:${pad(v)}`)

  return (
    <div className={clsx('inline-flex flex-col gap-1', className)}>
      {label && (
        <label className="block text-xs font-medium text-fg-mid">{label}</label>
      )}
      <div className="flex items-center h-[34px] narrow:h-11 bg-bg-cell border border-line px-2 gap-1">
        <SpinNum value={hourNum} min={0} max={23} onChange={setH} />
        <span className="text-sm font-bold text-fg-mid select-none pb-0.5">:</span>
        <SpinNum value={minNum} min={0} max={55} step={5} onChange={setM} />
      </div>
    </div>
  )
}
