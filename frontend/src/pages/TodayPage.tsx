import { useMemo, useState } from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTasks, usePatchTask } from '@/hooks/useTasks'
import { useHabits, useToggleHabitLog } from '@/hooks/useHabits'
import TaskModal from '@/components/tasks/TaskModal'
import Spinner from '@/components/ui/Spinner'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 17) return 'Добрый день'
  if (h < 22) return 'Добрый вечер'
  return 'Доброй ночи'
}

function weekdayIndex(d: Date) {
  return (d.getDay() + 6) % 7
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ label, done, total, color }: { label: string; done: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{done}/{total}</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function ScheduledTaskRow({
  task,
  onToggle,
  onClick,
}: {
  task: Task
  onToggle: () => void
  onClick: () => void
}) {
  const done = task.status === 'done'
  const startTime = task.scheduled_start
    ? new Date(task.scheduled_start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-xl border transition-all',
        done
          ? 'opacity-50'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
      style={done ? { backgroundColor: `${task.color}15`, borderColor: `${task.color}50` } : undefined}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all',
          done ? 'text-white' : 'border-2 border-gray-300 dark:border-gray-600 hover:border-amber-400'
        )}
        style={done ? { backgroundColor: task.color } : undefined}
      >
        {done && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Time */}
      <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-10 flex-shrink-0 select-none">
        {startTime}
      </span>

      {/* Title */}
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'flex-1 text-sm font-medium text-left transition-colors truncate',
          done
            ? 'line-through text-gray-400 dark:text-gray-500'
            : 'text-gray-900 dark:text-gray-100 hover:text-amber-700 dark:hover:text-amber-400'
        )}
      >
        {task.title}
      </button>

      {/* Color dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
    </div>
  )
}

function ActiveTaskRow({
  task,
  onDone,
  onClick,
}: {
  task: Task
  onDone: () => void
  onClick: () => void
}) {
  const statusColor: Record<string, string> = {
    todo: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    in_progress: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
  }
  const statusLabel: Record<string, string> = {
    todo: 'To do',
    in_progress: 'В работе',
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
      {/* Done button */}
      <button
        type="button"
        onClick={onDone}
        title="Отметить выполненной"
        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all group"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 text-emerald-500 transition-opacity">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>

      {/* Color accent */}
      <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />

      {/* Title */}
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-sm font-medium text-left text-gray-900 dark:text-gray-100 hover:text-amber-700 dark:hover:text-amber-400 transition-colors truncate"
      >
        {task.title}
      </button>

      {/* Status badge */}
      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', statusColor[task.status])}>
        {statusLabel[task.status]}
      </span>
    </div>
  )
}

function HabitRow({
  habit,
  done,
  onToggle,
}: {
  habit: Habit
  done: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
        done
          ? 'opacity-60'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
      style={done ? { backgroundColor: `${habit.color}15`, borderColor: `${habit.color}50` } : undefined}
    >
      {/* Check circle */}
      <div
        className={clsx(
          'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all',
          done ? 'text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600'
        )}
        style={done ? { backgroundColor: habit.color } : undefined}
      >
        {done ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </div>

      {/* Name */}
      <span
        className={clsx(
          'flex-1 text-sm font-medium',
          done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
        )}
      >
        {habit.name}
      </span>

      {/* Color dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: habit.color }} />
    </button>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const today = useMemo(() => new Date(), [])
  const todayStr = format(today, 'yyyy-MM-dd')
  const wd = weekdayIndex(today)

  const { data: allTasks, isLoading: tasksLoading } = useTasks()
  const { data: habits, isLoading: habitsLoading } = useHabits()
  const patchTask = usePatchTask()
  const toggleLog = useToggleHabitLog()

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const { scheduledTasks, activeTasks } = useMemo(() => {
    if (!allTasks) return { scheduledTasks: [], activeTasks: [] }

    const scheduled = allTasks
      .filter((t) => {
        if (!t.scheduled_start) return false
        if (t.repeat_days?.length) return t.repeat_days.includes(wd)
        return isSameDay(parseISO(t.scheduled_start), today)
      })
      .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())

    const active = allTasks.filter(
      (t) => t.scheduled_start == null && t.board_id == null && t.status !== 'done'
    )

    return { scheduledTasks: scheduled, activeTasks: active }
  }, [allTasks, today, wd])

  const activeHabits = useMemo(() => habits?.filter((h) => h.is_active) ?? [], [habits])
  const isHabitDone = (h: Habit) => h.logs.some((l) => l.date === todayStr)

  const doneScheduled = scheduledTasks.filter((t) => t.status === 'done').length
  const doneHabits = activeHabits.filter(isHabitDone).length

  const handleTaskToggle = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    try {
      await patchTask.mutateAsync({ id: task.id, data: { status: newStatus } })
    } catch {
      toast.error('Не удалось обновить задачу')
    }
  }

  const handleMarkDone = async (task: Task) => {
    try {
      await patchTask.mutateAsync({ id: task.id, data: { status: 'done' } })
    } catch {
      toast.error('Не удалось обновить задачу')
    }
  }

  const handleHabitToggle = async (habitId: number) => {
    try {
      await toggleLog.mutateAsync({ id: habitId, date: todayStr })
    } catch {
      toast.error('Не удалось обновить привычку')
    }
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  if (tasksLoading || habitsLoading) return <Spinner className="mt-20" />

  const hasAnything = scheduledTasks.length > 0 || activeTasks.length > 0 || activeHabits.length > 0

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-400 dark:text-gray-500">{getGreeting()}</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 capitalize">
          {format(today, 'EEEE, d MMMM', { locale: ru })}
        </h1>
      </div>

      {/* Progress bars */}
      {hasAnything && (
        <div className="grid grid-cols-2 gap-3">
          <ProgressBar
            label="Задачи"
            done={doneScheduled}
            total={scheduledTasks.length}
            color="#F59E0B"
          />
          <ProgressBar
            label="Привычки"
            done={doneHabits}
            total={activeHabits.length}
            color="#10B981"
          />
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-start">

        {/* Left — tasks */}
        <div className="space-y-4">

          {/* Schedule */}
          {scheduledTasks.length > 0 && (
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                Расписание
              </h2>
              <div className="space-y-1.5">
                {scheduledTasks.map((task) => (
                  <ScheduledTaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => handleTaskToggle(task)}
                    onClick={() => openEdit(task)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Active board tasks */}
          {activeTasks.length > 0 && (
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                Активные задачи
              </h2>
              <div className="space-y-1.5">
                {activeTasks.map((task) => (
                  <ActiveTaskRow
                    key={task.id}
                    task={task}
                    onDone={() => handleMarkDone(task)}
                    onClick={() => openEdit(task)}
                  />
                ))}
              </div>
            </section>
          )}

          {scheduledTasks.length === 0 && activeTasks.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
              Задач на сегодня нет — отличный день!
            </p>
          )}
        </div>

        {/* Right — habits */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
            Привычки
          </h2>
          {activeHabits.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
              Нет активных привычек
            </p>
          ) : (
            <div className="space-y-1.5">
              {activeHabits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  done={isHabitDone(habit)}
                  onToggle={() => handleHabitToggle(habit.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
      />
    </div>
  )
}
