import type { Tag } from '@/types/task'
import { inkOn } from '@/styles/contrast'

export default function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: tag.color, color: inkOn(tag.color) }}
    >
      {tag.name}
    </span>
  )
}
