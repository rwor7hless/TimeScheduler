import { useMemo, useState, useRef, useEffect } from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTasks, usePatchTask, useCreateTask, useBoards } from '@/hooks/useTasks'
import { useHabits, useToggleHabitLog } from '@/hooks/useHabits'
import TaskModal from '@/components/tasks/TaskModal'
import AsciiPet from '@/components/today/AsciiPet'
import Spinner from '@/components/ui/Spinner'
import { useDailyTip } from '@/hooks/useDailyTip'
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

function MyDayTaskRow({
  task,
  onToggle,
  onRemove,
  onClick,
}: {
  task: Task
  onToggle: () => void
  onRemove: () => void
  onClick: () => void
}) {
  const done = task.status === 'done'
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

      {/* Color accent */}
      <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />

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

      {/* Remove from My Day */}
      <button
        type="button"
        onClick={onRemove}
        title="Убрать из My Day"
        className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
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

const STATUS_CYCLE: Record<string, 'todo' | 'in_progress' | 'done'> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

const STATUS_COLOR: Record<string, string> = {
  todo: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
  in_progress: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50',
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'To do',
  in_progress: 'В работе',
}

function BacklogTaskRow({
  task,
  onDone,
  onStatusChange,
  onClick,
}: {
  task: Task
  onDone: () => void
  onStatusChange: (status: 'todo' | 'in_progress' | 'done') => void
  onClick: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
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
      <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-sm font-medium text-left text-gray-900 dark:text-gray-100 hover:text-amber-700 dark:hover:text-amber-400 transition-colors truncate"
      >
        {task.title}
      </button>
      <button
        type="button"
        onClick={() => onStatusChange(STATUS_CYCLE[task.status])}
        title="Сменить статус"
        className={clsx('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 transition-colors', STATUS_COLOR[task.status])}
      >
        {STATUS_LABEL[task.status]}
      </button>
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
      <span
        className={clsx(
          'flex-1 text-sm font-medium',
          done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
        )}
      >
        {habit.name}
      </span>
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
  const { data: boards } = useBoards()
  const { data: habits, isLoading: habitsLoading } = useHabits()
  const patchTask = usePatchTask()
  const createTask = useCreateTask()
  const toggleLog = useToggleHabitLog()

  const { tip, isLoading: tipLoading } = useDailyTip()

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [backlogOpen, setBacklogOpen] = useState(true)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
        setPickerSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  const { myDayTasks, scheduledTasks, backlogTasks } = useMemo(() => {
    if (!allTasks) return { myDayTasks: [], scheduledTasks: [], backlogTasks: [] }

    const myDay = allTasks.filter((t) => t.my_day && !t.is_archived)

    const scheduled = allTasks
      .filter((t) => {
        if (t.my_day) return false
        if (!t.scheduled_start) return false
        if (t.repeat_days?.length) return t.repeat_days.includes(wd)
        return isSameDay(parseISO(t.scheduled_start), today)
      })
      .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())

    const backlog = allTasks.filter(
      (t) => !t.my_day && t.scheduled_start == null && t.status !== 'done' && !t.is_archived
    )

    return { myDayTasks: myDay, scheduledTasks: scheduled, backlogTasks: backlog }
  }, [allTasks, today, wd])

  const allPickerTasks = useMemo(() => {
    if (!allTasks) return []
    return allTasks.filter((t) => !t.my_day && !t.is_archived && t.status !== 'done')
  }, [allTasks])

  const pickerTasks = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    const getBoardName = (t: Task) =>
      t.board_id == null ? '' : (boards?.find((b) => b.id === t.board_id)?.name ?? '')
    return allPickerTasks
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => {
        const ba = getBoardName(a).toLowerCase()
        const bb = getBoardName(b).toLowerCase()
        if (ba < bb) return -1
        if (ba > bb) return 1
        return a.title.localeCompare(b.title, 'ru')
      })
  }, [allPickerTasks, pickerSearch, boards])

  const activeHabits = useMemo(() => habits?.filter((h) => h.is_active) ?? [], [habits])
  const isHabitDone = (h: Habit) => h.logs.some((l) => l.date === todayStr)

  const doneMyDay = myDayTasks.filter((t) => t.status === 'done').length
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

  const handleStatusChange = async (task: Task, status: 'todo' | 'in_progress' | 'done') => {
    try {
      await patchTask.mutateAsync({ id: task.id, data: { status } })
    } catch {
      toast.error('Не удалось обновить задачу')
    }
  }

  const handleRemoveFromMyDay = async (task: Task) => {
    try {
      await patchTask.mutateAsync({ id: task.id, data: { my_day: false } })
    } catch {
      toast.error('Не удалось обновить задачу')
    }
  }

  const handleAddToMyDay = async (task: Task) => {
    try {
      await patchTask.mutateAsync({ id: task.id, data: { my_day: true } })
      setShowPicker(false)
      setPickerSearch('')
    } catch {
      toast.error('Не удалось обновить задачу')
    }
  }

  const handleQuickAdd = async () => {
    const title = quickAdd.trim()
    if (!title) return
    try {
      await createTask.mutateAsync({ title, my_day: true })
      setQuickAdd('')
    } catch {
      toast.error('Не удалось создать задачу')
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
      <div className="grid grid-cols-2 gap-3">
        <ProgressBar
          label="My Day"
          done={doneMyDay}
          total={myDayTasks.length}
          color="#F59E0B"
        />
        <ProgressBar
          label="Привычки"
          done={doneHabits}
          total={activeHabits.length}
          color="#10B981"
        />
      </div>

      {/* Питомец — только на мобиле, над задачами */}
      <div className="lg:hidden">
        <AsciiPet tip={tip} isLoading={tipLoading} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-start">

        {/* Left — tasks */}
        <div className="space-y-5">

          {/* My Day */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              My Day
            </h2>

            {/* Quick-add input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                placeholder="Добавить задачу на сегодня..."
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={!quickAdd.trim()}
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {/* Tasks list */}
            {myDayTasks.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {myDayTasks.map((task) => (
                  <MyDayTaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => handleTaskToggle(task)}
                    onRemove={() => handleRemoveFromMyDay(task)}
                    onClick={() => openEdit(task)}
                  />
                ))}
              </div>
            )}

            {myDayTasks.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                Добавь задачи, которые хочешь сделать сегодня
              </p>
            )}

            {/* Add from picker */}
            {allPickerTasks.length > 0 && (
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => { setShowPicker((v) => !v); setPickerSearch('') }}
                  className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Добавить из списка
                </button>

                {showPicker && (
                  <div className="absolute top-6 left-0 z-20 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                      <input
                        type="text"
                        autoFocus
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Поиск..."
                        className="w-full text-sm px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none border border-transparent focus:border-amber-400 transition-colors"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {pickerTasks.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 p-3 text-center">Ничего не найдено</p>
                      ) : (
                        pickerTasks.map((task) => {
                          const boardName = task.board_id == null
                            ? null
                            : (boards?.find((b) => b.id === task.board_id)?.name ?? null)
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => handleAddToMyDay(task)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
                              {boardName && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 truncate max-w-[60px]">{boardName}</span>
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

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

          {/* Backlog — collapsible */}
          {backlogTasks.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setBacklogOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors mb-2"
              >
                <svg
                  width="10" height="10"
                  viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={clsx('transition-transform', backlogOpen ? 'rotate-90' : '')}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Backlog
                <span className="ml-0.5 text-[10px] font-normal normal-case tracking-normal">
                  ({backlogTasks.length})
                </span>
              </button>

              {backlogOpen && (
                <div className="space-y-4">
                  {(() => {
                    const groups: { boardId: number | null; name: string; tasks: Task[] }[] = []
                    for (const task of backlogTasks) {
                      const existing = groups.find((g) => g.boardId === task.board_id)
                      if (existing) {
                        existing.tasks.push(task)
                      } else {
                        const boardName = task.board_id == null
                          ? 'Основная'
                          : (boards?.find((b) => b.id === task.board_id)?.name ?? `Доска ${task.board_id}`)
                        groups.push({ boardId: task.board_id, name: boardName, tasks: [task] })
                      }
                    }
                    return groups.map((group) => (
                      <div key={group.boardId ?? 'main'}>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />
                          {group.name}
                        </div>
                        <div className="space-y-1.5">
                          {group.tasks.map((task) => (
                            <BacklogTaskRow
                              key={task.id}
                              task={task}
                              onDone={() => handleMarkDone(task)}
                              onStatusChange={(status) => handleStatusChange(task, status)}
                              onClick={() => openEdit(task)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right — pet + habits */}
        <div className="space-y-5">
          {/* Питомец — только на десктопе */}
          <div className="hidden lg:block">
            <AsciiPet tip={tip} isLoading={tipLoading} />
          </div>

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
      </div>

      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
      />
    </div>
  )
}
