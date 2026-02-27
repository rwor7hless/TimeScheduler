import { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  parseISO,
} from 'date-fns'
import clsx from 'clsx'
import type { Task } from '@/types/task'

interface MonthViewProps {
  date: Date
  tasks: Task[]
  onDayClick: (date: Date) => void
}

const WEEKDAYS_LONG  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_SHORT = ['M',   'T',   'W',   'T',   'F',   'S',   'S'  ]

export default function MonthView({ date, tasks, onDayClick }: MonthViewProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [date])

  const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    days.forEach((d) => map.set(format(d, 'yyyy-MM-dd'), []))
    tasks.forEach((task) => {
      if (!task.scheduled_start) return
      if (task.repeat_days && task.repeat_days.length > 0) {
        days.forEach((day) => {
          if (task.repeat_days!.includes(weekdayIndex(day))) {
            const key = format(day, 'yyyy-MM-dd')
            const arr = map.get(key) || []
            arr.push(task)
            map.set(key, arr)
          }
        })
      } else {
        const key = format(parseISO(task.scheduled_start), 'yyyy-MM-dd')
        const arr = map.get(key) || []
        arr.push(task)
        map.set(key, arr)
      }
    })
    return map
  }, [tasks, days])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS_LONG.map((day, i) => (
          <div key={day} className="px-1 py-2 text-xs font-medium text-gray-500 text-center">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayTasks = tasksByDay.get(key) || []
          const inMonth = isSameMonth(day, date)

          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              className={clsx(
                'min-h-[56px] sm:min-h-[100px] p-1 sm:p-1.5 border-b border-r border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors',
                !inMonth && 'bg-gray-50/50'
              )}
            >
              <div
                className={clsx(
                  'text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full',
                  isToday(day) && 'bg-accent text-white',
                  !isToday(day) && inMonth && 'text-gray-900',
                  !inMonth && 'text-gray-300'
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => {
                  const time = task.scheduled_start
                    ? new Date(task.scheduled_start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                    : null
                  return (
                    <div
                      key={task.id}
                      className="text-[10px] sm:text-[11px] px-1 sm:px-1.5 py-0.5 rounded truncate font-medium"
                      style={{
                        backgroundColor: `${task.color}18`,
                        borderLeft: `2px solid ${task.color}`,
                        color: task.color,
                      }}
                    >
                      {time && (
                        <span className="hidden sm:inline opacity-60 mr-1 font-normal text-[10px]">{time}</span>
                      )}
                      {task.title}
                    </div>
                  )
                })}
                {dayTasks.length > 3 && (
                  <div className="text-[11px] text-gray-400 px-1.5 font-medium">
                    +{dayTasks.length - 3} ещё
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
