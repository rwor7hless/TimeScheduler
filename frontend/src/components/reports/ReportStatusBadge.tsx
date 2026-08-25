interface Props {
  status: string
  isStreaming: boolean
}

export function ReportStatusBadge({ status, isStreaming }: Props) {
  if (isStreaming || status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 bg-bg-cell text-accent">
        <span className="w-1.5 h-1.5 bg-accent animate-pulse" />
        Пишет…
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 bg-bg-cell text-fg-mid">
        <span className="w-1.5 h-1.5 bg-fg-mid animate-pulse" />
        Генерируется…
      </span>
    )
  }
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-bg-cell text-success">
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Готово
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-bg-cell text-danger">
      Ошибка
    </span>
  )
}
