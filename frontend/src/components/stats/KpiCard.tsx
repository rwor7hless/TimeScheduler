import clsx from 'clsx'
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type Accent = 'green' | 'red' | 'amber' | 'violet' | 'sky'

interface Props {
  label: string
  value: ReactNode
  /** Raw delta number (absolute or pp depending on format). If undefined → no badge. */
  delta?: number
  /** Controls badge text: "12" (int), "+5 pp" (pp), "+12%" (pct). */
  deltaFormat?: 'int' | 'pp' | 'pct'
  accent?: Accent
  /** Optional slot after the big number (e.g. trailing unit, flame icon). */
  sub?: ReactNode
}

function DeltaBadge({ delta, format }: { delta: number; format: 'int' | 'pp' | 'pct' }) {
  const isZero = delta === 0
  const isPositive = delta > 0
  const arrow = isZero ? '=' : isPositive ? '↑' : '↓'
  const body =
    format === 'pp'
      ? `${Math.abs(delta)} pp`
      : format === 'pct'
      ? `${Math.abs(delta)}%`
      : String(Math.abs(delta))
  const color = isZero
    ? 'bg-bg-hover text-fg-mid'
    : isPositive
    ? 'bg-bg-cell text-success'
    : 'bg-bg-cell text-danger'
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
        color,
      )}
    >
      <span>{arrow}</span>
      <span>{body}</span>
    </span>
  )
}

const accentText: Record<Accent, string> = {
  green: 'text-success',
  red: 'text-danger',
  amber: 'text-accent',
  violet: 'text-accent',
  sky: 'text-accent',
}

export function KpiCard({ label, value, delta, deltaFormat = 'int', accent, sub }: Props) {
  const shouldReduceMotion = useReducedMotion()
  return (
    <motion.div
      whileHover={
        shouldReduceMotion
          ? undefined
          : { y: -3, transition: { duration: 0.18, ease: [0.2, 0.6, 0.2, 1] } }
      }
      className="group bg-bg-cell border border-line p-4 transition-all duration-200 hover:border-accent cursor-default"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs font-medium text-fg-mid group-hover:text-fg-body transition-colors">
          {label}
        </div>
        {delta !== undefined && <DeltaBadge delta={delta} format={deltaFormat} />}
      </div>
      <div
        className={clsx(
          'text-2xl font-bold flex items-baseline gap-1',
          accent ? accentText[accent] : 'text-fg',
        )}
      >
        <span>{value}</span>
        {sub && (
          <span className="text-xs font-normal text-fg-mid">{sub}</span>
        )}
      </div>
    </motion.div>
  )
}
