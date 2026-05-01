import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useTasks, useBoards, usePatchTask } from '@/hooks/useTasks'
import { useTaskDateSections } from '@/hooks/useTaskDateSections'
import BacklogTaskRow from '@/components/tasks/BacklogTaskRow'
import TaskModal from '@/components/tasks/TaskModal'
import Spinner from '@/components/ui/Spinner'
import type { Task } from '@/types/task'
import toast from 'react-hot-toast'

export default function TasksPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const { data: tasks, isLoading } = useTasks()
  const { data: boards } = useBoards()
  const patchTask = usePatchTask()

  const [editing, setEditing] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const boardLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const b of boards ?? []) map.set(b.id, b.name)
    return map
  }, [boards])

  const buckets = useTaskDateSections(tasks, todayStr)

  const onToggle = async (task: Task) => {
    try {
      await patchTask.mutateAsync({ id: task.id, data: { done: !task.done } })
    } catch {
      toast.error('Не удалось обновить задачу')
    }
  }

  const onAddToMyDay = async (task: Task) => {
    try {
      await patchTask.mutateAsync({ id: task.id, data: { my_day: true } })
    } catch {
      toast.error('Не удалось обновить задачу')
    }
  }

  const open = (task: Task) => {
    setEditing(task)
    setModalOpen(true)
  }

  const labelFor = (task: Task): string =>
    task.board_id != null
      ? boardLabelById.get(task.board_id) ?? 'без проекта'
      : 'без проекта'

  if (isLoading) return <Spinner className="mt-20" />

  const renderRow = (task: Task) => (
    <BacklogTaskRow
      key={task.id}
      task={task}
      todayStr={todayStr}
      onToggle={() => onToggle(task)}
      onAddToMyDay={() => onAddToMyDay(task)}
      onClick={() => open(task)}
      listLabel={labelFor(task)}
    />
  )

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="topbar">
        <h1 className="page-title" style={{ fontSize: 28 }}>Задачи</h1>
      </div>

      {buckets.overdue.length > 0 && (
        <section className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-red-500 dark:text-red-400">
            Просрочено ({buckets.overdue.length})
          </div>
          {buckets.overdue.map(renderRow)}
        </section>
      )}

      {buckets.today.length > 0 && (
        <section className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Сегодня ({buckets.today.length})
          </div>
          {buckets.today.map(renderRow)}
        </section>
      )}

      {buckets.sections.map((s) => (
        <section key={String(s.key)} className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            {s.label} ({s.tasks.length})
          </div>
          {s.tasks.map(renderRow)}
        </section>
      ))}

      {buckets.overdue.length === 0 &&
        buckets.today.length === 0 &&
        buckets.sections.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-3">Нет задач — всё чисто</p>
        )}

      <TaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} task={editing} />
    </div>
  )
}
