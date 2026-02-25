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
import { useTasks, useReorderTasks, useBoards, useDeleteTask } from '@/hooks/useTasks'
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
  const deleteTask = useDeleteTask()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<KanbanStatus>('todo')
  const [clearDoneModalOpen, setClearDoneModalOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const visibleTasks = useMemo(() => {
    if (!tasks) return []
    return tasks.filter((t) => {
      if (selectedBoardId === null) {
        // Default board: only tasks without a board and without a schedule (calendar tasks excluded)
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

  const handleClearDone = async () => {
    const doneIds = visibleTasks.filter((t) => t.status === 'done').map((t) => t.id)
    if (doneIds.length === 0) return
    try {
      await Promise.all(doneIds.map((id) => deleteTask.mutateAsync(id)))
      toast.success('Готовые задачи удалены')
    } catch {
      toast.error('Не удалось очистить задачи')
      throw new Error('Clear failed')
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
          <Button onClick={() => openCreateModal('todo')}>+ Задача</Button>
          <Button
            variant="secondary"
            onClick={() => setClearDoneModalOpen(true)}
            disabled={doneCount === 0}
          >
            Очистить готовые {doneCount > 0 ? `(${doneCount})` : ''}
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
        isOpen={clearDoneModalOpen}
        onClose={() => setClearDoneModalOpen(false)}
        title="Очистить готовые задачи"
        message={`Удалить ${doneCount} ${doneCount === 1 ? 'задачу' : 'задач(и)'} с этой доски?`}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={handleClearDone}
        isLoading={deleteTask.isPending}
      />
    </div>
  )
}
