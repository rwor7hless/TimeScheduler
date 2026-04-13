import { useState, useEffect, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import TimeRangeInput from '@/components/ui/TimeRangeInput'
import TimePicker from '@/components/ui/TimePicker'
import { useCreateTask, useUpdateTask, useDeleteTask, usePatchTask, useTags } from '@/hooks/useTasks'
import type { Task, TaskCreate, Priority, KanbanStatus } from '@/types/task'
import { TASK_COLOR_PALETTE, WEEKDAY_LABELS } from '@/types/task'
import toast from 'react-hot-toast'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  task?: Task | null
  defaultDate?: string
  defaultStatus?: KanbanStatus
  boardId?: number | null
}

const PRIORITY_CONFIG: { value: Priority; label: string; activeClass: string; ghostClass: string }[] = [
  {
    value: 'low',
    label: 'Низкий',
    activeClass: 'bg-gray-500 text-white',
    ghostClass: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
  },
  {
    value: 'medium',
    label: 'Средний',
    activeClass: 'bg-blue-500 text-white',
    ghostClass: 'text-blue-400 hover:text-blue-600 hover:bg-blue-50',
  },
  {
    value: 'high',
    label: 'Высокий',
    activeClass: 'bg-orange-500 text-white',
    ghostClass: 'text-orange-400 hover:text-orange-600 hover:bg-orange-50',
  },
  {
    value: 'urgent',
    label: 'Срочный',
    activeClass: 'bg-red-500 text-white',
    ghostClass: 'text-red-400 hover:text-red-600 hover:bg-red-50',
  },
]

function randomColor(): string {
  return TASK_COLOR_PALETTE[Math.floor(Math.random() * TASK_COLOR_PALETTE.length)]
}

function parseDatetime(isoString: string): { date: string; startTime: string } {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const startTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return { date, startTime }
}

export default function TaskModal({ isOpen, onClose, task, defaultDate, defaultStatus, boardId }: TaskModalProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const [localSubtasks, setLocalSubtasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [status, setStatus] = useState<KanbanStatus>('todo')
  const [scheduledDate, setScheduledDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [showDeadline, setShowDeadline] = useState(false)
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [tgRemind, setTgRemind] = useState(false)
  const [tgRemindDate, setTgRemindDate] = useState('')
  const [tgRemindTime, setTgRemindTime] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const { data: tags } = useTags()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const patchTask = usePatchTask()

  // Initialize localSubtasks only when the modal opens for a new task (not on every re-render)
  const openedTaskIdRef = useRef<number | null>(null)
  useEffect(() => {
    if (isOpen && task) {
      if (openedTaskIdRef.current !== task.id) {
        openedTaskIdRef.current = task.id
        setLocalSubtasks(task.subtasks ?? [])
      }
    } else if (!isOpen) {
      openedTaskIdRef.current = null
      setLocalSubtasks([])
    }
  }, [isOpen, task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setPriority(task.priority)
      setStatus(task.status)
      if (task.scheduled_start && task.scheduled_end) {
        const startParsed = parseDatetime(task.scheduled_start)
        const endParsed = parseDatetime(task.scheduled_end)
        setScheduledDate(startParsed.date)
        setStartTime(startParsed.startTime)
        setEndTime(endParsed.startTime)
      } else {
        setScheduledDate('')
        setStartTime('')
        setEndTime('')
      }
      if (task.deadline) {
        const parsed = parseDatetime(task.deadline)
        setDeadlineDate(parsed.date)
        setDeadlineTime(parsed.startTime)
        setShowDeadline(true)
      } else {
        setDeadlineDate('')
        setDeadlineTime('')
        setShowDeadline(false)
      }
      setRepeatDays(task.repeat_days ?? [])
      setSelectedTagIds(task.tags.map((t) => t.id))
      setTgRemind(task.tg_remind ?? false)
      if (task.tg_remind_at) {
        const parsed = parseDatetime(task.tg_remind_at)
        setTgRemindDate(parsed.date)
        setTgRemindTime(parsed.startTime)
      } else {
        setTgRemindDate('')
        setTgRemindTime('')
      }
      const hasAdvanced =
        (task.repeat_days && task.repeat_days.length > 0) ||
        task.tags.length > 0 ||
        task.tg_remind ||
        task.status === 'done'
      setShowAdvanced(hasAdvanced)
    } else {
      setTitle('')
      setDescription('')
      setPriority('medium')
      setStatus(defaultStatus ?? 'todo')
      setRepeatDays([])
      setSelectedTagIds([])
      setTgRemind(false)
      setTgRemindDate('')
      setTgRemindTime('')
      setDeadlineDate('')
      setDeadlineTime('')
      setShowDeadline(false)
      setShowAdvanced(false)
      setShowSubtaskInput(false)
      setNewSubtaskTitle('')

      if (defaultDate) {
        const defaultDateStr = defaultDate.includes('T') ? defaultDate : `${defaultDate}T09:00`
        const p = parseDatetime(defaultDateStr)
        const [h, m] = p.startTime.split(':').map(Number)
        const endH = (h + 1) % 24
        setScheduledDate(p.date)
        setStartTime(p.startTime)
        setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      } else {
        setScheduledDate('')
        setStartTime('')
        setEndTime('')
      }
    }
  }, [task, isOpen, defaultDate, defaultStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    // Validate time range only at submit time
    if (scheduledDate && startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      if (eh * 60 + em <= sh * 60 + sm) {
        toast.error('Время окончания должно быть позже начала')
        return
      }
    }

    const scheduled_start = scheduledDate && startTime && endTime
      ? new Date(`${scheduledDate}T${startTime}:00`).toISOString()
      : null
    const scheduled_end = scheduledDate && startTime && endTime
      ? new Date(`${scheduledDate}T${endTime}:00`).toISOString()
      : null

    const deadline = showDeadline && deadlineDate
      ? new Date(`${deadlineDate}T${deadlineTime || '23:59'}:00`).toISOString()
      : null

    const tg_remind_at = tgRemind && tgRemindDate && tgRemindTime
      ? new Date(`${tgRemindDate}T${tgRemindTime}:00`).toISOString()
      : null

    const data: TaskCreate = {
      title: title.trim(),
      description: description || null,
      color: task ? task.color : randomColor(),
      priority,
      status,
      scheduled_start,
      scheduled_end,
      deadline,
      repeat_days: repeatDays.length > 0 ? repeatDays : [],
      tag_ids: selectedTagIds,
      board_id: boardId ?? task?.board_id ?? null,
      parent_id: task?.parent_id ?? null,
      tg_remind: tgRemind,
      tg_remind_at,
    }

    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, data })
        toast.success('Задача обновлена')
      } else {
        await createTask.mutateAsync(data)
        toast.success('Задача создана')
      }
      onClose()
    } catch {
      toast.error('Не удалось сохранить задачу')
    }
  }

  const handleDelete = async () => {
    if (!task) return
    try {
      await deleteTask.mutateAsync(task.id)
      toast.success('Задача удалена')
      onClose()
    } catch {
      toast.error('Не удалось удалить задачу')
    }
  }

  const handleAddSubtask = async () => {
    if (!task || !newSubtaskTitle.trim()) return
    try {
      const created = await createTask.mutateAsync({
        title: newSubtaskTitle.trim(),
        priority: 'medium',
        status: 'todo',
        board_id: task.board_id,
        parent_id: task.id,
      })
      setLocalSubtasks((prev) => [...prev, created])
      setNewSubtaskTitle('')
      setShowSubtaskInput(false)
      toast.success('Подзадача добавлена')
    } catch {
      toast.error('Не удалось добавить подзадачу')
    }
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Редактирование задачи' : 'Новая задача'} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Что нужно сделать?"
          required
          autoFocus
          className="w-full text-base font-medium px-1 py-1 bg-transparent border-0 border-b-2 border-gray-200 focus:border-indigo-400 focus:outline-none placeholder-gray-300 text-gray-900 dark:text-gray-100 dark:border-gray-600 dark:focus:border-indigo-400 transition-colors"
        />

        {/* Description */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full h-14 px-3 py-2 bg-gray-50/60 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 resize-none placeholder-gray-300 dark:text-gray-200 transition-colors"
          placeholder="Описание (необязательно)..."
        />

        {/* Priority pills */}
        <div className="flex gap-1.5">
          {PRIORITY_CONFIG.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                priority === p.value ? p.activeClass : `bg-gray-100/80 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 ${p.ghostClass}`
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date/Time */}
        <div className="p-3 bg-gray-50/80 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Дата и время</span>
            {scheduledDate && (
              <button
                type="button"
                onClick={() => { setScheduledDate(''); setStartTime(''); setEndTime('') }}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                Очистить
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 h-[34px] border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            {scheduledDate && (
              <TimeRangeInput
                startTime={startTime || '09:00'}
                endTime={endTime || '10:00'}
                onRangeChange={(start, end) => {
                  setStartTime(start)
                  setEndTime(end)
                }}
              />
            )}
          </div>
        </div>

        {/* Deadline */}
        {showDeadline ? (
          <div className="p-3 bg-red-950/40 dark:bg-red-950/60 border border-red-800/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-red-400 flex items-center gap-1.5 uppercase tracking-wide">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Дедлайн
              </label>
              <button
                type="button"
                onClick={() => { setShowDeadline(false); setDeadlineDate(''); setDeadlineTime('') }}
                className="text-xs text-red-800 dark:text-red-700 hover:text-red-500 transition-colors"
              >
                убрать
              </button>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs font-medium text-red-400/70">Дата</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-3 h-[34px] border border-red-800/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 bg-black/20 text-red-100 dark:text-red-200"
                />
              </div>
              <TimePicker
                label="Время"
                value={deadlineTime || '23:59'}
                onChange={setDeadlineTime}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowDeadline(true)
              if (!deadlineTime) setDeadlineTime('23:59')
            }}
            className="text-xs text-red-500/80 hover:text-red-500 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 hover:border-red-800/60 transition-all w-full"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Добавить дедлайн
          </button>
        )}

        {/* Subtasks */}
        {task && (
          <div className="border-t border-gray-100/80 dark:border-white/10 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Подзадачи
                {localSubtasks.length > 0 && (
                  <span className="ml-1.5 text-gray-400 font-normal">
                    {localSubtasks.filter((s) => s.status === 'done').length}/{localSubtasks.length}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowSubtaskInput((v) => !v)}
                className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Добавить
              </button>
            </div>

            {localSubtasks.length > 0 && (
              <ul className="space-y-0.5">
                {localSubtasks.map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 py-1 px-2 rounded-lg hover:bg-gray-50/80 dark:hover:bg-white/5 group/sub">
                    <button
                      type="button"
                      onClick={async () => {
                        const newStatus = sub.status === 'done' ? 'todo' : 'done'
                        setLocalSubtasks((prev) =>
                          prev.map((s) => s.id === sub.id ? { ...s, status: newStatus } : s)
                        )
                        try {
                          await patchTask.mutateAsync({ id: sub.id, data: { status: newStatus } })
                        } catch {
                          setLocalSubtasks((prev) =>
                            prev.map((s) => s.id === sub.id ? { ...s, status: sub.status } : s)
                          )
                        }
                      }}
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${sub.status === 'done' ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-400' : 'border-gray-300 hover:border-emerald-400'}`}
                    />
                    <span className={`flex-1 ${sub.status === 'done' ? 'line-through text-gray-400' : ''}`}>{sub.title}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setLocalSubtasks((prev) => prev.filter((s) => s.id !== sub.id))
                        try {
                          await deleteTask.mutateAsync(sub.id)
                        } catch {
                          setLocalSubtasks((prev) => [...prev, sub])
                          toast.error('Не удалось удалить подзадачу')
                        }
                      }}
                      className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-all flex-shrink-0"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showSubtaskInput && (
              <div className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask() } if (e.key === 'Escape') { setShowSubtaskInput(false); setNewSubtaskTitle('') } }}
                  placeholder="Название подзадачи..."
                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 bg-white/60 dark:bg-white/5 dark:border-white/10 dark:text-gray-200"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim() || createTask.isPending}
                  className="px-2.5 py-1.5 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 disabled:opacity-40"
                >
                  ОК
                </button>
              </div>
            )}
          </div>
        )}

        {/* Advanced section */}
        <div className="border-t border-gray-100/80 dark:border-white/10 pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span>Дополнительно</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3">
              {/* Repeat days */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Повтор</label>
                  <button
                    type="button"
                    onClick={() => setRepeatDays(repeatDays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-all ${
                      repeatDays.length === 7
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    Ежедневно
                  </button>
                </div>
                <div className="flex gap-1">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setRepeatDays((prev) =>
                          prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b)
                        )
                      }
                      className={`flex-1 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        repeatDays.includes(i)
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100/80 dark:bg-white/5 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              {tags && tags.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Теги</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                          selectedTagIds.includes(tag.id)
                            ? 'text-white ring-2 ring-offset-1'
                            : 'text-gray-600 bg-gray-100/80 dark:bg-white/5 dark:text-gray-400 hover:bg-gray-200/80'
                        }`}
                        style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Telegram reminder hidden — TG banned */}
              {false && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !tgRemind
                    setTgRemind(next)
                    if (next) {
                      if (!tgRemindTime) setTgRemindTime('09:00')
                      if (!tgRemindDate) setTgRemindDate(scheduledDate || new Date().toISOString().slice(0, 10))
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    tgRemind
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-gray-50/80 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200/80 dark:border-white/10 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.9l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.659z" />
                  </svg>
                  Напомнить в Telegram
                  {tgRemind && <span className="ml-auto text-blue-200 text-[10px]">✓</span>}
                </button>
                {tgRemind && (
                  <div className="grid grid-cols-2 gap-2 pl-1">
                    <Input
                      label="Дата"
                      type="date"
                      value={tgRemindDate}
                      onChange={(e) => setTgRemindDate(e.target.value)}
                    />
                    <TimePicker
                      label="Время"
                      value={tgRemindTime || '09:00'}
                      onChange={setTgRemindTime}
                    />
                  </div>
                )}
              </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100/80 dark:border-white/10">
          {task ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
              className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40"
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 dark:hover:bg-white/10 rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createTask.isPending || updateTask.isPending}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors disabled:opacity-40 shadow-sm"
            >
              {task ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
