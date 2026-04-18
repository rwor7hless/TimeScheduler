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
    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
    : isPositive
    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
    : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums',
        color,
      )}
    >
      <span>{arrow}</span>
      <span>{body}</span>
    </span>
  )
}

const accentText: Record<Accent, string> = {
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-500 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  violet: 'text-violet-600 dark:text-violet-400',
  sky: 'text-sky-600 dark:text-sky-400',
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
      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-all duration-200 hover:shadow-[0_8px_24px_-8px_rgba(245,158,11,0.25)] hover:border-amber-300 dark:hover:border-amber-500/40 cursor-default"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
          {label}
        </div>
        {delta !== undefined && <DeltaBadge delta={delta} format={deltaFormat} />}
      </div>
      <div
        className={clsx(
          'text-2xl font-bold flex items-baseline gap-1',
          accent ? accentText[accent] : 'text-gray-900 dark:text-gray-100',
        )}
      >
        <span>{value}</span>
        {sub && (
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{sub}</span>
        )}
      </div>
    </motion.div>
  )
}
