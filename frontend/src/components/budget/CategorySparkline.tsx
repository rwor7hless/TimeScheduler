import { useMemo } from 'react'

interface TxLike {
  date: string
  amount: number
  type: 'expense' | 'income'
}

interface Props {
  transactions: TxLike[]
  color: string
  width?: number
  height?: number
  days?: number
  limit?: number
}

/**
 * Inline SVG sparkline: daily expense total over last `days` days.
 * If `limit` is provided, a horizontal baseline is drawn at `limit / days`.
 */
export default function CategorySparkline({
  transactions,
  color,
  width = 72,
  height = 20,
  days = 14,
  limit,
}: Props) {
  const { points, hasData } = useMemo(() => {
    const today = new Date()
    const buckets: number[] = Array(days).fill(0)
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue
      const d = new Date(tx.date)
      const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
      if (diff >= 0 && diff < days) {
        buckets[days - 1 - diff] += tx.amount
      }
    }
    const max = Math.max(...buckets, 1)
    const dataExists = buckets.some((v) => v > 0)

    if (!dataExists) return { points: '', hasData: false }

    const stepX = width / Math.max(buckets.length - 1, 1)
    const ptStr = buckets
      .map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * (height - 2) - 1).toFixed(1)}`)
      .join(' ')
    return { points: ptStr, hasData: true }
  }, [transactions, days, width, height])

  if (!hasData) {
    return <div style={{ width, height }} className="text-[10px] text-gray-300 dark:text-gray-600 flex items-center">—</div>
  }

  const dailyBudget = limit !== undefined ? limit / days : null
  const max = Math.max(
    ...transactions.filter((t) => t.type === 'expense').map((t) => t.amount),
    1,
  )
  const budgetY = dailyBudget !== null ? height - (dailyBudget / max) * (height - 2) - 1 : null

  return (
    <svg width={width} height={height} className="overflow-visible">
      {budgetY !== null && budgetY > 0 && budgetY < height && (
        <line
          x1={0}
          x2={width}
          y1={budgetY}
          y2={budgetY}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeDasharray="2 2"
          className="text-amber-500"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
