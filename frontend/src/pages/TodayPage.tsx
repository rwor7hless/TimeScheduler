import { useMemo, useState, useRef, useEffect } from 'react'
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTasks, usePatchTask, useCreateTask, useReorderTasks, useBoards } from '@/hooks/useTasks'
import { useHabits, useToggleHabitLog } from '@/hooks/useHabits'
import TaskModal from '@/components/tasks/TaskModal'
import TagBadgeGroup from '@/components/tasks/TagBadgeGroup'
import ProjectChip from '@/components/tasks/ProjectChip'
import AsciiPet from '@/components/today/AsciiPet'
import PersonaPicker from '@/components/today/PersonaPicker'
import Spinner from '@/components/ui/Spinner'
import { useDailyTip } from '@/hooks/useDailyTip'
import { parseTaskInput, friendlyDate, type TokenSpan } from '@/utils/parseTask'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ─── Sortable wrapper ────────────────────────────────────────────────────────
// dnd-kit's `useSortable` already returns a `transition` value that the
// browser uses to animate siblings sliding into place when an item is
// dragged. We do NOT wrap this in framer-motion's `layout` — `layout`
// fights with dnd-kit's inline transform (each layout-change tick triggers
// a re-translate, which framer-motion then tries to animate back), which
// looks like a 10Hz jitter on the dragged row.

function SortableRow({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

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

// ─── Date sections (нижняя часть страницы — секции по дате) ────────────────

type DateSectionKey = number | 'later' | 'noDate'

/** "Дата задачи" для распределения по секциям: scheduled_start приоритетнее deadline. */
function getTaskDateOnly(task: Task): string | null {
  if (task.scheduled_start) return task.scheduled_start.slice(0, 10)
  if (task.deadline) return task.deadline.slice(0, 10)
  return null
}

function getDateSectionKey(task: Task, todayStr: string): DateSectionKey | null {
  const taskDate = getTaskDateOnly(task)
  if (!taskDate) return 'noDate'
  if (taskDate <= todayStr) return null // прошлое или сегодня — обрабатывается отдельно
  const diffDays = differenceInCalendarDays(parseISO(taskDate), parseISO(todayStr))
  if (diffDays > 30) return 'later'
  return diffDays
}

function getDateSectionLabel(key: DateSectionKey, today: Date): string {
  if (key === 'later') return 'Позднее'
  if (key === 'noDate') return 'Отложенное'
  if (key === 1) return 'Завтра'
  if (key === 2) return 'Послезавтра'
  if (key === 3) return 'Через 3 дня'
  if (typeof key === 'number') {
    return format(addDays(today, key), 'd MMMM', { locale: ru })
  }
  return ''
}

/** Завтра / Послезавтра / Через 3 дня — открыты по умолчанию. Дальше — свёрнуто. */
const DEFAULT_OPEN_SECTION_KEYS = new Set<string>(['1', '2', '3'])

// ─── Unified task row ────────────────────────────────────────────────────────

function TodayTaskRow({
  task,
  type,
  todayStr,
  boardName,
  onToggle,
  onRemove,
  onClick,
}: {
  task: Task
  type: TodayTaskType
  todayStr: string
  boardName: string | null
  onToggle: () => void
  onRemove?: () => void
  onClick: () => void
}) {
  const done = task.done

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
          ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
      )}
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
      <div
        className={clsx('w-1 h-4 rounded-full flex-shrink-0', done && 'opacity-50')}
        style={{ backgroundColor: task.color }}
      />

      {/* Time badge (scheduled) */}
      {timeLabel && (
        <span
          className={clsx(
            'text-[11px] font-mono flex-shrink-0 w-10 select-none',
            done
              ? 'text-gray-400 dark:text-gray-600 line-through'
              : 'text-gray-400 dark:text-gray-500',
          )}
        >
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
            ? 'line-through text-gray-500 dark:text-gray-400'
            : 'text-gray-900 dark:text-gray-100 hover:text-amber-700 dark:hover:text-amber-400'
        )}
      >
        {truncateTitle(task.title)}
      </button>

      {/* Tags */}
      {!done && task.tags && task.tags.length > 0 && (
        <TagBadgeGroup tags={task.tags} className="flex-shrink-0" />
      )}

      {/* Project badge (faded, right-aligned) */}
      {!done && boardName && (
        <span
          className="text-[10px] font-medium text-gray-400 dark:text-gray-500 max-w-[80px] truncate flex-shrink-0"
          title={boardName}
        >
          {boardName}
        </span>
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
  boardName,
  onToggle,
  onAddToMyDay,
  onClick,
}: {
  task: Task
  todayStr: string
  boardName: string | null
  onToggle: () => void
  onAddToMyDay?: () => void
  onClick: () => void
}) {
  const done = task.done
  const isOverdue = !done && task.deadline != null && task.deadline.slice(0, 10) < todayStr
  const dateLabel = formatRelativeDate(
    task.scheduled_start ?? task.deadline,
    todayStr,
  )

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-xl border transition-all group',
        done
          ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        title={done ? 'Снять отметку' : 'Отметить выполненной'}
        className={clsx(
          'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all border-2',
          done
            ? 'text-white border-transparent'
            : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
        )}
        style={done ? { backgroundColor: task.color } : undefined}
      >
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className={clsx(
            done ? '' : 'opacity-0 group-hover:opacity-100 text-emerald-500 transition-opacity'
          )}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <div
        className={clsx('w-1 h-4 rounded-full flex-shrink-0', done && 'opacity-50')}
        style={{ backgroundColor: task.color }}
      />
      <button
        type="button"
        onClick={onClick}
        title={task.title}
        className={clsx(
          'flex-1 min-w-0 text-sm font-medium text-left transition-colors truncate',
          done
            ? 'line-through text-gray-500 dark:text-gray-400'
            : 'text-gray-900 dark:text-gray-100 hover:text-amber-700 dark:hover:text-amber-400'
        )}
      >
        {truncateTitle(task.title)}
      </button>
      {!done && task.tags && task.tags.length > 0 && (
        <TagBadgeGroup tags={task.tags} className="flex-shrink-0" />
      )}
      {!done && boardName && (
        <span
          className="text-[10px] font-medium text-gray-400 dark:text-gray-500 max-w-[80px] truncate flex-shrink-0"
          title={boardName}
        >
          {boardName}
        </span>
      )}
      {!done && dateLabel && (
        <span
          className={clsx(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap',
            isOverdue
              ? 'text-red-500 dark:text-red-400'
              : dateLabel.tomorrow
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'text-gray-400 dark:text-gray-500',
          )}
        >
          {dateLabel.text}
        </span>
      )}
      {!done && onAddToMyDay && (
        <button
          type="button"
          onClick={onAddToMyDay}
          title="Добавить в сегодня"
          className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
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
  const { data: habits, isLoading: habitsLoading } = useHabits()
  const { data: boards = [] } = useBoards()
  const patchTask = usePatchTask()
  const createTask = useCreateTask()
  const reorderTasks = useReorderTasks()
  const toggleLog = useToggleHabitLog()

  const boardsById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of boards) m.set(b.id, b.name)
    return m
  }, [boards])
  // Mouse/trackpad: 6px movement starts drag (so a single click on a row
  // child like the checkbox doesn't accidentally drag).
  // Touch: hold for 200ms, allow 5px finger jitter — distinguishes a drag
  // gesture from a scroll swipe and from a button tap.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleSectionDragEnd = (currentIds: number[]) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = currentIds.indexOf(Number(active.id))
    const newIndex = currentIds.indexOf(Number(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(currentIds, oldIndex, newIndex)
    reorderTasks.mutate({ ordered_ids: next })
  }

  const { tip, isLoading: tipLoading, forcePersona, overrideId, refresh: refreshTip } = useDailyTip()

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState('')
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [topTab, setTopTab] = useState<'today' | 'overdue'>('today')
  const [sectionOverrides, setSectionOverrides] = useState<Map<string, boolean>>(new Map())
  const quickAddInputRef = useRef<HTMLInputElement>(null)
  const quickAddBackdropRef = useRef<HTMLDivElement>(null)

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
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position
        return new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime()
      })
      .forEach((t) => { seen.add(t.id); result.push({ task: t, type: 'scheduled' }) })

    // 2. Deadline today (not already shown)
    allTasks
      .filter(
        (t) =>
          !t.is_archived &&
          !seen.has(t.id) &&
          t.deadline?.slice(0, 10) === todayStr
      )
      .forEach((t) => { seen.add(t.id); result.push({ task: t, type: 'deadline' }) })

    // 3. My Day (manual, not already shown)
    allTasks
      .filter((t) => !t.is_archived && !seen.has(t.id) && t.my_day)
      .forEach((t) => { seen.add(t.id); result.push({ task: t, type: 'my_day' }) })

    return result
  }, [allTasks, today, todayStr, wd])

  // ── Overdue (вкладка рядом с "Сегодня") ────────────────────────────────────
  // Просрочено = есть deadline в прошлом, не done, не archived, не в "Сегодня",
  // не повторяющаяся (у регулярных задач deadline трактуется иначе).
  const overdueTasks = useMemo(() => {
    if (!allTasks) return []
    const todayIds = new Set(todayUnified.map((e) => e.task.id))
    return allTasks
      .filter(
        (t) =>
          !todayIds.has(t.id) &&
          !t.is_archived &&
          !t.done &&
          !(t.repeat_days && t.repeat_days.length > 0) &&
          t.deadline != null &&
          t.deadline.slice(0, 10) < todayStr,
      )
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position
        return a.deadline!.localeCompare(b.deadline!)
      })
  }, [allTasks, todayUnified, todayStr])

  // ── Date sections (нижняя часть: Завтра / Послезавтра / Через 3 дня /
  //    конкретные даты до +30 / Позднее / Отложенное) ─────────────────────────
  const dateSections = useMemo(() => {
    if (!allTasks) return []
    const todayIds = new Set(todayUnified.map((e) => e.task.id))
    const overdueIds = new Set(overdueTasks.map((t) => t.id))
    const buckets = new Map<DateSectionKey, Task[]>()

    for (const task of allTasks) {
      if (task.is_archived) continue
      if (task.done) continue
      if (todayIds.has(task.id)) continue
      if (overdueIds.has(task.id)) continue
      if (task.repeat_days && task.repeat_days.length > 0) continue
      const key = getDateSectionKey(task, todayStr)
      if (key === null) continue
      const arr = buckets.get(key)
      if (arr) arr.push(task)
      else buckets.set(key, [task])
    }

    for (const arr of buckets.values()) {
      arr.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position
        const aD = getTaskDateOnly(a) ?? ''
        const bD = getTaskDateOnly(b) ?? ''
        if (aD !== bD) return aD < bD ? -1 : 1
        const aT = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity
        const bT = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity
        if (aT !== bT) return aT - bT
        return a.title.localeCompare(b.title, 'ru')
      })
    }

    const sections: { key: DateSectionKey; label: string; tasks: Task[] }[] = []
    for (let i = 1; i <= 30; i++) {
      const arr = buckets.get(i)
      if (arr && arr.length > 0) {
        sections.push({ key: i, label: getDateSectionLabel(i, today), tasks: arr })
      }
    }
    const later = buckets.get('later')
    if (later && later.length > 0) {
      sections.push({ key: 'later', label: getDateSectionLabel('later', today), tasks: later })
    }
    const noDate = buckets.get('noDate')
    if (noDate && noDate.length > 0) {
      sections.push({ key: 'noDate', label: getDateSectionLabel('noDate', today), tasks: noDate })
    }
    return sections
  }, [allTasks, todayUnified, overdueTasks, todayStr, today])

  // Если вкладка "Просрочено" открыта, а просрочек больше нет — переключаемся.
  useEffect(() => {
    if (topTab === 'overdue' && overdueTasks.length === 0) {
      setTopTab('today')
    }
  }, [topTab, overdueTasks.length])

  const isSectionOpen = (key: string): boolean => {
    if (sectionOverrides.has(key)) return sectionOverrides.get(key)!
    return DEFAULT_OPEN_SECTION_KEYS.has(key)
  }

  const toggleSection = (key: string) => {
    const current = isSectionOpen(key)
    setSectionOverrides((prev) => {
      const next = new Map(prev)
      next.set(key, !current)
      return next
    })
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  const activeHabits = useMemo(() => habits?.filter((h) => h.is_active) ?? [], [habits])
  const isHabitDone = (h: Habit) => h.logs.some((l) => l.date === todayStr)
  const doneTodayCount = todayUnified.filter(({ task }) => task.done).length
  const doneHabits = activeHabits.filter(isHabitDone).length
  const taskPct = todayUnified.length > 0 ? Math.round((doneTodayCount / todayUnified.length) * 100) : 0
  const habitPct = activeHabits.length > 0 ? Math.round((doneHabits / activeHabits.length) * 100) : 0

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTaskToggle = async (task: Task) => {
    const newDone = !task.done
    try {
      await patchTask.mutateAsync({ id: task.id, data: { done: newDone } })
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

      taskData.board_id = selectedBoardId

      await createTask.mutateAsync(taskData)
      setQuickAdd('')
      setSelectedBoardId(null)
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
      <div className="topbar">
        <div>
          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{getGreeting()}</p>
          <h1 className="page-title capitalize" style={{ fontSize: 28 }}>
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
      <div className="lg:hidden space-y-2">
        <AsciiPet
          short={tip?.short ?? null}
          long={tip?.long ?? null}
          persona={tip?.persona ?? null}
          isLoading={tipLoading}
          progress={(taskPct + habitPct) / 200}
          celebrateKey={doneTodayCount + doneHabits}
          onRefresh={refreshTip}
        />
        <PersonaPicker
          selectedId={overrideId}
          onPick={forcePersona}
          disabled={tipLoading}
        />
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
              <ProjectChip
                boards={boards}
                selectedId={selectedBoardId}
                onSelect={setSelectedBoardId}
              />
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

          {/* Tabs: Сегодня / Просрочено — вкладка появляется только если N>0 */}
          {overdueTasks.length > 0 && (
            <div className="ts-subtabs">
              <button
                type="button"
                onClick={() => setTopTab('today')}
                className={clsx(topTab === 'today' && 'active')}
              >
                Сегодня
                {todayUnified.length > 0 && (
                  <span className="ml-1 opacity-60">({todayUnified.length})</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTopTab('overdue')}
                className={clsx(topTab === 'overdue' && 'active')}
              >
                Просрочено
                <span className="ml-1 text-red-500 dark:text-red-400">({overdueTasks.length})</span>
              </button>
            </div>
          )}

          {/* Top section: today list или overdue list */}
          {topTab === 'overdue' && overdueTasks.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSectionDragEnd(overdueTasks.map((t) => t.id))}
            >
              <SortableContext
                items={overdueTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {overdueTasks.map((task) => (
                    <SortableRow key={task.id} id={task.id}>
                      <BacklogTaskRow
                        task={task}
                        todayStr={todayStr}
                        boardName={task.board_id ? boardsById.get(task.board_id) ?? null : null}
                        onToggle={() => handleTaskToggle(task)}
                        onAddToMyDay={() => handleAddToMyDay(task)}
                        onClick={() => openEdit(task)}
                      />
                    </SortableRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : todayUnified.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-3">
              Нет задач на сегодня — добавь или назначь дедлайн
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSectionDragEnd(todayUnified.map((e) => e.task.id))}
            >
              <SortableContext
                items={todayUnified.map((e) => e.task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {todayUnified.map(({ task, type }) => (
                    <SortableRow key={task.id} id={task.id}>
                      <TodayTaskRow
                        task={task}
                        type={type}
                        todayStr={todayStr}
                        boardName={task.board_id ? boardsById.get(task.board_id) ?? null : null}
                        onToggle={() => handleTaskToggle(task)}
                        onRemove={type === 'my_day' ? () => handleRemoveFromMyDay(task) : undefined}
                        onClick={() => openEdit(task)}
                      />
                    </SortableRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Секции по дате: Завтра / Послезавтра / Через 3 дня / 5 мая / ... / Позднее / Отложенное */}
          {dateSections.map((section) => {
            const keyStr = String(section.key)
            const open = isSectionOpen(keyStr)
            return (
              <section key={keyStr} className="pt-1">
                <button
                  type="button"
                  onClick={() => toggleSection(keyStr)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
                >
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={clsx('transition-transform', open ? 'rotate-90' : '')}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {section.label}
                  <span className="ml-0.5 text-[10px] font-normal normal-case tracking-normal">
                    ({section.tasks.length})
                  </span>
                </button>
                {open && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSectionDragEnd(section.tasks.map((t) => t.id))}
                  >
                    <SortableContext
                      items={section.tasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="mt-2 space-y-1.5">
                        {section.tasks.map((task) => (
                          <SortableRow key={task.id} id={task.id}>
                            <BacklogTaskRow
                              task={task}
                              todayStr={todayStr}
                              boardName={task.board_id ? boardsById.get(task.board_id) ?? null : null}
                              onToggle={() => handleTaskToggle(task)}
                              onAddToMyDay={() => handleAddToMyDay(task)}
                              onClick={() => openEdit(task)}
                            />
                          </SortableRow>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </section>
            )
          })}
        </div>

        {/* Right — pet + habits */}
        <div className="space-y-5">
          <div className="hidden lg:block space-y-2">
            <AsciiPet
              short={tip?.short ?? null}
              long={tip?.long ?? null}
              persona={tip?.persona ?? null}
              isLoading={tipLoading}
              progress={(taskPct + habitPct) / 200}
              celebrateKey={doneTodayCount + doneHabits}
              onRefresh={refreshTip}
            />
            <PersonaPicker
              selectedId={overrideId}
              onPick={forcePersona}
              disabled={tipLoading}
            />
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
