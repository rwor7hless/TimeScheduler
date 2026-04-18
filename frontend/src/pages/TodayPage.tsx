import { useMemo, useState, useRef, useEffect } from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTasks, usePatchTask, useCreateTask, useBoards } from '@/hooks/useTasks'
import { useHabits, useToggleHabitLog } from '@/hooks/useHabits'
import TaskModal from '@/components/tasks/TaskModal'
import TagBadgeGroup from '@/components/tasks/TagBadgeGroup'
import AsciiPet from '@/components/today/AsciiPet'
import Spinner from '@/components/ui/Spinner'
import { useDailyTip } from '@/hooks/useDailyTip'
import { parseTaskInput, friendlyDate, type TokenSpan } from '@/utils/parseTask'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Жёсткое ограничение длины заголовка задачи в списках, чтобы длинный
 *  заголовок не растягивал строку и страницу. CSS `truncate` помимо этого
 *  обрежет текст многоточием на узких экранах. */
const TITLE_MAX_CHARS = 50
function truncateTitle(s: string, max: number = TITLE_MAX_CHARS): string {
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s
}

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

function formatRelativeDate(
  dateStr: string | null | undefined,
  todayStr: string,
): { text: string; tomorrow: boolean } | null {
  if (!dateStr) return null
  const dateOnly = dateStr.slice(0, 10)
  if (dateOnly === todayStr) return null

  const today = parseISO(todayStr)
  const target = parseISO(dateOnly)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)

  if (diffDays === 1) return { text: 'завтра', tomorrow: true }
  if (diffDays === -1) return { text: 'вчера', tomorrow: false }

  return { text: format(target, 'd MMM', { locale: ru }), tomorrow: false }
}

type TodayTaskType = 'scheduled' | 'deadline' | 'my_day'

// ─── Unified task row ────────────────────────────────────────────────────────

function TodayTaskRow({
  task,
  type,
  todayStr,
  onToggle,
  onRemove,
  onClick,
}: {
  task: Task
  type: TodayTaskType
  todayStr: string
  onToggle: () => void
  onRemove?: () => void
  onClick: () => void
}) {
  const done = task.status === 'done'

  const timeLabel =
    type === 'scheduled' && task.scheduled_start
      ? new Date(task.scheduled_start).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

  const dateLabel = formatRelativeDate(
    task.scheduled_start ?? task.deadline,
    todayStr,
  )

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group',
        done
          ? 'opacity-40 border-gray-100 dark:border-gray-700/50'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
      )}
      style={
        done
          ? { backgroundColor: `${task.color}08`, borderColor: `${task.color}30` }
          : undefined
      }
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all border-2',
          done
            ? 'text-white border-transparent'
            : 'border-gray-300 dark:border-gray-600 hover:border-amber-400'
        )}
        style={done ? { backgroundColor: task.color } : undefined}
      >
        {done && (
          <svg
            width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Color accent */}
      <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />

      {/* Time badge (scheduled) */}
      {timeLabel && (
        <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 flex-shrink-0 w-10 select-none">
          {timeLabel}
        </span>
      )}

      {/* Title */}
      <button
        type="button"
        onClick={onClick}
        title={task.title}
        className={clsx(
          'flex-1 min-w-0 text-sm font-medium text-left truncate transition-colors',
          done
            ? 'line-through text-gray-400 dark:text-gray-500'
            : 'text-gray-900 dark:text-gray-100 hover:text-amber-700 dark:hover:text-amber-400'
        )}
      >
        {truncateTitle(task.title)}
      </button>

      {/* Tags */}
      {!done && task.tags && task.tags.length > 0 && (
        <TagBadgeGroup tags={task.tags} className="flex-shrink-0" />
      )}

      {/* Date badge (shows "завтра" in amber or formatted date) */}
      {!done && dateLabel && (
        <span
          className={clsx(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap',
            dateLabel.tomorrow
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'text-gray-400 dark:text-gray-500',
          )}
        >
          {dateLabel.text}
        </span>
      )}

      {/* Deadline badge */}
      {!done && type === 'deadline' && (
        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
          Дедлайн
        </span>
      )}

      {/* Remove from today (manual my_day tasks only) */}
      {type === 'my_day' && onRemove && !done && (
        <button
          type="button"
          onClick={onRemove}
          title="Убрать из сегодня"
          className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-gray-200 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Backlog task row ─────────────────────────────────────────────────────────

function BacklogTaskRow({
  task,
  todayStr,
  onDone,
  onClick,
}: {
  task: Task
  todayStr: string
  onDone: () => void
  onClick: () => void
}) {
  const isOverdue = task.deadline != null && task.deadline.slice(0, 10) < todayStr
  const dateLabel = formatRelativeDate(
    task.scheduled_start ?? task.deadline,
    todayStr,
  )

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-xl border transition-all',
        isOverdue
          ? 'bg-red-50/40 dark:bg-red-900/10 border-red-200 dark:border-red-800/50 hover:border-red-300'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      <button
        type="button"
        onClick={onDone}
        title="Отметить выполненной"
        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all group"
      >
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className="opacity-0 group-hover:opacity-100 text-emerald-500 transition-opacity"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
      <button
        type="button"
        onClick={onClick}
        title={task.title}
        className="flex-1 min-w-0 text-sm font-medium text-left text-gray-900 dark:text-gray-100 hover:text-amber-700 dark:hover:text-amber-400 transition-colors truncate"
      >
        {truncateTitle(task.title)}
      </button>
      {task.tags && task.tags.length > 0 && (
        <TagBadgeGroup tags={task.tags} className="flex-shrink-0" />
      )}
      {!isOverdue && dateLabel && (
        <span
          className={clsx(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap',
            dateLabel.tomorrow
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'text-gray-400 dark:text-gray-500',
          )}
        >
          {dateLabel.text}
        </span>
      )}
      {isOverdue && (
        <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
          Просрочено
        </span>
      )}
    </div>
  )
}

// ─── Habit row ────────────────────────────────────────────────────────────────

function HabitRow({ habit, done, onToggle }: { habit: Habit; done: boolean; onToggle: () => void }) {
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

// ─── Quick-add highlight helpers ─────────────────────────────────────────────

function buildSegments(text: string, spans: TokenSpan[]) {
  if (!text || spans.length === 0) return [{ text, highlighted: false }]
  const segs: { text: string; highlighted: boolean }[] = []
  let pos = 0
  for (const span of spans) {
    if (span.start > pos) segs.push({ text: text.slice(pos, span.start), highlighted: false })
    if (span.end > span.start) segs.push({ text: text.slice(span.start, span.end), highlighted: true })
    pos = span.end
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), highlighted: false })
  return segs
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  const [backlogOpen, setBacklogOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const quickAddInputRef = useRef<HTMLInputElement>(null)
  const quickAddBackdropRef = useRef<HTMLDivElement>(null)

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

  // Auto-clear scheduled date on tasks whose scheduled day has already passed
  // — они уходят в бэклог вместо «висящих просроченных». Делаем это один раз
  // за визит, показываем один тост со всеми и даём Undo.
  const cleanupRanRef = useRef(false)
  useEffect(() => {
    if (!allTasks || cleanupRanRef.current) return

    const overdue: Array<{ id: number; prevStart: string; prevEnd: string | null }> = []
    for (const t of allTasks) {
      if (t.is_archived) continue
      if (t.status === 'done') continue
      if (t.repeat_days && t.repeat_days.length > 0) continue
      if (!t.scheduled_start) continue
      if (t.scheduled_start.slice(0, 10) >= todayStr) continue
      overdue.push({ id: t.id, prevStart: t.scheduled_start, prevEnd: t.scheduled_end ?? null })
    }
    if (overdue.length === 0) return

    cleanupRanRef.current = true
    for (const { id } of overdue) {
      patchTask.mutate({ id, data: { scheduled_start: null, scheduled_end: null } })
    }

    const label =
      overdue.length === 1
        ? '1 просроченная задача перенесена в бэклог'
        : `${overdue.length} просроченных задач перенесены в бэклог`

    toast(
      (toastObj) => (
        <div className="flex items-center gap-3">
          <span>{label}</span>
          <button
            type="button"
            className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            onClick={() => {
              for (const item of overdue) {
                patchTask.mutate({
                  id: item.id,
                  data: { scheduled_start: item.prevStart, scheduled_end: item.prevEnd },
                })
              }
              toast.dismiss(toastObj.id)
            }}
          >
            Отменить
          </button>
        </div>
      ),
      { duration: 6000 },
    )
  }, [allTasks, todayStr, patchTask])

  // ── Unified "today" list: scheduled → deadline → my_day ──────────────────
  const todayUnified = useMemo(() => {
    if (!allTasks) return []
    const seen = new Set<number>()
    const result: Array<{ task: Task; type: TodayTaskType }> = []

    // 1. Scheduled today (sorted by time)
    allTasks
      .filter((t) => {
        if (t.is_archived) return false
        if (!t.scheduled_start) return false
        if (t.repeat_days?.length) return t.repeat_days.includes(wd)
        return isSameDay(parseISO(t.scheduled_start), today)
      })
      .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
      .forEach((t) => { seen.add(t.id); result.push({ task: t, type: 'scheduled' }) })

    // 2. Deadline today (not already shown)
    allTasks
      .filter(
        (t) =>
          !t.is_archived &&
          !seen.has(t.id) &&
          t.deadline?.slice(0, 10) === todayStr &&
          t.status !== 'done'
      )
      .forEach((t) => { seen.add(t.id); result.push({ task: t, type: 'deadline' }) })

    // 3. My Day (manual, not already shown)
    allTasks
      .filter((t) => !t.is_archived && !seen.has(t.id) && t.my_day)
      .forEach((t) => { seen.add(t.id); result.push({ task: t, type: 'my_day' }) })

    return result
  }, [allTasks, today, todayStr, wd])

  // ── Backlog ───────────────────────────────────────────────────────────────
  const backlogTasks = useMemo(() => {
    if (!allTasks) return []
    const todayIds = new Set(todayUnified.map((e) => e.task.id))
    return allTasks.filter(
      (t) =>
        !t.is_archived &&
        t.status !== 'done' &&
        !todayIds.has(t.id)
    )
  }, [allTasks, todayUnified])

  // ── Picker (add from list) ────────────────────────────────────────────────
  const allPickerTasks = useMemo(() => {
    if (!allTasks) return []
    return allTasks.filter((t) => !t.my_day && !t.is_archived && t.status !== 'done')
  }, [allTasks])

  const pickerTasks = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    return allPickerTasks
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => {
        const ba = a.board_id == null ? '' : (boards?.find((board) => board.id === a.board_id)?.name ?? '')
        const bb = b.board_id == null ? '' : (boards?.find((board) => board.id === b.board_id)?.name ?? '')
        if (ba < bb) return -1
        if (ba > bb) return 1
        return a.title.localeCompare(b.title, 'ru')
      })
  }, [allPickerTasks, pickerSearch, boards])

  // ── Progress ──────────────────────────────────────────────────────────────
  const activeHabits = useMemo(() => habits?.filter((h) => h.is_active) ?? [], [habits])
  const isHabitDone = (h: Habit) => h.logs.some((l) => l.date === todayStr)
  const doneTodayCount = todayUnified.filter(({ task }) => task.status === 'done').length
  const doneHabits = activeHabits.filter(isHabitDone).length
  const taskPct = todayUnified.length > 0 ? Math.round((doneTodayCount / todayUnified.length) * 100) : 0
  const habitPct = activeHabits.length > 0 ? Math.round((doneHabits / activeHabits.length) * 100) : 0

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  const parsedPreview = useMemo(() => {
    if (!quickAdd.trim()) return null
    return parseTaskInput(quickAdd, today)
  }, [quickAdd, today])

  const handleQuickAdd = async () => {
    const raw = quickAdd.trim()
    if (!raw) return
    const parsed = parseTaskInput(raw, today)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const taskData: any = { title: parsed.title || raw }

      if (parsed.scheduledDate && parsed.startTime && parsed.endTime) {
        // Full scheduled slot — not my_day unless it's today
        taskData.scheduled_start = new Date(`${parsed.scheduledDate}T${parsed.startTime}:00`).toISOString()
        taskData.scheduled_end   = new Date(`${parsed.scheduledDate}T${parsed.endTime}:00`).toISOString()
        taskData.my_day = parsed.scheduledDate === todayStr
      } else if (parsed.scheduledDate && parsed.scheduledDate !== todayStr) {
        // Future date with no time → treat as deadline so it shows up there
        taskData.deadline = new Date(`${parsed.scheduledDate}T23:59:00`).toISOString()
        taskData.my_day = false
      } else {
        taskData.my_day = true
      }

      if (parsed.deadline) {
        taskData.deadline = new Date(`${parsed.deadline}T23:59:00`).toISOString()
      }

      await createTask.mutateAsync(taskData)
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
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">{getGreeting()}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 capitalize">
            {format(today, 'EEEE, d MMMM', { locale: ru })}
          </h1>
        </div>
      </div>

      {/* ── Compact progress ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${taskPct}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap tabular-nums">
            {doneTodayCount}/{todayUnified.length} задач
          </span>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${habitPct}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap tabular-nums">
            {doneHabits}/{activeHabits.length} привычек
          </span>
        </div>
      </div>

      {/* ── Pet (mobile) ────────────────────────────────────────────────────── */}
      <div className="lg:hidden">
        <AsciiPet tip={tip} isLoading={tipLoading} />
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-start">

        {/* Left — tasks + backlog */}
        <div className="space-y-4">

          {/* Quick-add with inline token highlight */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              {/* Backdrop + transparent input trick */}
              <div className="relative flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus-within:border-amber-400 dark:focus-within:border-amber-500 transition-colors">
                {/* Backdrop: renders plain text + underlined tokens, scrolls in sync with input */}
                <div
                  ref={quickAddBackdropRef}
                  aria-hidden
                  className="absolute inset-0 px-3 py-2 text-sm pointer-events-none select-none overflow-hidden whitespace-pre rounded-xl"
                >
                  {quickAdd === '' ? (
                    <span className="text-gray-400 dark:text-gray-500">Встреча завтра в 11:00 на 2 часа...</span>
                  ) : (
                    buildSegments(quickAdd, parsedPreview?.spans ?? []).map((seg, i) =>
                      seg.highlighted ? (
                        <span
                          key={i}
                          className="text-gray-900 dark:text-gray-100 underline decoration-amber-400 decoration-2 underline-offset-2"
                        >
                          {seg.text}
                        </span>
                      ) : (
                        <span key={i} className="text-gray-900 dark:text-gray-100">{seg.text}</span>
                      )
                    )
                  )}
                </div>
                {/* Actual input — transparent text so backdrop shows through */}
                <input
                  ref={quickAddInputRef}
                  type="text"
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                  onScroll={() => {
                    if (quickAddBackdropRef.current && quickAddInputRef.current) {
                      quickAddBackdropRef.current.scrollLeft = quickAddInputRef.current.scrollLeft
                    }
                  }}
                  className="quick-add relative w-full text-sm px-3 py-2 rounded-xl bg-transparent border-0 text-transparent caret-gray-900 dark:caret-gray-100 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={!quickAdd.trim()}
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {/* Parsed result summary — shown below input */}
            {parsedPreview && quickAdd.trim() && (parsedPreview.scheduledDate || parsedPreview.startTime || parsedPreview.deadline) && (
              <div className="flex items-center gap-1.5 px-1 flex-wrap">
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium truncate max-w-[180px]">
                  {parsedPreview.title || quickAdd.trim()}
                </span>
                {parsedPreview.scheduledDate && (
                  <span className="text-[11px] bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                    {friendlyDate(parsedPreview.scheduledDate, todayStr)}
                  </span>
                )}
                {parsedPreview.startTime && parsedPreview.endTime && (
                  <span className="text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-mono">
                    {parsedPreview.startTime}–{parsedPreview.endTime}
                  </span>
                )}
                {parsedPreview.deadline && (
                  <span className="text-[11px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                    дедлайн {friendlyDate(parsedPreview.deadline, todayStr)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Unified today list */}
          {todayUnified.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-3">
              Нет задач на сегодня — добавь или назначь дедлайн
            </p>
          ) : (
            <div className="space-y-1.5">
              {todayUnified.map(({ task, type }) => (
                <TodayTaskRow
                  key={task.id}
                  task={task}
                  type={type}
                  todayStr={todayStr}
                  onToggle={() => handleTaskToggle(task)}
                  onRemove={type === 'my_day' ? () => handleRemoveFromMyDay(task) : undefined}
                  onClick={() => openEdit(task)}
                />
              ))}
            </div>
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
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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
                        const boardName =
                          task.board_id == null
                            ? null
                            : (boards?.find((b) => b.id === task.board_id)?.name ?? `Проект ${task.board_id}`)
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => handleAddToMyDay(task)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                            <span title={task.title} className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 truncate">{truncateTitle(task.title)}</span>
                            {boardName && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 truncate max-w-[60px]">
                                {boardName}
                              </span>
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

          {/* Backlog — collapsed by default */}
          {backlogTasks.length > 0 && (
            <section className="pt-1">
              <button
                type="button"
                onClick={() => setBacklogOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              >
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={clsx('transition-transform', backlogOpen ? 'rotate-90' : '')}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Беклог
                <span className="ml-0.5 text-[10px] font-normal normal-case tracking-normal">
                  ({backlogTasks.length})
                </span>
              </button>

              {backlogOpen && (
                <div className="mt-2 space-y-4">
                  {(() => {
                    const groups: { boardId: number | null; name: string; tasks: Task[] }[] = []
                    for (const task of backlogTasks) {
                      const existing = groups.find((g) => g.boardId === task.board_id)
                      if (existing) {
                        existing.tasks.push(task)
                      } else {
                        const boardName =
                          task.board_id == null
                            ? 'Входящие'
                            : (boards?.find((b) => b.id === task.board_id)?.name ?? `Проект ${task.board_id}`)
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
                              todayStr={todayStr}
                              onDone={() => handleMarkDone(task)}
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
