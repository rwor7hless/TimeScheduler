import { useState } from 'react'
import { useStats } from '@/hooks/useStats'
import Spinner from '@/components/ui/Spinner'
import clsx from 'clsx'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type Period = 'week' | 'month' | 'year'

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div
        className={clsx(
          'text-2xl font-bold',
          accent === 'green' && 'text-green-600',
          accent === 'red' && 'text-red-500',
          accent === 'amber' && 'text-amber-600',
          !accent && 'text-gray-900'
        )}
      >
        {value}
      </div>
    </div>
  )
}

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('month')
  const { data: stats, isLoading } = useStats(period)

  if (isLoading) return <Spinner className="mt-20" />
  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Statistics</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                period === p ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Tasks" value={stats.active_tasks} />
        <StatCard label="Completed" value={stats.completed_last_month} accent="green" />
        <StatCard label="Overdue" value={stats.overdue_count} accent="red" />
        <StatCard
          label="Productivity"
          value={stats.productivity_percent != null ? `${stats.productivity_percent}%` : 'N/A'}
          accent="amber"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Completion trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Daily Completions</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.daily_completions}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#D97706"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Average completion time */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Metrics</h3>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500">Avg. Completion Time</div>
              <div className="text-xl font-bold text-gray-900">
                {stats.avg_completion_hours != null
                  ? `${stats.avg_completion_hours}h`
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Most Active Hours</div>
              <div className="text-sm text-gray-700">
                {stats.most_active_hours.length > 0
                  ? stats.most_active_hours.map((h) => `${h}:00`).join(', ')
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Habit progress */}
      {stats.habit_progress.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Habit Progress</h3>
          <div className="space-y-3">
            {stats.habit_progress.map((hp) => (
              <div key={hp.habit_id} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{hp.name}</div>
                  <div className="text-xs text-gray-500">
                    Streak: {hp.current_streak} days
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-green-500 transition-all"
                      style={{ width: `${Math.min(hp.completion_rate * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 w-12 text-right">
                    {Math.round(hp.completion_rate * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
