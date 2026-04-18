import { motion, useReducedMotion } from 'framer-motion'
import { AnimatedNumber } from './AnimatedNumber'

interface Props {
  /** 0..100. If null, renders a dashed empty ring + em-dash. */
  value: number | null
  label?: string
  /** Total pixel size. Default 160. */
  size?: number
}

/**
 * Animated donut with a gradient stroke and a count-up percentage at center.
 * Rendered fully in SVG (no recharts) so we can layer a motion.circle over the
 * track and control the fill via strokeDashoffset.
 */
export function CompletionDonut({ value, label, size = 160 }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const stroke = size * 0.08
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const cx = size / 2
  const cy = size / 2

  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  const offset = circumference * (1 - pct / 100)
  const gradientId = `donut-grad-${Math.round(Math.random() * 1e6)}`

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-gray-100 dark:stroke-gray-700"
          strokeDasharray={value == null ? '4 8' : undefined}
        />
        {value !== null && (
          <motion.circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: shouldReduceMotion ? offset : circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: shouldReduceMotion ? 0 : 1.1, ease: [0.2, 0.6, 0.2, 1] }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {value == null ? (
          <div className="text-2xl font-bold text-gray-300 dark:text-gray-600">—</div>
        ) : (
          <div className="flex items-baseline">
            <AnimatedNumber
              value={pct}
              className="text-4xl font-bold bg-gradient-to-br from-amber-500 to-orange-500 bg-clip-text text-transparent tabular-nums"
            />
            <span className="text-lg font-semibold text-amber-500 ml-0.5">%</span>
          </div>
        )}
        {label && (
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">
            {label}
          </div>
        )}
      </div>
    </div>
  )
}
