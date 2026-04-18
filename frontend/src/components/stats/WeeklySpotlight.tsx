import type { Stats } from '@/types/stats'
import { CompletionDonut } from './CompletionDonut'

interface Props {
  stats: Stats
  /** Donut center value. Same semantics as CompletionDonut.value. */
  donutValue: number | null
  donutLabel: string
}

function hhmm(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function bestStreak(dailyCompletions: { date: string; count: number }[]): number {
  // Counts the current tail streak (consecutive days from the end with count>0).
  // For a finished past week this effectively becomes "longest trailing streak",
  // for the current week it reflects the active streak up to today.
  const sorted = [...dailyCompletions].sort((a, b) => a.date.localeCompare(b.date))
  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].count > 0) streak++
    else break
  }
  return streak
}

function describePeakBand(hours: number[]): { band: string; hint: string } | null {
  if (!hours.length) return null
  const top = hours[0]
  const label = hhmm(top)
  if (top < 6) return { band: label, hint: 'глубокая ночь' }
  if (top < 12) return { band: label, hint: 'утро' }
  if (top < 17) return { band: label, hint: 'день' }
  if (top < 22) return { band: label, hint: 'вечер' }
  return { band: label, hint: 'поздний вечер' }
}

function Row({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="group flex items-center gap-2.5 -mx-2 px-2 py-1 rounded-lg cursor-default transition-all duration-200 hover:bg-amber-50/60 dark:hover:bg-amber-500/5">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20">
        {icon}
      </div>
      <div className="min-w-0 flex-1 transition-transform duration-200 group-hover:translate-x-0.5">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {label}
        </div>
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {value}
          {sub && (
            <span className="ml-1 text-[11px] font-normal text-gray-500 dark:text-gray-400">
              {sub}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function LightningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3M7 4h10v6a5 5 0 0 1-10 0V4z" />
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2s4 5 4 9a4 4 0 0 1-8 0c0-2 1-4 1-4s-3 2-3 6a6 6 0 0 0 12 0c0-5-6-11-6-11z" />
    </svg>
  )
}

/**
 * Right-column "verdict panel" for the Week view.
 *
 * Donut headlines the panel visually, insight rows underneath turn dead space
 * into context: peak hour of the week, top project by completions, streak.
 * Each row degrades cleanly — if there's no data, the row is skipped rather
 * than showing em-dashes.
 */
export function WeeklySpotlight({ stats, donutValue, donutLabel }: Props) {
  const peak = describePeakBand(stats.most_active_hours)
  const topBoard = stats.by_board.length
    ? [...stats.by_board].sort((a, b) => b.count - a.count)[0]
    : null
  const streak = bestStreak(stats.daily_completions)

  const rows: React.ReactNode[] = []
  if (peak) {
    rows.push(
      <Row
        key="peak"
        icon={<LightningIcon />}
        label="Пик активности"
        value={peak.band}
        sub={peak.hint}
      />,
    )
  }
  if (topBoard && topBoard.count > 0) {
    rows.push(
      <Row
        key="board"
        icon={<TrophyIcon />}
        label="Лидер недели"
        value={topBoard.label}
        sub={`${topBoard.count} задач`}
      />,
    )
  }
  if (streak > 0) {
    rows.push(
      <Row
        key="streak"
        icon={<FlameIcon />}
        label="Серия дней"
        value={`${streak}`}
        sub={streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}
      />,
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center py-2">
        <CompletionDonut value={donutValue} label={donutLabel} />
      </div>
      {rows.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/70 space-y-2.5">
          {rows}
        </div>
      )}
    </div>
  )
}
