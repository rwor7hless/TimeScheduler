import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
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

const priorityOptions = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
  { value: 'urgent', label: 'Срочный' },
]

const statusOptions = [
  { value: 'todo', label: 'К выполнению' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Готово' },
]

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
  const [color, setColor] = useState<string>('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [status, setStatus] = useState<KanbanStatus>('todo')
  const [scheduledDate, setScheduledDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [tgRemind, setTgRemind] = useState(false)
  const [tgRemindDate, setTgRemindDate] = useState('')
  const [tgRemindTime, setTgRemindTime] = useState('')

  const { data: tags } = useTags()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setColor(task.color || '')
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
    } else {
      setTitle('')
      setDescription('')
      setColor('')
      setPriority('medium')
      setStatus(defaultStatus ?? 'todo')
      setRepeatDays([])
      setSelectedTagIds([])
      setTgRemind(false)
      setTgRemindDate('')
      setTgRemindTime('')

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

    const tg_remind_at = tgRemind && tgRemindDate && tgRemindTime
      ? new Date(`${tgRemindDate}T${tgRemindTime}:00`).toISOString()
      : null

    const data: TaskCreate = {
      title: title.trim(),
      description: description || null,
      color: color || (task ? task.color : undefined),
      priority,
      status,
      scheduled_start,
      scheduled_end,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Редактирование' : 'Новая задача'} maxWidth="2xl" noScroll>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название задачи..."
          required
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-[100px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:border-transparent resize-none"
            placeholder="Описание (необязательно)..."
          />
        </div>

        <div className="space-y-3">
          <div className="min-w-[120px]">
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

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Цвет</label>
          <div className="flex flex-wrap gap-2 px-0.5 py-0.5">
            {TASK_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === c ? 'ring-2 ring-gray-800 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <button
              type="button"
              onClick={() => setColor('')}
              className={`w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-500 ${
                !color ? 'bg-amber-50 border-amber-400' : ''
              }`}
              title="Случайный"
            >
              ?
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Приоритет"
            options={priorityOptions}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />
          <Select
            label="Статус"
            options={statusOptions}
            value={status}
            onChange={(e) => setStatus(e.target.value as KanbanStatus)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Повтор</label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={repeatDays.length === 7}
                  onChange={(e) =>
                    setRepeatDays(e.target.checked ? [0, 1, 2, 3, 4, 5, 6] : [])
                  }
                  className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-amber-700">Ежедневно</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setRepeatDays((prev) =>
                      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b)
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    repeatDays.includes(i)
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">Оставьте пустым для одноразовой задачи</p>
          </div>
        </div>

        {tags && tags.length > 0 && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Теги</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTagIds.includes(tag.id)
                      ? 'text-white ring-2 ring-offset-1'
                      : 'text-gray-600 bg-gray-100'
                  }`}
                  style={
                    selectedTagIds.includes(tag.id)
                      ? { backgroundColor: tag.color }
                      : undefined
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
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
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.9l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.659z" />
              </svg>
              Напомнить в Telegram
            </span>
          </label>
          {tgRemind && (
            <div className="pl-6 space-y-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 border border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Дата напоминания"
                  type="date"
                  value={tgRemindDate}
                  onChange={(e) => setTgRemindDate(e.target.value)}
                  className="min-w-0"
                />
                <TimePicker
                  label="Время напоминания"
                  value={tgRemindTime || '09:00'}
                  onChange={setTgRemindTime}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
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
