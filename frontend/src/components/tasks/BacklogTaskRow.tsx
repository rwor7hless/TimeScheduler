import clsx from 'clsx'
import TagBadgeGroup from './TagBadgeGroup'
import type { Task } from '@/types/task'

const TITLE_MAX_CHARS = 50
function truncateTitle(s: string, max: number = TITLE_MAX_CHARS): string {
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s
}

function formatRelativeDate(
  dateStr: string | null | undefined,
  todayStr: string,
): { text: string; tomorrow: boolean } | null {
  if (!dateStr) return null
  const dateOnly = dateStr.slice(0, 10)
  if (dateOnly === todayStr) return null
  const today = new Date(todayStr)
  const target = new Date(dateOnly)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays === 1) return { text: 'завтра', tomorrow: true }
  if (diffDays === -1) return { text: 'вчера', tomorrow: false }
  return {
    text: target.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    tomorrow: false,
  }
}

interface Props {
  task: Task
  todayStr: string
  onToggle: () => void
  onAddToMyDay?: () => void
  onClick: () => void
  /** When set, renders a small badge to the right of the title showing where the task lives. */
  listLabel?: string
}

export default function BacklogTaskRow({
  task,
  todayStr,
  onToggle,
  onAddToMyDay,
  onClick,
  listLabel,
}: Props) {
  const done = task.done
  const isOverdue = !done && task.deadline != null && task.deadline.slice(0, 10) < todayStr
  const dateLabel = formatRelativeDate(task.scheduled_start ?? task.deadline, todayStr)

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2 border transition-all group',
        done
          ? 'bg-bg-raised border-line'
          : 'bg-bg-cell border-line hover:border-accent',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        title={done ? 'Снять отметку':'Отметить выполненной'}
        className={clsx(
          'w-5 h-5 flex-shrink-0 flex items-center justify-center transition-all border-2',
          done
            ? 'text-bg border-transparent'
            : 'border-line hover:border-success hover:bg-bg-cell',
        )}
        style={done ? { backgroundColor: task.color } : undefined}
      >
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className={clsx(done ? '' : 'opacity-0 group-hover:opacity-100 text-success transition-opacity')}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <div
        className={clsx('w-1 h-4 flex-shrink-0', done && 'opacity-50')}
        style={{ backgroundColor: task.color }}
      />
      <button
        type="button"
        onClick={onClick}
        title={task.title}
        className={clsx(
          'flex-1 min-w-0 text-sm font-medium text-left transition-colors truncate',
          done
            ? 'line-through text-fg-mid'
            : 'text-fg hover:text-accent',
        )}
      >
        {truncateTitle(task.title)}
      </button>
      {!done && task.tags && task.tags.length > 0 && (
        <TagBadgeGroup tags={task.tags} className="flex-shrink-0" />
      )}
      {!done && listLabel && (
        <span className="text-[10px] text-fg-mid px-1.5 py-0.5 bg-bg-hover flex-shrink-0">
          {listLabel}
        </span>
      )}
      {!done && dateLabel && (
        <span
          className={clsx(
            'text-[10px] font-medium px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap',
            isOverdue
              ? 'text-danger'
              : dateLabel.tomorrow
              ? 'bg-bg-sel text-accent'
              : 'text-fg-mid',
          )}
        >
          {dateLabel.text}
        </span>
      )}
      {!done && onAddToMyDay && (
        <button
          type="button"
          onClick={onAddToMyDay}
          title="Добавить в сегодня"
          className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-fg-mid hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  )
}
