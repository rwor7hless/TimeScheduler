import TimePicker from './TimePicker'

interface TimeRangeInputProps {
  startTime: string
  endTime: string
  onRangeChange: (start: string, end: string) => void
  label?: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function TimeRangeInput({
  startTime,
  endTime,
  onRangeChange,
  label,
  className = '',
}: TimeRangeInputProps) {
  const handleStartChange = (newStart: string) => {
    const [sh, sm] = newStart.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const sMin = sh * 60 + sm
    const eMin = eh * 60 + em
    if (eMin <= sMin) {
      const newEndMin = Math.min(sMin + 60, 23 * 60 + 55)
      const newEnd = `${pad(Math.floor(newEndMin / 60))}:${pad(newEndMin % 60)}`
      onRangeChange(newStart, newEnd)
    } else {
      onRangeChange(newStart, endTime)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <TimePicker value={startTime || '09:00'} onChange={handleStartChange} />
        <span className="text-gray-400 text-sm font-medium mt-1">→</span>
        <TimePicker value={endTime || '10:00'} onChange={(v) => onRangeChange(startTime, v)} />
      </div>
    </div>
  )
}
