import { useState, useEffect, useRef, useMemo } from 'react'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import TimeField from '@/components/ui/TimeField'
import { useCreateTask, useUpdateTask, useDeleteTask, usePatchTask, useTags } from '@/hooks/useTasks'
import type { Task, TaskCreate, Priority } from '@/types/task'
import { TASK_COLOR_PALETTE, WEEKDAY_LABELS } from '@/types/task'
import { parseTaskInput, friendlyDate } from '@/utils/parseTask'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  task?: Task | null
  defaultDate?: string
  defaultDone?: boolean
  boardId?: number | null
}

const PRIORITY_CONFIG: { value: Priority; label: string; activeClass: string; ghostClass: string }[] = [
  { value: 'low',    label: '↓',  activeClass: 'bg-fg-mid text-bg',  ghostClass: 'text-fg-mid hover:text-fg-body hover:bg-bg-hover' },
  { value: 'medium', label: '—',  activeClass: 'bg-fg-body text-bg', ghostClass: 'text-fg-body hover:text-fg hover:bg-bg-hover' },
  { value: 'high',   label: '↑',  activeClass: 'bg-accent text-bg',  ghostClass: 'text-accent hover:text-accent-light hover:bg-bg-sel' },
  { value: 'urgent', label: '⚡', activeClass: 'bg-danger text-bg',  ghostClass: 'text-danger hover:text-danger hover:bg-bg-hover' },
]

const PRIORITY_TITLES: Record<Priority, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Срочный',
}

function randomColor(): string {
  return TASK_COLOR_PALETTE[Math.floor(Math.random() * TASK_COLOR_PALETTE.length)]
}

function parseDatetime(isoString: string): { date: string; startTime: string } {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    startTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function describeApiError(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: { detail?: unknown } } } | undefined
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  const status = e?.response?.status
  if (status === 401) return 'Сессия истекла, войдите снова'
  if (status === 403) return 'Нет прав на это действие'
  if (status === 404) return 'Не найдено — возможно, удалено в другом месте'
  if (status === 422) return 'Проверьте заполнение полей'
  if (status === 429) return 'Слишком часто — попробуйте позже'
  if (status && status >= 500) return 'Сервер недоступен, попробуйте позже'
  return fallback
}

function formatWhen(date: string, start: string, end: string, todayStr: string): string {
  const dateLabel = friendlyDate(date, todayStr)
  if (start && end) return `${dateLabel} • ${start}–${end}`
  if (start) return `${dateLabel} • ${start}`
  return dateLabel
}

export default function TaskModal({ isOpen, onClose, task, defaultDate, defaultDone, boardId }: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showDescription, setShowDescription] = useState(false)
  const [priority, setPriority] = useState<Priority>('medium')
  const [done, setDone] = useState<boolean>(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [showDeadline, setShowDeadline] = useState(false)
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const [parserHint, setParserHint] = useState<string>('')
  const parserArmedRef = useRef(false)  // только при создании новой задачи, однократно

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const [localSubtasks, setLocalSubtasks] = useState<Task[]>([])
  const [pendingSubtaskIds, setPendingSubtaskIds] = useState<Set<number>>(new Set())

  const { data: tags } = useTags()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const patchTask = usePatchTask()

  const todayStr = useMemo(() => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }, [])

  // Initialize localSubtasks только при смене задачи
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
      setShowDescription(!!task.description)
      setPriority(task.priority)
      setDone(task.done)
      if (task.scheduled_start && task.scheduled_end) {
        const s = parseDatetime(task.scheduled_start)
        const e = parseDatetime(task.scheduled_end)
        setScheduledDate(s.date); setStartTime(s.startTime); setEndTime(e.startTime)
      } else {
        setScheduledDate(''); setStartTime(''); setEndTime('')
      }
      if (task.deadline) {
        const p = parseDatetime(task.deadline)
        setDeadlineDate(p.date); setDeadlineTime(p.startTime); setShowDeadline(true)
      } else {
        setDeadlineDate(''); setDeadlineTime(''); setShowDeadline(false)
      }
      setRepeatDays(task.repeat_days ?? [])
      setSelectedTagIds(task.tags.map((t) => t.id))
      parserArmedRef.current = false
      setParserHint('')
    } else {
      setTitle('')
      setDescription('')
      setShowDescription(false)
      setPriority('medium')
      setDone(defaultDone ?? false)
      setRepeatDays([])
      setSelectedTagIds([])
      setDeadlineDate(''); setDeadlineTime(''); setShowDeadline(false)
      setShowSubtaskInput(false)
      setNewSubtaskTitle('')
      parserArmedRef.current = true
      setParserHint('')

      if (defaultDate) {
        const defaultDateStr = defaultDate.includes('T') ? defaultDate : `${defaultDate}T09:00`
        const p = parseDatetime(defaultDateStr)
        const [h, m] = p.startTime.split(':').map(Number)
        const endH = (h + 1) % 24
        setScheduledDate(p.date); setStartTime(p.startTime)
        setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      } else {
        setScheduledDate(''); setStartTime(''); setEndTime('')
      }
    }
  }, [task, isOpen, defaultDate, defaultDone])

  // Quick-input парсер: срабатывает только при создании новой задачи,
  // не перезатирает поля, уже заполненные руками.
  useEffect(() => {
    if (!isOpen || task) return
    if (!parserArmedRef.current) return
    if (!title.trim()) { setParserHint(''); return }

    const parsed = parseTaskInput(title, new Date())
    const bits: string[] = []
    if (parsed.scheduledDate) {
      setScheduledDate(parsed.scheduledDate)
      bits.push(friendlyDate(parsed.scheduledDate, todayStr))
    }
    if (parsed.startTime) {
      setStartTime(parsed.startTime)
      if (parsed.endTime) setEndTime(parsed.endTime)
      bits.push(parsed.endTime ? `${parsed.startTime}–${parsed.endTime}` : parsed.startTime)
    }
    if (parsed.deadline) {
      setDeadlineDate(parsed.deadline)
      if (!deadlineTime) setDeadlineTime('23:59')
      setShowDeadline(true)
      bits.push(`дедлайн ${friendlyDate(parsed.deadline, todayStr)}`)
    }
    setParserHint(bits.join(' • '))
  }, [title, isOpen, task, todayStr]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const parsed = !task && parserArmedRef.current ? parseTaskInput(title, new Date()) : null
    const cleanTitle = parsed ? parsed.title : title.trim()

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

    const data: TaskCreate = {
      title: cleanTitle,
      description: description || null,
      color: task ? task.color : randomColor(),
      priority,
      done,
      scheduled_start,
      scheduled_end,
      deadline,
      repeat_days: repeatDays.length > 0 ? repeatDays : [],
      tag_ids: selectedTagIds,
      board_id: boardId ?? task?.board_id ?? null,
      parent_id: task?.parent_id ?? null,
      tg_remind: task?.tg_remind ?? false,
      tg_remind_at: task?.tg_remind_at ?? null,
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
    } catch (err) {
      toast.error(describeApiError(err, 'Не удалось сохранить задачу'))
    }
  }

  const subtaskCount = task?.subtasks?.length ?? 0

  const handleDeleteClick = () => {
    if (!task) return
    if (subtaskCount > 0) setConfirmDeleteOpen(true)
    else void doDelete()
  }

  const doDelete = async () => {
    if (!task) return
    try {
      await deleteTask.mutateAsync(task.id)
      toast.success(subtaskCount > 0 ? `Задача и ${subtaskCount} подзадач(и) удалены` : 'Задача удалена')
      setConfirmDeleteOpen(false)
      onClose()
    } catch (err) {
      toast.error(describeApiError(err, 'Не удалось удалить задачу'))
    }
  }

  const handleAddSubtask = async () => {
    if (!task || !newSubtaskTitle.trim()) return
    try {
      const created = await createTask.mutateAsync({
        title: newSubtaskTitle.trim(),
        priority: 'medium',
        done: false,
        board_id: task.board_id,
        parent_id: task.id,
      })
      setLocalSubtasks((prev) => [...prev, created])
      setNewSubtaskTitle('')
      setShowSubtaskInput(false)
      toast.success('Подзадача добавлена')
    } catch (err) {
      toast.error(describeApiError(err, 'Не удалось добавить подзадачу'))
    }
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const whenLabel = scheduledDate
    ? formatWhen(scheduledDate, startTime, endTime, todayStr)
    : ''

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Редактирование задачи':'Новая задача'} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Quick input */}
        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={task ? 'Название':'Что нужно сделать? (например: купить хлеб завтра в 18:00)'}
            required
            autoFocus
            className="w-full text-lg font-medium px-0 py-1 bg-transparent border-0 border-b-2 border-line focus:border-accent focus:outline-none placeholder-gray-300 text-fg transition-colors"
          />
          {parserHint && !task && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-accent">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Распознано: {parserHint}</span>
            </div>
          )}
        </div>

        {/* Two columns: WHAT / WHEN */}
        <div className="grid grid-cols-2 gap-3">

          {/* WHAT */}
          <section className="border border-line bg-bg-raised p-3 space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-fg-mid">Что</h3>

            {/* Priority */}
            <div>
              <div className="text-[11px] font-medium text-fg-mid mb-1">Приоритет</div>
              <div className="flex gap-1">
                {PRIORITY_CONFIG.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    title={PRIORITY_TITLES[p.value]}
                    className={clsx(
                      'flex-1 py-1.5 text-sm font-semibold transition-all',
                      priority === p.value
                        ? p.activeClass
                        : `bg-bg-cell border border-line ${p.ghostClass}`
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-fg-mid mb-1">Теги</div>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={clsx(
                          'px-2 py-0.5 text-[11px] font-medium transition-all',
                          active
                            ? 'text-bg'
                            : 'text-fg-body bg-bg-cell border border-line hover:border-line'
                        )}
                        style={active ? { backgroundColor: tag.color } : undefined}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Done (edit only) */}
            {task && (
              <label className="flex items-center gap-2 text-sm text-fg-body cursor-pointer">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => setDone(e.target.checked)}
                  className="w-4 h-4 border-line"
                />
                Выполнено
              </label>
            )}
          </section>

          {/* WHEN */}
          <section className="border border-line bg-bg-raised p-3 space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-fg-mid">Когда</h3>

            {/* Scheduled */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-fg-mid">
                  Расписание
                  {scheduledDate && (
                    <span className="ml-1.5 text-accent font-normal normal-case">
                      {whenLabel}
                    </span>
                  )}
                </span>
                {scheduledDate && (
                  <button
                    type="button"
                    onClick={() => { setScheduledDate(''); setStartTime(''); setEndTime('') }}
                    className="text-[10px] text-fg-mid hover:text-danger transition-colors"
                  >
                    очистить
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 items-center">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value)
                    if (e.target.value && !startTime) { setStartTime('09:00'); setEndTime('10:00') }
                  }}
                  className="flex-1 min-w-0 px-2.5 h-[34px] border border-line text-sm bg-bg-cell focus:outline-none focus:border-accent"
                />
                {scheduledDate && (
                  <>
                    <TimeField
                      value={startTime || '09:00'}
                      onChange={(s) => {
                        setStartTime(s)
                        const [sh, sm] = s.split(':').map(Number)
                        const [eh, em] = (endTime || '10:00').split(':').map(Number)
                        if (eh * 60 + em <= sh * 60 + sm) {
                          const next = sh * 60 + sm + 60
                          const nh = Math.min(Math.floor(next / 60), 23)
                          const nm = next % 60
                          setEndTime(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`)
                        }
                      }}
                    />
                    <span className="text-fg-mid text-xs">–</span>
                    <TimeField
                      value={endTime || '10:00'}
                      onChange={setEndTime}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Deadline */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-fg-mid">Дедлайн</span>
                {showDeadline && (
                  <button
                    type="button"
                    onClick={() => { setShowDeadline(false); setDeadlineDate(''); setDeadlineTime('') }}
                    className="text-[10px] text-fg-mid hover:text-danger transition-colors"
                  >
                    убрать
                  </button>
                )}
              </div>
              {showDeadline ? (
                <div className="flex gap-1.5 items-center">
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 h-[34px] border border-danger text-sm bg-bg-cell text-danger focus:outline-none"
                  />
                  <TimeField
                    tone="danger"
                    value={deadlineTime || '23:59'}
                    onChange={setDeadlineTime}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setShowDeadline(true); if (!deadlineTime) setDeadlineTime('23:59') }}
                  className="w-full px-3 py-2 text-xs text-fg-mid hover:text-danger bg-bg-cell border border-dashed border-line hover:border-danger transition-all"
                >
                  + добавить дедлайн
                </button>
              )}
            </div>

            {/* Repeat */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-fg-mid">Повтор</span>
                <button
                  type="button"
                  onClick={() => setRepeatDays(repeatDays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}
                  className={clsx(
                    'text-[10px] font-medium px-2 py-0.5 transition-all',
                    repeatDays.length === 7
                      ? 'bg-bg-sel text-bg'
                      : 'bg-bg-hover text-accent hover:bg-bg-sel'
                  )}
                >
                  Каждый день
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
                    className={clsx(
                      'flex-1 py-1 text-[11px] font-medium transition-all',
                      repeatDays.includes(i)
                        ? 'bg-bg-sel text-bg'
                        : 'bg-bg-cell border border-line text-fg-mid hover:bg-bg-hover'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Description — collapsible */}
        <div>
          {showDescription || description ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-20 px-3 py-2 bg-bg-raised border border-line text-sm focus:outline-none focus:border-accent resize-none placeholder-gray-300 transition-colors"
              placeholder="Описание..."
              autoFocus={showDescription && !description}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              className="text-xs text-fg-mid hover:text-fg-body transition-colors flex items-center gap-1.5"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Добавить описание
            </button>
          )}
        </div>

        {/* Subtasks (edit only) */}
        {task && (
          <div className="border-t border-line-soft pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-mid">
                Подзадачи
                {localSubtasks.length > 0 && (
                  <span className="ml-1.5 text-fg-mid font-normal normal-case tracking-normal">
                    {localSubtasks.filter((s) => s.done).length}/{localSubtasks.length}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowSubtaskInput((v) => !v)}
                className="text-xs text-accent hover:text-accent flex items-center gap-1"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Добавить
              </button>
            </div>

            {localSubtasks.length > 0 && (
              <ul className="space-y-0.5">
                {localSubtasks.map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2 text-xs text-fg-body py-1 px-2 hover:bg-bg-raised group/sub">
                    <button
                      type="button"
                      disabled={pendingSubtaskIds.has(sub.id)}
                      onClick={async () => {
                        if (pendingSubtaskIds.has(sub.id)) return
                        const newDone = !sub.done
                        const prevDone = sub.done
                        setPendingSubtaskIds((s) => { const n = new Set(s); n.add(sub.id); return n })
                        setLocalSubtasks((prev) => prev.map((s) => s.id === sub.id ? { ...s, done: newDone } : s))
                        try {
                          await patchTask.mutateAsync({ id: sub.id, data: { done: newDone } })
                        } catch (err) {
                          setLocalSubtasks((prev) => prev.map((s) => s.id === sub.id ? { ...s, done: prevDone } : s))
                          toast.error(describeApiError(err, 'Не удалось обновить подзадачу'))
                        } finally {
                          setPendingSubtaskIds((s) => { const n = new Set(s); n.delete(sub.id); return n })
                        }
                      }}
                      className={clsx(
                        'w-3.5 h-3.5 border-2 flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-wait',
                        sub.done ? 'bg-bg-cell border-success hover:bg-bg-cell' : 'border-line hover:border-success'
                      )}
                    />
                    <span className={clsx('flex-1', sub.done && 'line-through text-fg-mid')}>{sub.title}</span>
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
                      className="w-4 h-4 flex items-center justify-center text-fg-mid hover:text-danger opacity-0 group-hover/sub:opacity-100 transition-all flex-shrink-0"
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
                  className="flex-1 px-2.5 py-1.5 border border-line text-xs focus:outline-none focus:border-accent bg-bg-cell"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim() || createTask.isPending}
                  className="px-2.5 py-1.5 bg-bg-sel text-bg text-xs hover:bg-bg-sel disabled:opacity-40"
                >
                  ОК
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-line-soft">
          {task ? (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={deleteTask.isPending}
              className="px-3 py-1.5 text-xs font-medium text-danger hover:text-danger hover:bg-bg-cell transition-colors disabled:opacity-40"
            >
              Удалить
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-fg-body hover:bg-bg-hover transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createTask.isPending || updateTask.isPending || !title.trim()}
              className="px-4 py-1.5 text-xs font-semibold bg-bg-sel text-bg hover:bg-bg-sel disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {(createTask.isPending || updateTask.isPending) && (
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9" strokeDasharray="40" strokeLinecap="round"/></svg>
              )}
              {task ? 'Сохранить':'Создать'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Удалить задачу с подзадачами?"
        message={`У этой задачи ${subtaskCount} подзадач(и). Все они будут удалены вместе с родительской.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
        isLoading={deleteTask.isPending}
        onConfirm={doDelete}
      />
    </Modal>
  )
}
