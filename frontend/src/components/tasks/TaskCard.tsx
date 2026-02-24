import clsx from 'clsx'
import type { Task } from '@/types/task'
import { WEEKDAY_LABELS } from '@/types/task'
import TagBadge from './TagBadge'

interface TaskCardProps {
  task: Task
  onClick?: () => void
  compact?: boolean
  className?: string
}

export default function TaskCard({ task, onClick, compact = false, className }: TaskCardProps) {
  const color = task.color || '#6B7280'
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow overflow-hidden',
        className
      )}
    >
      <div className="flex h-full">
        {/* Узкая цветная полоса (окантовка) слева */}
        <div
          className="w-1.5 rounded-l-lg"
          style={{ backgroundColor: color }}
        />

        {/* Основной цветной блок задачи */}
        <div
          className={clsx(
            'flex-1',
            compact ? 'px-2 py-1.5' : 'px-3 py-2'
          )}
          style={{ backgroundColor: `${color}26` }}
        >
          <h4 className={clsx('font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>
            {task.title}
          </h4>
          {!compact && task.description && (
            <p className="text-xs text-gray-700 mt-1 line-clamp-2">{task.description}</p>
          )}
          {!compact && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          )}
          {!compact && task.scheduled_start && (
            <div className="text-xs text-gray-600 mt-2">
              {new Date(task.scheduled_start).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {task.scheduled_end && (
                <>
                  {' - '}
                  {new Date(task.scheduled_end).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              )}
            </div>
          )}
          {!compact && task.repeat_days && task.repeat_days.length > 0 && (
            <div className="text-xs text-amber-600 mt-1">
              ↻ {task.repeat_days.map((d) => WEEKDAY_LABELS[d]).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
