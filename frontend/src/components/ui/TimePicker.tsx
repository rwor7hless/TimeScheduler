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
  const range = max - min + 1
  const inc = () => onChange(min + (value - min + step) % range)
  const dec = () => onChange(min + (value - min - step + range) % range)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) inc(); else dec()
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    if (y < rect.height / 2) inc(); else dec()
  }

  return (
    <div
      onClick={handleClick}
      onWheel={handleWheel}
      className="relative flex items-center justify-center w-8 h-full cursor-ns-resize select-none group/spin rounded-md hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
      title="↑ больше · ↓ меньше"
    >
      <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100 group-hover/spin:text-indigo-600 dark:group-hover/spin:text-indigo-400 transition-colors leading-none">
        {pad(value)}
      </span>
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
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      )}
      <div className="flex items-center h-[34px] bg-gray-100/80 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-1 gap-0.5">
        <SpinNum value={hourNum} min={0} max={23} onChange={setH} />
        <span className="text-sm font-bold text-gray-300 dark:text-gray-600 select-none">:</span>
        <SpinNum value={minNum} min={0} max={55} step={5} onChange={setM} />
      </div>
    </div>
  )
}
