import { useCallback, useEffect, useRef } from 'react'
import { addDays, format, getISOWeek, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { mondayOfTodayISO, shiftMondayISO } from '@/hooks/useWeekStats'

interface Props {
  weekStart: string
  onChange: (ws: string) => void
  /** Inclusive lower bound (Monday ISO). Prev disabled when reached. */
  minDate?: string
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function WeekNavigator({ weekStart, onChange, minDate }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const prevWeekStartRef = useRef(weekStart)
  const direction = weekStart > prevWeekStartRef.current ? 1 : weekStart < prevWeekStartRef.current ? -1 : 0
  prevWeekStartRef.current = weekStart

  const monday = parseISO(weekStart)
  const sunday = addDays(monday, 6)
  const weekNumber = getISOWeek(monday)

  const today = mondayOfTodayISO()
  const isCurrent = weekStart === today
  const canGoNext = weekStart < today
  const canGoPrev = !minDate || weekStart > minDate

  const sameMonth = monday.getMonth() === sunday.getMonth()
  const rangeLabel = sameMonth
    ? `${format(monday, 'd', { locale: ru })}–${format(sunday, 'd MMM yyyy', { locale: ru })}`
    : `${format(monday, 'd MMM', { locale: ru })} — ${format(sunday, 'd MMM yyyy', { locale: ru })}`

  const goPrev = useCallback(() => {
    if (canGoPrev) onChange(shiftMondayISO(weekStart, -7))
  }, [canGoPrev, onChange, weekStart])

  const goNext = useCallback(() => {
    if (canGoNext) onChange(shiftMondayISO(weekStart, 7))
  }, [canGoNext, onChange, weekStart])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const isTyping =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      if (isTyping) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  return (
    <div className="flex items-center justify-center gap-5">
      <button
        type="button"
        onClick={goPrev}
        disabled={!canGoPrev}
        aria-label="Предыдущая неделя"
        className={clsx(
          'flex-shrink-0 w-10 h-10 flex items-center justify-center transition-colors',
          canGoPrev
            ? 'text-fg-body hover:bg-bg-hover'
            : 'text-fg-mid cursor-not-allowed',
        )}
      >
        <ChevronLeft />
      </button>

      <div className="text-center min-w-0 relative h-[62px] flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={weekStart}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -direction * 16 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.2, 0.6, 0.2, 1] }}
            className="w-full"
          >
            <div className="text-[11px] uppercase tracking-wider text-fg-mid">
              Неделя {weekNumber}
            </div>
            <div className="text-base font-semibold text-fg truncate">
              {rangeLabel}
            </div>
            {isCurrent && (
              <motion.span
                animate={shouldReduceMotion ? undefined : { opacity: [1, 0.7, 1] }}
                transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-bg-sel text-accent text-[10px] font-medium tracking-wide"
              >
                Текущая неделя
              </motion.span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={goNext}
        disabled={!canGoNext}
        aria-label="Следующая неделя"
        className={clsx(
          'flex-shrink-0 w-10 h-10 flex items-center justify-center transition-colors',
          canGoNext
            ? 'text-fg-body hover:bg-bg-hover'
            : 'text-fg-mid cursor-not-allowed',
        )}
      >
        <ChevronRight />
      </button>
    </div>
  )
}
