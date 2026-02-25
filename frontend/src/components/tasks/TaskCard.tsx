import clsx from 'clsx'
import type { Task, Priority } from '@/types/task'
import { WEEKDAY_LABELS } from '@/types/task'
import TagBadge from './TagBadge'

interface TaskCardProps {
  task: Task
  onClick?: () => void
  compact?: boolean
  className?: string
}

const PRIORITY_CONFIG: Record<Priority, { icon: string; className: string }> = {
  low: { icon: '↓', className: 'text-gray-400' },
  medium: { icon: '—', className: 'text-blue-400' },
  high: { icon: '↑', className: 'text-orange-500' },
  urgent: { icon: '⚡', className: 'text-red-500' },
}

export default function TaskCard({ task, onClick, compact = false, className }: TaskCardProps) {
  const color = task.color || '#6B7280'
  const prio = PRIORITY_CONFIG[task.priority]

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow overflow-hidden',
        className
      )}
    >
      <div className="flex h-full">
        <div
          className="w-1.5 rounded-l-lg"
          style={{ backgroundColor: color }}
        />

        <div
          className={clsx(
            'flex-1',
            compact ? 'px-2 py-1.5' : 'px-3 py-2'
          )}
          style={{ backgroundColor: `${color}26` }}
        >
          <div className="flex items-start justify-between gap-1">
            <h4 className={clsx('font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>
              {task.title}
            </h4>
            <span className={clsx('flex-shrink-0 text-xs font-bold leading-none mt-0.5', prio.className)} title={task.priority}>
              {prio.icon}
            </span>
          </div>
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
                  {' — '}
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
