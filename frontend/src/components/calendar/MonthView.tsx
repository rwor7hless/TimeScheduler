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

  // Deadlines per day, excluding tasks already laid out on the same day's timeline.
  const deadlinesByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    days.forEach((d) => map.set(format(d, 'yyyy-MM-dd'), []))
    tasks.forEach((task) => {
      if (!task.deadline) return
      if (task.is_archived || task.done) return
      const dKey = task.deadline.slice(0, 10)
      if (task.scheduled_start && task.scheduled_start.slice(0, 10) === dKey) return
      if (map.has(dKey)) map.get(dKey)!.push(task)
    })
    return map
  }, [tasks, days])

  return (
    <div className="bg-bg-cell border border-line overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS_LONG.map((day, i) => (
          <div key={day} className="px-1 py-2 text-xs font-medium text-fg-mid text-center">
            <span>{day}</span>
            <span className="hidden">{WEEKDAYS_SHORT[i]}</span>
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
                'min-h-[100px] p-1.5 border-b border-r border-line-soft cursor-pointer hover:bg-bg-raised transition-colors',
                !inMonth && 'bg-bg-raised'
              )}
            >
              <div
                className={clsx(
                  'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center',
                  isToday(day) && 'bg-accent text-bg',
                  !isToday(day) && inMonth && 'text-fg',
                  !inMonth && 'text-fg-mid'
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {(() => {
                  const dayDeadlines = deadlinesByDay.get(key) || []
                  // Cap visible items so cells don't blow out vertically. Show
                  // up to 3 scheduled, then up to 2 deadlines, then "+N ещё".
                  const visibleScheduled = dayTasks.slice(0, 3)
                  const remainingSlots = Math.max(0, 5 - visibleScheduled.length)
                  const visibleDeadlines = dayDeadlines.slice(0, remainingSlots)
                  const hidden =
                    dayTasks.length - visibleScheduled.length +
                    dayDeadlines.length - visibleDeadlines.length

                  return (
                    <>
                      {visibleScheduled.map((task) => {
                        const time = task.scheduled_start
                          ? new Date(task.scheduled_start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                          : null
                        return (
                          <div
                            key={task.id}
                            className="text-[11px] px-1.5 py-0.5 truncate font-medium"
                            style={{
                              backgroundColor: `${task.color}18`,
                              borderLeft: `2px solid ${task.color}`,
                              color: task.color,
                            }}
                          >
                            {time && (
                              <span className="opacity-60 mr-1 font-normal text-[10px]">{time}</span>
                            )}
                            {task.title}
                          </div>
                        )
                      })}
                      {visibleDeadlines.map((task) => (
                        <div
                          key={`dl-${task.id}`}
                          className="text-[11px] px-1.5 py-0.5 truncate font-medium border border-dashed flex items-center gap-1"
                          style={{
                            borderColor: `${task.color}66`,
                            color: task.color,
                          }}
                          title={`Дедлайн: ${task.title}`}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-shrink-0">
                            <path d="M4 21V4l16 0-3 5 3 5H4" />
                          </svg>
                          <span className="truncate">{task.title}</span>
                        </div>
                      ))}
                      {hidden > 0 && (
                        <div className="text-[11px] text-fg-mid px-1.5 font-medium">
                          +{hidden} ещё
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
