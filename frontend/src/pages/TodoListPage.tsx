import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import clsx from 'clsx'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useTasks,
  useBoards,
  useCreateTask,
  usePatchTask,
  useArchiveTask,
  useArchivedTasks,
  useUnarchiveTask,
  useDeleteTask,
  useReorderTasks,
} from '@/hooks/useTasks'
import TaskModal from '@/components/tasks/TaskModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Spinner from '@/components/ui/Spinner'
import type { Task } from '@/types/task'
import toast from 'react-hot-toast'

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

function SortableTaskRow({
  id,
  children,
}: {
  id: number
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      transition: { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    })
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

function getToday() {
  return format(new Date(), 'yyyy-MM-dd')
}

function getDeadlinePriority(task: Task, today: string): number {
  if (!task.deadline) return 3
  const d = task.deadline.slice(0, 10)
  if (d < today) return 0  // overdue
  if (d === today) return 1 // today
  return 2                  // future
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// ─── Deadline badge ──────────────────────────────────────────────────────────

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null
  const today = getToday()
  const dDate = deadline.slice(0, 10)

  if (dDate < today) {
    const days = Math.round(
      (new Date(today).getTime() - new Date(dDate).getTime()) / 86400000
    )
    return (
      <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
        Просрочено {days}д
      </span>
    )
  }
  if (dDate === today) {
    return (
      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
        Сегодня
      </span>
    )
  }
  return (
    <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
      до {formatDeadline(deadline)}
    </span>
  )
}

// ─── Task row ────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onClick,
}: {
  task: Task
  onToggle: () => void
  onClick: () => void
}) {
  const done = task.done
  const today = getToday()
  const isOverdue =
    !done && task.deadline != null && task.deadline.slice(0, 10) < today

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-xl border transition-all group',
        done
          ? 'opacity-50 bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50'
          : isOverdue
          ? 'bg-red-50/40 dark:bg-red-900/10 border-red-200 dark:border-red-800/50 hover:border-red-300'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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
            : isOverdue
            ? 'border-red-300 dark:border-red-700 hover:border-red-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-amber-400'
        )}
        style={done ? { backgroundColor: task.color } : undefined}
      >
        {done && (
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Color dot */}
      <div
        className="w-1.5 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: task.color }}
      />

      {/* Title */}
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'flex-1 text-sm font-medium text-left truncate transition-colors',
          done
            ? 'line-through text-gray-400 dark:text-gray-500'
            : 'text-gray-900 dark:text-gray-100 hover:text-amber-700 dark:hover:text-amber-400'
        )}
      >
        {task.title}
      </button>

      {/* Subtasks count */}
      {(task.subtasks?.length ?? 0) > 0 && (
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
          {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
        </span>
      )}

      {/* Deadline badge (active tasks only) */}
      {!done && <DeadlineBadge deadline={task.deadline} />}
    </div>
  )
}

// ─── Archived modal ───────────────────────────────────────────────────────────

function ArchivedModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: archived, isLoading } = useArchivedTasks()
  const unarchive = useUnarchiveTask()
  const deleteTask = useDeleteTask()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Завершённые задачи
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !archived || archived.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-sm">Нет завершённых задач</p>
            </div>
          ) : (
            <div className="space-y-2">
              {archived.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate line-through decoration-gray-300 dark:decoration-gray-600">
                      {task.title}
                    </div>
                    {task.completed_at && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {new Date(task.completed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={async () => {
                        await unarchive.mutateAsync(task.id)
                        toast.success('Задача возвращена')
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                    >
                      Вернуть
                    </button>
                    <button
                      onClick={() => setDeletingId(task.id)}
                      className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 text-center">
          {archived && archived.length > 0 && `${archived.length} задач в архиве`}
        </div>
      </div>

      <ConfirmModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Удалить задачу"
        message="Задача будет удалена навсегда. Это действие нельзя отменить."
        confirmLabel="Удалить"
        variant="danger"
        isLoading={deleteTask.isPending}
        onConfirm={async () => {
          if (deletingId === null) return
          await deleteTask.mutateAsync(deletingId)
          setDeletingId(null)
          toast.success('Задача удалена')
        }}
      />
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function TodoListPage() {
  const { boardId: boardIdParam } = useParams<{ boardId: string }>()
  const selectedBoardId = boardIdParam ? parseInt(boardIdParam, 10) : null
  const isValidBoardId = selectedBoardId !== null && !isNaN(selectedBoardId)

  const { data: boards } = useBoards()
  const projectName = useMemo(() => {
    if (!selectedBoardId) return 'Входящие'
    return boards?.find((b) => b.id === selectedBoardId)?.name ?? `Проект ${selectedBoardId}`
  }, [boards, selectedBoardId])

  const taskParams = useMemo((): Record<string, string> => {
    if (selectedBoardId === null || !isValidBoardId) {
      return { default_board: 'true' }
    }
    return { board_id: String(selectedBoardId) }
  }, [selectedBoardId, isValidBoardId])

  const { data: tasks, isLoading } = useTasks(taskParams)
  const createTask = useCreateTask()
  const patchTask = usePatchTask()
  const archiveTask = useArchiveTask()
  const reorderTasks = useReorderTasks()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const [quickAdd, setQuickAdd] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)

  const today = getToday()

  const visibleTasks = useMemo(() => {
    if (!tasks) return []
    return tasks.filter((t) => {
      if (selectedBoardId === null) return t.board_id == null
      return t.board_id === selectedBoardId
    })
  }, [tasks, selectedBoardId])

  const activeTasks = useMemo(() => {
    const filtered = visibleTasks.filter((t) => !t.done && !t.is_archived)
    return [...filtered].sort((a, b) => {
      // Position is the user-controlled order (set by drag-and-drop). Most
      // tasks default to position=0 until reordered, so we fall back to the
      // existing deadline-priority sort for ties.
      if (a.position !== b.position) return a.position - b.position
      const pa = getDeadlinePriority(a, today)
      const pb = getDeadlinePriority(b, today)
      if (pa !== pb) return pa - pb
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
      return a.created_at.localeCompare(b.created_at)
    })
  }, [visibleTasks, today])

  const doneTasks = useMemo(
    () => visibleTasks.filter((t) => t.done && !t.is_archived),
    [visibleTasks]
  )

  const handleToggle = async (task: Task) => {
    const newDone = !task.done
    try {
      await patchTask.mutateAsync({ id: task.id, data: { done: newDone } })
    } catch {
      toast.error('Не удалось обновить задачу')
    }
  }

  const handleQuickAdd = async () => {
    const title = quickAdd.trim()
    if (!title) return
    try {
      await createTask.mutateAsync({
        title,
        board_id: selectedBoardId,
      })
      setQuickAdd('')
    } catch {
      toast.error('Не удалось создать задачу')
    }
  }

  const handleArchiveDone = async () => {
    const ids = doneTasks.map((t) => t.id)
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map((id) => archiveTask.mutateAsync(id)))
      toast.success('Выполненные задачи перемещены в архив')
      setArchiveConfirmOpen(false)
    } catch {
      toast.error('Не удалось переместить в архив')
    }
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  if (isLoading) return <Spinner className="mt-20" />

  if (boardIdParam && !isValidBoardId) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">
          Проект не найден.{' '}
          <Link to="/tasks" className="text-amber-600 hover:underline">
            К задачам
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/tasks"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            ← Задачи
          </Link>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{projectName}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setArchivedOpen(true)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Завершённые
          </button>
          {doneTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setArchiveConfirmOpen(true)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              В архив ({doneTasks.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingTask(null)
              setModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Задача
          </button>
        </div>
      </div>

      {/* Quick-add input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
          placeholder="Добавить задачу..."
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 transition-colors"
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

      {/* Active tasks */}
      {activeTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300 dark:text-gray-600">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <p className="text-sm">Все задачи выполнены</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={() => document.body.classList.add('ts-dnd-active')}
          onDragCancel={() => document.body.classList.remove('ts-dnd-active')}
          onDragEnd={(e: DragEndEvent) => {
            document.body.classList.remove('ts-dnd-active')
            const { active, over } = e
            if (!over || active.id === over.id) return
            const oldIdx = activeTasks.findIndex((t) => t.id === active.id)
            const newIdx = activeTasks.findIndex((t) => t.id === over.id)
            if (oldIdx === -1 || newIdx === -1) return
            const reordered = arrayMove(activeTasks, oldIdx, newIdx)
            reorderTasks.mutate({ ordered_ids: reordered.map((t) => t.id) })
          }}
        >
          <SortableContext
            items={activeTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {activeTasks.map((task) => (
                <SortableTaskRow key={task.id} id={task.id}>
                  <TaskRow
                    task={task}
                    onToggle={() => handleToggle(task)}
                    onClick={() => openEdit(task)}
                  />
                </SortableTaskRow>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Done tasks (collapsible) */}
      {doneTasks.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors mb-2"
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={clsx('transition-transform', doneOpen ? 'rotate-90' : '')}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Выполнено
            <span className="ml-0.5 text-[10px] font-normal normal-case tracking-normal">
              ({doneTasks.length})
            </span>
          </button>

          {doneOpen && (
            <div className="space-y-1.5">
              {doneTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggle(task)}
                  onClick={() => openEdit(task)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        boardId={selectedBoardId}
      />

      <ConfirmModal
        isOpen={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        title="Перенести в архив"
        message={`Переместить ${doneTasks.length} выполненных задач в архив? Их можно будет найти через «Завершённые».`}
        confirmLabel="В архив"
        variant="danger"
        onConfirm={handleArchiveDone}
        isLoading={archiveTask.isPending}
      />

      <ArchivedModal isOpen={archivedOpen} onClose={() => setArchivedOpen(false)} />
    </div>
  )
}
