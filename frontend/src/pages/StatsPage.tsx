import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
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
      <div className="topbar">
        <h1 className="page-title">Статистика</h1>
        <div className="ts-tabs" style={{ margin: 0, border: 0 }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={clsx(tab === id && 'active')}
            >
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
