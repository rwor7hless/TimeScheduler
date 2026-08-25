import type { Tag } from '@/types/task'
import { inkOn } from '@/styles/contrast'

interface Props {
  tags: Tag[]
  /** Сколько тегов показать цветными пилюлями. Остальные — «+N». */
  max?: number
  /** 'sm' — узкие (для compact-карточек и inline-списков), 'md' — обычные. */
  size?: 'sm' | 'md'
  className?: string
}

export default function TagBadgeGroup({ tags, max = 2, size = 'sm', className = '' }: Props) {
  if (!tags || tags.length === 0) return null
  const visible = tags.slice(0, max)
  const rest = tags.length - visible.length
  const pillClass =
    size === 'sm'
      ? 'inline-flex items-center px-1.5 py-px text-[10px] font-medium leading-tight max-w-[96px] truncate'
      : 'inline-flex items-center px-2 py-0.5 text-xs font-medium'
  const restClass =
    size === 'sm'
      ? 'inline-flex items-center px-1.5 py-px text-[10px] font-medium text-fg-mid bg-bg-hover leading-tight'
      : 'inline-flex items-center px-2 py-0.5 text-xs font-medium text-fg-mid bg-bg-hover'

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {visible.map((t) => (
        <span key={t.id} className={pillClass} style={{ backgroundColor: t.color, color: inkOn(t.color) }} title={t.name}>
          {t.name}
        </span>
      ))}
      {rest > 0 && <span className={restClass}>+{rest}</span>}
    </span>
  )
}
