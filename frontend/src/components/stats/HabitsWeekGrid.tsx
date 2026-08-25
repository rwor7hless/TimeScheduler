import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { HabitProgress } from '@/types/stats'
import { IconFlame } from '@/components/ui/icons'

interface Props {
  habits: HabitProgress[]
}

const RU_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/**
 * Matrix: rows = habits, cols = Mon..Sun. Cells are filled (done) or empty (missed).
 * Expects backend to send HabitProgress.days with exactly 7 booleans (week mode).
 */
export function HabitsWeekGrid({ habits }: Props) {
  const shouldReduceMotion = useReducedMotion()

  if (habits.length === 0) {
    return (
      <div className="bg-bg-cell border border-line p-6 text-center">
        <p className="text-sm text-fg-mid">Привычки не заведены.</p>
        <Link
          to="/habits"
          className="inline-block mt-2 text-xs font-medium text-accent hover:underline"
        >
          Добавить привычку →
        </Link>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            delayChildren: shouldReduceMotion ? 0 : 0.15,
            staggerChildren: shouldReduceMotion ? 0 : 0.015,
          },
        },
      }}
      className="bg-bg-cell border border-line p-4"
    >
      <h3 className="text-sm font-medium text-fg-body mb-3">
        Привычки по дням недели
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium text-xs uppercase tracking-wider text-fg-mid pb-2">
                Привычка
              </th>
              {RU_SHORT.map((d) => (
                <th
                  key={d}
                  className="text-center font-medium text-[10px] uppercase tracking-wider text-fg-mid pb-2 w-9"
                >
                  {d}
                </th>
              ))}
              <th className="text-right font-medium text-xs uppercase tracking-wider text-fg-mid pb-2 pl-3">
                Стрик
              </th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => {
              const days = h.days.length === 7 ? h.days : [...h.days, ...Array(7).fill(false)].slice(0, 7)
              return (
                <tr key={h.habit_id} className="border-t border-line-soft">
                  <td className="py-2 pr-3 text-sm font-medium text-fg truncate max-w-[12rem]">
                    {h.name}
                  </td>
                  {days.map((done, i) => (
                    <td key={i} className="py-2 text-center">
                      <motion.span
                        variants={{
                          hidden: { opacity: 0, scale: 0.7 },
                          show: { opacity: 1, scale: 1 },
                        }}
                        whileHover={
                          shouldReduceMotion
                            ? undefined
                            : done
                            ? { scale: 1.25, boxShadow: '0 0 14px rgba(245,158,11,0.55)' }
                            : { scale: 1.2 }
                        }
                        transition={{ duration: 0.25, ease: [0.2, 0.6, 0.2, 1] }}
                        className={
                          'inline-flex items-center justify-center w-5 h-5 cursor-default transition-colors ' +
                          (done
                            ? 'bg-accent text-bg'
                            : 'bg-bg-hover text-fg-mid hover:bg-bg-hover')
                        }
                      >
                        {done ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <span className="w-1.5 h-1.5 bg-current" />
                        )}
                      </motion.span>
                    </td>
                  ))}
                  <td className="py-2 pl-3 text-right text-sm tabular-nums text-fg-body">
                    <span className="inline-flex items-baseline gap-1">
                      {h.current_streak >= 3 && (
                        <motion.span
                          aria-hidden
                          animate={shouldReduceMotion ? undefined : { scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
                          transition={
                            shouldReduceMotion
                              ? undefined
                              : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                          }
                          className="inline-flex items-center text-accent"
                          style={{ color: 'var(--accent)' }}
                        >
                          <IconFlame size={14} />
                        </motion.span>
                      )}
                      <span>{h.current_streak}</span>
                      <span className="text-[11px] text-fg-mid">дн.</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
