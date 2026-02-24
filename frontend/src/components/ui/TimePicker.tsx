import { Popover } from '@headlessui/react'
import clsx from 'clsx'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))

export default function TimePicker({ value, onChange, label, className }: TimePickerProps) {
  const [h = '09', m = '00'] = value ? value.split(':') : ['09', '00']
  const hourNum = parseInt(h, 10) || 0
  const minNum = parseInt(m, 10) || 0
  const safeM = MINUTES.includes(m) ? m : pad(Math.round(minNum / 5) * 5 % 60)

  return (
    <div className={clsx('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}
      <Popover className="relative">
        {({ open }) => (
          <>
            <Popover.Button className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400/50 transition-all touch-manipulation">
              <span className="tabular-nums">{pad(hourNum)}</span>
              <span className="text-gray-400 dark:text-gray-400">:</span>
              <span className="tabular-nums">{safeM}</span>
              <span className={clsx('ml-0.5 text-gray-400 transition-transform', open && 'rotate-180')}>▾</span>
            </Popover.Button>

            <Popover.Panel
              anchor="bottom start"
              className="z-50 mt-1 min-w-[140px] max-w-[min(90vw,280px)]"
            >
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 shadow-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">Часы</div>
                    <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                      {HOURS.map((hour) => (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => onChange(`${hour}:${safeM}`)}
                          className={clsx(
                            'min-h-[36px] px-2 py-1.5 text-xs sm:text-sm rounded font-medium transition-colors touch-manipulation',
                            hour === pad(hourNum)
                              ? 'bg-amber-500 text-white'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          )}
                        >
                          {hour}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">Минуты</div>
                    <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                      {MINUTES.map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => onChange(`${pad(hourNum)}:${min}`)}
                          className={clsx(
                            'min-h-[36px] px-2 py-1.5 text-xs sm:text-sm rounded font-medium transition-colors touch-manipulation',
                            min === safeM
                              ? 'bg-amber-500 text-white'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          )}
                        >
                          {min}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Popover.Panel>
          </>
        )}
      </Popover>
    </div>
  )
}
