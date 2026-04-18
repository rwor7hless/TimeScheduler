import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue, useReducedMotion } from 'framer-motion'

interface Props {
  value: number
  /** Seconds. Default 1.1s. */
  duration?: number
  /** Render transform. Default: round and toString. */
  format?: (v: number) => string
  className?: string
}

/**
 * Count-up number driven by framer-motion's imperative `animate()`.
 * Cancels any in-flight animation when `value` changes mid-flight —
 * protects against rapid week navigation (prev/next mashing).
 * Honors prefers-reduced-motion by jumping straight to the target value.
 */
export function AnimatedNumber({ value, duration = 1.1, format, className }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState(() => (format ? format(0) : '0'))
  const prevTargetRef = useRef<number>(0)
  const firstRenderRef = useRef(true)

  useEffect(() => {
    const fmt = format ?? ((v: number) => String(Math.round(v)))

    if (shouldReduceMotion) {
      mv.set(value)
      setDisplay(fmt(value))
      prevTargetRef.current = value
      firstRenderRef.current = false
      return
    }

    const from = firstRenderRef.current ? 0 : prevTargetRef.current
    firstRenderRef.current = false
    mv.set(from)

    const controls = animate(mv, value, {
      duration,
      ease: [0.2, 0.6, 0.2, 1],
      onUpdate: (v) => setDisplay(fmt(v)),
    })

    prevTargetRef.current = value
    return () => controls.stop()
  }, [value, duration, format, mv, shouldReduceMotion])

  return <span className={className}>{display}</span>
}
