import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import StatsPeriodView from '@/components/stats/StatsPeriodView'
import StatsWeekView from '@/components/stats/StatsWeekView'
import { mondayOfTodayISO } from '@/hooks/useWeekStats'

type Tab = 'week' | 'month' | 'year'

const TABS: { id: Tab; label: string }[] = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
]

function parseTab(raw: string | null): Tab {
  return raw === 'month' || raw === 'year' ? raw : 'week'
}

export default function StatsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  const defaultMonday = useMemo(() => mondayOfTodayISO(), [])
  const weekStart = searchParams.get('week') || defaultMonday

  const setTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(searchParams)
      params.set('tab', next)
      if (next === 'week' && !params.get('week')) {
        params.set('week', defaultMonday)
      } else if (next !== 'week') {
        params.delete('week')
      }
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams, defaultMonday],
  )

  const setWeekStart = useCallback(
    (ws: string) => {
      const params = new URLSearchParams(searchParams)
      params.set('tab', 'week')
      params.set('week', ws)
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Статистика</h2>
        <div className="relative flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'relative px-3 py-1.5 text-sm rounded-md transition-colors z-10',
                tab === id
                  ? 'font-medium text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-300',
              )}
            >
              {tab === id && (
                <motion.span
                  layoutId="stats-tab-indicator"
                  className="absolute inset-0 bg-white dark:bg-gray-700 shadow-sm rounded-md -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'week' && <StatsWeekView weekStart={weekStart} onWeekChange={setWeekStart} />}
      {tab === 'month' && <StatsPeriodView period="month" />}
      {tab === 'year' && <StatsPeriodView period="year" />}
    </div>
  )
}
