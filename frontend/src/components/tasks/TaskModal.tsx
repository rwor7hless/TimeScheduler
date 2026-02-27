import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import TimeRangeInput from '@/components/ui/TimeRangeInput'
import TimePicker from '@/components/ui/TimePicker'
import { useCreateTask, useUpdateTask, useDeleteTask, useTags } from '@/hooks/useTasks'
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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [status, setStatus] = useState<KanbanStatus>('todo')
  const [wasStatusBeforeDone, setWasStatusBeforeDone] = useState<KanbanStatus>('todo')
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

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setPriority(task.priority)
      setStatus(task.status)
      setWasStatusBeforeDone(task.status === 'done' ? 'todo' : task.status)
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
      const initialStatus: KanbanStatus = defaultStatus ?? 'todo'
      setStatus(initialStatus)
      setWasStatusBeforeDone(initialStatus)
      setRepeatDays([])
      setSelectedTagIds([])
      setTgRemind(false)
      setTgRemindDate('')
      setTgRemindTime('')
      setDeadlineDate('')
      setDeadlineTime('')
      setShowDeadline(false)
      setShowAdvanced(false)

      const isKanbanTask = !defaultDate && (boardId !== undefined || defaultStatus !== undefined)
      if (isKanbanTask) {
        setScheduledDate('')
        setStartTime('')
        setEndTime('')
      } else {
        const pad = (n: number) => String(n).padStart(2, '0')
        const today = new Date()
        const defaultDateStr = defaultDate || `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T${pad(today.getHours())}:${pad(today.getMinutes())}`
        const parsed = defaultDateStr.includes('T')
          ? (() => {
              const p = parseDatetime(defaultDateStr)
              const [h, m] = p.startTime.split(':').map(Number)
              const endH = (h + 1) % 24
              return { date: p.date, startTime: p.startTime, endTime: `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
            })()
          : { date: defaultDateStr || new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '10:00' }
        setScheduledDate(parsed.date)
        setStartTime(parsed.startTime)
        setEndTime(parsed.endTime)
      }
    }
  }, [task, isOpen, defaultDate, defaultStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

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

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const isCalendarContext = !!(defaultDate || (task && task.scheduled_start))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Редактирование' : 'Новая задача'} maxWidth="2xl" noScroll>
      <form onSubmit={handleSubmit} className="space-y-3">

        {/* Title */}
        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Что нужно сделать?"
          required
        />

        {/* Description */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-[56px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:border-transparent resize-none"
            placeholder="Детали (необязательно)..."
          />
        </div>

        {/* Priority — pill buttons */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600">Приоритет</label>
          <div className="flex gap-2">
            {PRIORITY_CONFIG.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  priority === p.value ? p.activeClass : `bg-transparent border border-gray-200 ${p.ghostClass}`
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date/Time slot */}
        {(isCalendarContext || scheduledDate) ? (
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1">
              <Input
                label="Дата"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <TimeRangeInput
              label="Время"
              startTime={startTime}
              endTime={endTime}
              onRangeChange={(start, end) => {
                setStartTime(start)
                setEndTime(end)
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const pad = (n: number) => String(n).padStart(2, '0')
              const now = new Date()
              setScheduledDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
              setStartTime('09:00')
              setEndTime('10:00')
            }}
            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Добавить в расписание
          </button>
        )}

        {/* Deadline */}
        {showDeadline ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Дедлайн
              </label>
              <button
                type="button"
                onClick={() => { setShowDeadline(false); setDeadlineDate(''); setDeadlineTime('') }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕ убрать
              </button>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/40 focus:border-rose-400 bg-rose-50/40"
                />
              </div>
              <TimePicker
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
            className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Добавить дедлайн
          </button>
        )}

        {/* Advanced section */}
        <div className="pt-1 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center justify-between w-full text-xs text-gray-500 hover:text-gray-800"
          >
            <span>Дополнительно</span>
            <span className="text-[10px]">{showAdvanced ? '▲' : '▼'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-2">
              {/* Repeat days */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-600">Повтор</label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={repeatDays.length === 7}
                      onChange={(e) => setRepeatDays(e.target.checked ? [0, 1, 2, 3, 4, 5, 6] : [])}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs font-medium text-amber-700">Ежедневно</span>
                  </label>
                </div>
                <div className="flex gap-1.5">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setRepeatDays((prev) =>
                          prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b)
                        )
                      }
                      className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
                        repeatDays.includes(i)
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              {tags && tags.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">Теги</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                          selectedTagIds.includes(tag.id)
                            ? 'text-white ring-2 ring-offset-1'
                            : 'text-gray-600 bg-gray-100'
                        }`}
                        style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Done checkbox */}
              {task && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={status === 'done'}
                    onChange={(e) => {
                      const checked = e.target.checked
                      if (checked) {
                        setWasStatusBeforeDone((prev) => (status !== 'done' ? status : prev))
                        setStatus('done')
                      } else {
                        setStatus(wasStatusBeforeDone)
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>
                    Завершить задачу
                    <span className="text-gray-400 font-normal"> (отметить как выполненную)</span>
                  </span>
                </label>
              )}

              {/* Telegram reminder */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tgRemind}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setTgRemind(checked)
                      if (checked) {
                        if (!tgRemindTime) setTgRemindTime('09:00')
                        if (!tgRemindDate) setTgRemindDate(scheduledDate || new Date().toISOString().slice(0, 10))
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.9l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.659z" />
                    </svg>
                    Напомнить в Telegram
                  </span>
                </label>
                {tgRemind && (
                  <div className="ml-5 grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
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
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          {task ? (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              Удалить
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
              {task ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
