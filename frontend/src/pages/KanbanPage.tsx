import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import { useTasks, useReorderTasks, useBoards, useArchiveTask, useArchivedTasks, useUnarchiveTask, useDeleteTask } from '@/hooks/useTasks'
import { tasksApi } from '@/api/tasks'
import TaskCard from '@/components/tasks/TaskCard'
import TaskModal from '@/components/tasks/TaskModal'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Spinner from '@/components/ui/Spinner'
import type { Task, KanbanStatus } from '@/types/task'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const COLUMNS: { id: KanbanStatus; title: string; accent: string }[] = [
  { id: 'todo', title: 'К выполнению', accent: 'border-t-stone-400' },
  { id: 'in_progress', title: 'В работе', accent: 'border-t-blue-400' },
  { id: 'done', title: 'Готово', accent: 'border-t-emerald-400' },
]

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Срочный',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-gray-400', medium: 'text-blue-400', high: 'text-amber-500', urgent: 'text-red-500',
}

function SortableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onClick={onClick} />
    </div>
  )
}

function DroppableColumn({
  col,
  tasks,
  onTaskClick,
  onAddTask,
}: {
  col: (typeof COLUMNS)[number]
  tasks: Task[]
  onTaskClick: (t: Task) => void
  onAddTask: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div
      className={clsx(
        'rounded-xl border border-gray-200 border-t-4 flex flex-col',
        col.accent,
        isOver ? 'bg-amber-50/50' : 'bg-gray-50'
      )}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-gray-700">{col.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
          <button
            onClick={onAddTask}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none"
          >
            +
          </button>
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 px-3 pb-3 min-h-[200px]">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-40">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span className="text-xs">Нажмите +</span>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  )
}

function ArchivedModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: archived, isLoading } = useArchivedTasks()
  const unarchive = useUnarchiveTask()
  const deleteTask = useDeleteTask()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Завершённые задачи</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors group"
                >
                  {/* Color dot */}
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate line-through decoration-gray-300">
                      {task.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={clsx('text-[10px] font-medium', PRIORITY_COLOR[task.priority])}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                      {task.completed_at && (
                        <>
                          <span className="text-gray-200 text-[10px]">·</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(task.completed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                          </span>
                        </>
                      )}
                      {task.tags.length > 0 && (
                        <>
                          <span className="text-gray-200 text-[10px]">·</span>
                          <div className="flex gap-1">
                            {task.tags.slice(0, 3).map(tag => (
                              <span
                                key={tag.id}
                                className="px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white"
                                style={{ backgroundColor: tag.color }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={async () => {
                        await unarchive.mutateAsync(task.id)
                        toast.success('Задача возвращена')
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Вернуть в канбан"
                    >
                      Вернуть
                    </button>
                    <button
                      onClick={() => setDeletingId(task.id)}
                      className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить навсегда"
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

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
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

export default function KanbanPage() {
  const { boardId: boardIdParam } = useParams<{ boardId: string }>()
  const selectedBoardId = boardIdParam ? parseInt(boardIdParam, 10) : null
  const isValidBoardId = selectedBoardId !== null && !isNaN(selectedBoardId)

  const queryClient = useQueryClient()
  const { data: boards } = useBoards()
  const boardName = useMemo(() => {
    if (!selectedBoardId) return 'Основная'
    return boards?.find((b) => b.id === selectedBoardId)?.name ?? `Доска ${selectedBoardId}`
  }, [boards, selectedBoardId])

  const taskParams = useMemo((): Record<string, string> => {
    if (selectedBoardId === null || !isValidBoardId) {
      return { default_board: 'true' }
    }
    return { board_id: String(selectedBoardId) }
  }, [selectedBoardId, isValidBoardId])

  const { data: tasks, isLoading } = useTasks(taskParams)
  const reorderMutation = useReorderTasks()
  const archiveTask = useArchiveTask()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<KanbanStatus>('todo')
  const [archiveDoneModalOpen, setArchiveDoneModalOpen] = useState(false)
  const [archivedDrawerOpen, setArchivedDrawerOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const visibleTasks = useMemo(() => {
    if (!tasks) return []
    return tasks.filter((t) => {
      if (selectedBoardId === null) {
        return t.board_id == null && t.scheduled_start == null
      }
      return t.board_id === selectedBoardId
    })
  }, [tasks, selectedBoardId])

  const columns = useMemo((): Record<KanbanStatus, Task[]> => {
    const grouped: Record<KanbanStatus, Task[]> = { todo: [], in_progress: [], done: [] }
    if (!visibleTasks) return grouped
    visibleTasks.forEach((t) => grouped[t.status].push(t))
    Object.values(grouped).forEach((col) => col.sort((a, b) => a.kanban_order - b.kanban_order))
    return grouped
  }, [visibleTasks])

  const doneCount = visibleTasks.filter((t) => t.status === 'done').length

  const handleDragStart = (event: DragStartEvent) => {
    const task = visibleTasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over || visibleTasks.length === 0) return

    const activeId = active.id as number
    const activeTask = visibleTasks.find((t) => t.id === activeId)
    if (!activeTask) return

    const sourceColumn = activeTask.status

    const overTask = visibleTasks.find((t) => t.id === over.id)
    const targetColumn: KanbanStatus = overTask
      ? overTask.status
      : (over.id as KanbanStatus)

    const sourceItems = [...columns[sourceColumn]]

    if (sourceColumn === targetColumn) {
      const oldIndex = sourceItems.findIndex((t) => t.id === activeId)
      const newIndex = overTask
        ? sourceItems.findIndex((t) => t.id === overTask.id)
        : sourceItems.length - 1
      if (oldIndex === newIndex) return
      const reordered = arrayMove(sourceItems, oldIndex, newIndex)
      try {
        await reorderMutation.mutateAsync({
          status: targetColumn,
          ordered_ids: reordered.map((t) => t.id),
        })
      } catch {
        toast.error('Не удалось изменить порядок')
      }
    } else {
      const targetItems = [...columns[targetColumn]].filter((t) => t.id !== activeId)
      const insertAt = overTask
        ? targetItems.findIndex((t) => t.id === overTask.id)
        : targetItems.length
      targetItems.splice(insertAt < 0 ? targetItems.length : insertAt, 0, activeTask)
      const newSource = sourceItems.filter((t) => t.id !== activeId)

      try {
        await Promise.all([
          tasksApi.reorder({
            status: targetColumn,
            ordered_ids: targetItems.map((t) => t.id),
          }),
          tasksApi.reorder({
            status: sourceColumn,
            ordered_ids: newSource.map((t) => t.id),
          }),
        ])
        reorderMutation.reset()
      } catch {
        toast.error('Не удалось переместить задачу')
      } finally {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      }
    }
  }

  const openCreateModal = (status: KanbanStatus) => {
    setEditingTask(null)
    setDefaultStatus(status)
    setModalOpen(true)
  }

  const handleArchiveDone = async () => {
    const doneIds = visibleTasks.filter((t) => t.status === 'done').map((t) => t.id)
    if (doneIds.length === 0) return
    try {
      await Promise.all(doneIds.map((id) => archiveTask.mutateAsync(id)))
      toast.success('Готовые задачи перемещены в архив')
    } catch {
      toast.error('Не удалось переместить в архив')
      throw new Error('Archive failed')
    }
  }

  if (isLoading) return <Spinner className="mt-20" />

  if (boardIdParam && !isValidBoardId) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">Доска не найдена. <Link to="/boards" className="text-amber-600 hover:underline">Назад к доскам</Link></p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/boards"
            className="text-sm text-gray-500 hover:text-amber-600 transition-colors"
          >
            ← Доски
          </Link>
          <h2 className="text-lg font-semibold text-gray-900">{boardName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => openCreateModal('todo')}>+ Задача</Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setArchivedDrawerOpen(true)}
          >
            Завершённые
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setArchiveDoneModalOpen(true)}
            disabled={doneCount === 0}
          >
            В архив {doneCount > 0 ? `(${doneCount})` : ''}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <DroppableColumn
              key={col.id}
              col={col}
              tasks={columns[col.id]}
              onTaskClick={(task) => {
                setEditingTask(task)
                setModalOpen(true)
              }}
              onAddTask={() => openCreateModal(col.id)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        defaultStatus={defaultStatus}
        boardId={selectedBoardId}
      />

      <ConfirmModal
        isOpen={archiveDoneModalOpen}
        onClose={() => setArchiveDoneModalOpen(false)}
        title="Перенести в архив"
        message={`Переместить ${doneCount} ${doneCount === 1 ? 'задачу' : 'задач(и)'} в архив? Их можно будет найти через «Завершённые».`}
        confirmLabel="В архив"
        variant="danger"
        onConfirm={handleArchiveDone}
        isLoading={archiveTask.isPending}
      />

      <ArchivedModal
        isOpen={archivedDrawerOpen}
        onClose={() => setArchivedDrawerOpen(false)}
      />
    </div>
  )
}
