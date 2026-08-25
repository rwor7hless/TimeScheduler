import clsx from 'clsx'
import type { Task, Priority } from '@/types/task'
import { WEEKDAY_LABELS } from '@/types/task'
import TagBadgeGroup from './TagBadgeGroup'
import {
  IconArrowDown,
  IconDash,
  IconArrowUp,
  IconZap,
} from '@/components/ui/icons'
import type { ComponentType } from 'react'

interface TaskCardProps {
  task: Task
  onClick?: () => void
  compact?: boolean
  className?: string
  overlapping?: boolean
}

const PRIORITY_CONFIG: Record<
  Priority,
  { Icon: ComponentType<{ size?: number }>; className: string }
> = {
  low:    { Icon: IconArrowDown, className: 'text-fg-mid' },
  medium: { Icon: IconDash,      className: 'text-fg-body' },
  high:   { Icon: IconArrowUp,   className: 'text-accent' },
  urgent: { Icon: IconZap,       className: 'text-danger' },
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
  const isCancelled = task.done
  const deadlineStatus = !isCancelled ? getDeadlineStatus(task.deadline) : null

  const subtasksDone = task.subtasks?.filter(s => s.done).length ?? 0
  const subtasksTotal = task.subtasks?.length ?? 0

  return (
    <div
      onClick={onClick}
      className={clsx(
        'border cursor-pointer hover: transition- overflow-hidden outline-none',
        overlapping ? 'border-transparent' : 'bg-bg-cell',
        !overlapping && isCancelled && 'opacity-60',
        !overlapping && deadlineStatus === 'overdue' && 'border-danger ring-1 ring-red-200',
        !overlapping && deadlineStatus === 'soon' && 'border-accent ring-1 ring-amber-200',
        !overlapping && !deadlineStatus && 'border-line',
        className
      )}
      style={overlapping ? { backgroundColor: color, borderColor: color } : undefined}
    >
      <div className="flex h-full">
        {!overlapping && (
          <div
            className="w-1.5 flex-shrink-0"
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
              overlapping ? 'text-bg' : 'text-fg-mid'
            )}>
              {new Date(task.scheduled_start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              {task.scheduled_end && ` – ${new Date(task.scheduled_end).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          )}
          <div className="flex items-start justify-between gap-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isCancelled && (
                <span className="inline-flex items-center justify-center w-3 h-3 bg-bg-cell text-bg text-[9px] flex-shrink-0">
                  ✓
                </span>
              )}
              <h4
                className={clsx(
                  'font-medium leading-snug break-words flex-1 min-w-0',
                  compact ? 'text-[11px]' : 'text-sm',
                  overlapping ? 'text-bg drop-' : (isCancelled ? 'text-fg-mid line-through' : 'text-fg'),
                )}
              >
                {task.title}
              </h4>
            </div>
            <span className={clsx('flex-shrink-0 leading-none mt-0.5 inline-flex', overlapping ? 'text-bg' : prio.className)} title={task.priority}>
              <prio.Icon size={13} />
            </span>
          </div>
          {!compact && task.description && (
            <p className="text-xs text-fg-body mt-1 line-clamp-2">{task.description}</p>
          )}
          {!compact && task.tags.length > 0 && (
            <div className="mt-2">
              <TagBadgeGroup tags={task.tags} max={3} size="md" />
            </div>
          )}
          {compact && task.tags.length > 0 && !isCancelled && (
            <div className="mt-0.5">
              <TagBadgeGroup tags={task.tags} max={2} size="sm" />
            </div>
          )}
          {/* Deadline indicator */}
          {!compact && deadlineStatus && (
            <div className={clsx(
              'text-[10px] font-medium mt-1.5 flex items-center gap-1',
              deadlineStatus === 'overdue' ? 'text-danger' : 'text-accent'
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
                  <div className={`w-2.5 h-2.5 border flex-shrink-0 ${sub.done ? 'bg-bg-cell border-success' : 'border-line'}`} />
                  <span className={`text-[11px] truncate ${sub.done ? 'line-through text-fg-mid' : 'text-fg-body'}`}>
                    {sub.title}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="flex-1 h-1 bg-bg-hover overflow-hidden">
                  <div
                    className="h-full bg-bg-cell transition-all"
                    style={{ width: `${(subtasksDone / subtasksTotal) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-fg-mid flex-shrink-0">{subtasksDone}/{subtasksTotal}</span>
              </div>
            </div>
          )}
          {!compact && task.scheduled_start && (
            <div className="text-xs text-fg-body mt-2">
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
            <div className="text-xs text-accent mt-1">
              ↻ {task.repeat_days.map((d) => WEEKDAY_LABELS[d]).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
