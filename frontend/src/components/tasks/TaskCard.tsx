import clsx from 'clsx'
import type { Task, Priority } from '@/types/task'
import { WEEKDAY_LABELS } from '@/types/task'
import TagBadge from './TagBadge'

interface TaskCardProps {
  task: Task
  onClick?: () => void
  compact?: boolean
  className?: string
  overlapping?: boolean
}

const PRIORITY_CONFIG: Record<Priority, { icon: string; className: string }> = {
  low: { icon: '↓', className: 'text-gray-400' },
  medium: { icon: '—', className: 'text-blue-400' },
  high: { icon: '↑', className: 'text-orange-500' },
  urgent: { icon: '⚡', className: 'text-red-500' },
}

function getDeadlineStatus(deadline: string | null): 'overdue' | 'soon' | null {
  if (!deadline) return null
  const now = new Date()
  const dl = new Date(deadline)
  if (dl < now) return 'overdue'
  const hoursLeft = (dl.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursLeft <= 24) return 'soon'
  return null
}

export default function TaskCard({ task, onClick, compact = false, className, overlapping = false }: TaskCardProps) {
  const color = task.color || '#6B7280'
  const prio = PRIORITY_CONFIG[task.priority]
  const isCancelled = task.status === 'done'
  const deadlineStatus = !isCancelled ? getDeadlineStatus(task.deadline) : null

  const subtasksDone = task.subtasks?.filter(s => s.status === 'done').length ?? 0
  const subtasksTotal = task.subtasks?.length ?? 0

  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-lg border cursor-pointer hover:shadow-md transition-shadow overflow-hidden outline-none',
        overlapping ? 'border-transparent shadow-lg' : 'bg-white',
        !overlapping && isCancelled && 'opacity-60',
        !overlapping && deadlineStatus === 'overdue' && 'border-red-400 ring-1 ring-red-200',
        !overlapping && deadlineStatus === 'soon' && 'border-amber-400 ring-1 ring-amber-200',
        !overlapping && !deadlineStatus && 'border-gray-200',
        className
      )}
      style={overlapping ? { backgroundColor: color, borderColor: color } : undefined}
    >
      <div className="flex h-full">
        {!overlapping && (
          <div
            className="w-1.5 rounded-l-lg flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        )}

        <div
          className={clsx(
            'flex-1 min-w-0',
            compact ? 'px-1.5 py-1' : 'px-3 py-2'
          )}
          style={overlapping ? undefined : { backgroundColor: `${color}26` }}
        >
          {/* Compact: время сверху + название */}
          {compact && task.scheduled_start && (
            <div className={clsx(
              'text-[9px] font-mono leading-none mb-0.5 tabular-nums',
              overlapping ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
            )}>
              {new Date(task.scheduled_start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              {task.scheduled_end && ` – ${new Date(task.scheduled_end).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          )}
          <div className="flex items-start justify-between gap-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isCancelled && (
                <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-white text-[9px] flex-shrink-0">
                  ✓
                </span>
              )}
              <h4
                className={clsx(
                  'font-medium leading-snug break-words flex-1 min-w-0',
                  compact ? 'text-[11px]' : 'text-sm',
                  overlapping ? 'text-white drop-shadow-sm' : (isCancelled ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'),
                )}
              >
                {task.title}
              </h4>
            </div>
            <span className={clsx('flex-shrink-0 text-xs font-bold leading-none mt-0.5', overlapping ? 'text-white/90' : prio.className)} title={task.priority}>
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
          {/* Deadline indicator */}
          {!compact && deadlineStatus && (
            <div className={clsx(
              'text-[10px] font-medium mt-1.5 flex items-center gap-1',
              deadlineStatus === 'overdue' ? 'text-red-600' : 'text-amber-600'
            )}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {deadlineStatus === 'overdue'
                ? `Просрочено`
                : `Дедлайн < 24ч`}
            </div>
          )}
          {/* Subtask list */}
          {!compact && subtasksTotal > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {task.subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 ${sub.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`} />
                  <span className={`text-[11px] truncate ${sub.status === 'done' ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                    {sub.title}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(subtasksDone / subtasksTotal) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{subtasksDone}/{subtasksTotal}</span>
              </div>
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
