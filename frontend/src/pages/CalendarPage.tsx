import { useState, useCallback } from 'react'
import { addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTasks, usePatchTask } from '@/hooks/useTasks'
import DayView from '@/components/calendar/DayView'
import WeekView from '@/components/calendar/WeekView'
import MonthView from '@/components/calendar/MonthView'
import TaskModal from '@/components/tasks/TaskModal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import type { Task } from '@/types/task'

type ViewMode = 'day' | 'week' | 'month'

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultDate, setDefaultDate] = useState<string>('')

  const { data: tasks, isLoading } = useTasks({ scope: 'calendar' })
  const patchTask = usePatchTask()

  const handleTaskMove = useCallback((task: Task, newStart: string, newEnd: string) => {
    patchTask.mutate({ id: task.id, data: { scheduled_start: newStart, scheduled_end: newEnd } })
  }, [patchTask])

  const navigatePrev = () => {
    setCurrentDate((d) =>
      viewMode === 'day' ? subDays(d, 1) : viewMode === 'week' ? subWeeks(d, 1) : subMonths(d, 1)
    )
  }

  const navigateNext = () => {
    setCurrentDate((d) =>
      viewMode === 'day' ? addDays(d, 1) : viewMode === 'week' ? addWeeks(d, 1) : addMonths(d, 1)
    )
  }

  const goToToday = () => setCurrentDate(new Date())

  const handleTaskClick = (task: Task) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  const handleSlotClick = (datetime: string) => {
    setEditingTask(null)
    setDefaultDate(datetime)
    setModalOpen(true)
  }

  const handleDayClick = (date: Date) => {
    setCurrentDate(date)
    setViewMode('day')
  }

  const headerText =
    viewMode === 'day'
      ? format(currentDate, 'd MMMM yyyy', { locale: ru })
      : viewMode === 'week'
      ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: ru })} — ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: ru })}`
      : format(currentDate, 'LLLL yyyy', { locale: ru })

  if (isLoading) return <Spinner className="mt-20" />

  return (
    <div className="flex flex-col lg:h-[calc(100vh-9rem)] min-h-0 overflow-x-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0 mb-2">
        {/* Nav + date */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Button variant="secondary" size="sm" onClick={navigatePrev}>&larr;</Button>
          <Button variant="secondary" size="sm" onClick={goToToday}>Сегодня</Button>
          <Button variant="secondary" size="sm" onClick={navigateNext}>&rarr;</Button>
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 ml-1 capitalize truncate">{headerText}</h2>
        </div>

        {/* Mode switcher + add */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                  viewMode === mode ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                }`}
              >
                {mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => { setEditingTask(null); setDefaultDate(''); setModalOpen(true) }}
          >
            + Задача
          </Button>
        </div>
      </div>

      {/* Calendar View — flex-1, 24 часа видны без прокрутки */}
      <div className="flex-1 min-h-0 overflow-auto">
      {viewMode === 'day' && (
        <DayView
          date={currentDate}
          tasks={tasks || []}
          onTaskClick={handleTaskClick}
          onSlotClick={handleSlotClick}
          onTaskMove={handleTaskMove}
        />
      )}
      {viewMode === 'week' && (
        <WeekView
          date={currentDate}
          tasks={tasks || []}
          onTaskClick={handleTaskClick}
          onSlotClick={handleSlotClick}
          onTaskMove={handleTaskMove}
        />
      )}
      {viewMode === 'month' && (
        <MonthView
          date={currentDate}
          tasks={tasks || []}
          onDayClick={handleDayClick}
        />
      )}
      </div>

      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        defaultDate={defaultDate}
      />
    </div>
  )
}
