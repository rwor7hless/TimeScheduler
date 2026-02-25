import { useState, useMemo } from 'react'
import { format, subDays, getDay, getMonth } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTheme } from '@/context/ThemeContext'
import { useHabits, useCreateHabit, useDeleteHabit, useToggleHabitLog } from '@/hooks/useHabits'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { Habit } from '@/types/habit'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

// ─── Color palette ─────────────────────────────────────────────────────────────

const HABIT_COLORS = [
  '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981',
  '#F97316', '#EC4899', '#06B6D4', '#84CC16', '#6366F1',
]

// ─── Heatmap util ──────────────────────────────────────────────────────────────

type HeatmapDay = { date: string; completed: boolean; future: boolean; day: Date } | null

function buildHeatmapGrid(completedDates: Set<string>): HeatmapDay[][] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yearStart = new Date(today.getFullYear(), 0, 1)
  const yearEnd = new Date(today.getFullYear(), 11, 31)
  const rawDays: { date: string; completed: boolean; future: boolean; day: Date }[] = []
  const cur = new Date(yearStart)
  while (cur <= yearEnd) {
    const dateStr = format(cur, 'yyyy-MM-dd')
    const future = cur > today
    rawDays.push({ date: dateStr, completed: !future && completedDates.has(dateStr), future, day: new Date(cur) })
    cur.setDate(cur.getDate() + 1)
  }
  // Mon-based column offset (Mon=0, Tue=1, … Sun=6)
  const firstDow = (getDay(rawDays[0].day) + 6) % 7
  const weeks: HeatmapDay[][] = []
  let week: HeatmapDay[] = Array.from({ length: firstDow }, () => null)
  for (const day of rawDays) {
    week.push(day)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

type StatColor = 'amber' | 'emerald' | 'orange' | 'violet'

const colorMap: Record<StatColor, { bg: string; text: string }> = {
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-900' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-900' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-900' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-900' },
}

function StatCard({ label, value, color }: { label: string; value: string; color: StatColor }) {
  const c = colorMap[color]
  return (
    <div className={clsx('rounded-lg px-3 py-2', c.bg)}>
      <div className="text-[10px] text-gray-500 leading-tight">{label}</div>
      <div className={clsx('text-xl font-bold leading-tight mt-0.5', c.text)}>{value}</div>
    </div>
  )
}

// ─── Time buckets ──────────────────────────────────────────────────────────────

const TIME_BUCKETS = [
  { id: 'morning',      label: 'Утро',          hours: [6,7,8,9,10,11],      color: '#FBBF24', neon: '#FFEE44' },
  { id: 'afternoon',    label: 'День',          hours: [12,13,14,15,16,17],  color: '#34D399', neon: '#00FF99' },
  { id: 'evening',      label: 'Вечер',         hours: [18,19,20,21],        color: '#60A5FA', neon: '#00CCFF' },
  { id: 'night',        label: 'Ночь',          hours: [22,23,0,1,2],        color: '#A78BFA', neon: '#CC66FF' },
  { id: 'late night',   label: 'Поздняя ночь',  hours: [3,4,5],              color: '#A78BFA', neon: '#CC66FF' },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export default function HabitsPage() {
  const { data: habits, isLoading } = useHabits()
  const createHabit = useCreateHabit()
  const deleteHabit = useDeleteHabit()
  const toggleLog = useToggleHabitLog()

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(HABIT_COLORS[0])
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(null)
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null)

  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const isCompleted = (habit: Habit, date: string) =>
    habit.logs.some((log) => log.date === date)

  const selectedHabit = useMemo<Habit | null>(() => {
    if (!habits || habits.length === 0) return null
    if (selectedHabitId == null) return habits[0]
    return habits.find((h) => h.id === selectedHabitId) ?? habits[0]
  }, [habits, selectedHabitId])

  const buildSummary = (habit: Habit) => {
    let totalDone30 = 0
    for (let i = 0; i < 30; i++) {
      if (isCompleted(habit, format(subDays(new Date(), i), 'yyyy-MM-dd'))) totalDone30++
    }
    let currentStreak = 0
    for (let i = 0; i < 365; i++) {
      if (isCompleted(habit, format(subDays(new Date(), i), 'yyyy-MM-dd'))) currentStreak++
      else break
    }
    let bestStreak = 0, streak = 0
    for (let i = 364; i >= 0; i--) {
      if (isCompleted(habit, format(subDays(new Date(), i), 'yyyy-MM-dd'))) {
        streak++; bestStreak = Math.max(bestStreak, streak)
      } else streak = 0
    }
    return {
      completion30: Math.round((totalDone30 / 30) * 100),
      totalDone30,
      currentStreak,
      bestStreak,
      totalAll: habit.logs.length,
    }
  }

  // Precompute log sets for O(1) lookup
  const logSets = useMemo(() => {
    const sets = new Map<number, Set<string>>()
    habits?.forEach(h => sets.set(h.id, new Set(h.logs.map(l => l.date))))
    return sets
  }, [habits])

  const fastCompleted = (habit: Habit, date: string) =>
    logSets.get(habit.id)?.has(date) ?? false

  const streakAtDay = (habit: Habit, day: Date): number => {
    let streak = 0
    let cur = day
    for (let i = 0; i < 365; i++) {
      if (fastCompleted(habit, format(cur, 'yyyy-MM-dd'))) {
        streak++
        cur = subDays(cur, 1)
      } else break
    }
    return streak
  }

  const buildStreakLineData = () => {
    if (!habits?.length) return []
    return Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i)
      const entry: Record<string, number | string> = { day: format(d, 'd') }
      for (const h of habits) {
        entry[`h_${h.id}`] = streakAtDay(h, d)
      }
      return entry
    })
  }

  const buildTimeData = (habit: Habit) => {
    const counts: Record<string, number> = Object.fromEntries(TIME_BUCKETS.map(b => [b.id, 0]))
    habit.logs.forEach((log) => {
      if (!log.completed_at) return
      // Ensure timezone info is present so getHours() returns local time correctly
      const raw = log.completed_at
      const normalized = (raw.endsWith('Z') || raw.includes('+') || raw.includes('-', 10))
        ? raw
        : raw + 'Z'
      const h = new Date(normalized).getHours()
      const bucket = TIME_BUCKETS.find(b => b.hours.includes(h))
      if (bucket) counts[bucket.id]++
    })
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return TIME_BUCKETS.map(b => ({
      ...b,
      value: counts[b.id],
      percent: total > 0 ? Math.round((counts[b.id] / total) * 100) : 0,
    })).filter(d => d.value > 0)
  }

  const heatmapGrid = useMemo<HeatmapDay[][]>(() => {
    if (!selectedHabit) return []
    return buildHeatmapGrid(new Set(selectedHabit.logs.map(l => l.date)))
  }, [selectedHabit])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await createHabit.mutateAsync({ name: newName.trim(), color: newColor })
      setNewName(''); setNewColor(HABIT_COLORS[0]); setModalOpen(false)
      toast.success('Привычка создана')
    } catch { toast.error('Не удалось создать привычку') }
  }

  const handleToggle = async (habitId: number, date: string) => {
    try { await toggleLog.mutateAsync({ id: habitId, date }) }
    catch { toast.error('Не удалось обновить') }
  }

  if (isLoading) return <Spinner className="mt-20" />

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-9rem)] min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Привычки</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}>+ Привычка</Button>
      </div>

      {/* Main grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-4 lg:overflow-hidden">

        {/* Left: habit list */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          {habits?.length === 0 && (
            <p className="text-center py-16 text-sm text-gray-400 leading-relaxed">
              Привычек пока нет.<br />Создайте первую для отслеживания.
            </p>
          )}

          {habits?.map((habit) => {
            const done = isCompleted(habit, todayStr)
            const s = buildSummary(habit)
            const isSelected = selectedHabit?.id === habit.id

            return (
              <button
                key={habit.id}
                type="button"
                onClick={() => setSelectedHabitId(habit.id)}
                className={clsx(
                  'group w-full text-left rounded-xl border transition-all',
                  'flex items-center gap-0 pr-2 py-3 overflow-hidden',
                  isSelected
                    ? 'border-amber-300 shadow-sm bg-amber-50/30'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                )}
              >
                {/* Color accent bar */}
                <div
                  className="w-[3px] self-stretch rounded-r-full flex-shrink-0 mr-3"
                  style={{ backgroundColor: habit.color }}
                />

                {/* Text info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{habit.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                    <span>{s.currentStreak} дн. подряд</span>
                    <span className="text-gray-200">·</span>
                    <span>{s.completion30}% / мес</span>
                  </div>
                </div>

                {/* Today toggle */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggle(habit.id, todayStr) }}
                  className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ml-2 transition-all',
                    done ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                  )}
                  style={done ? { backgroundColor: habit.color } : undefined}
                  title={done ? 'Выполнено' : 'Отметить'}
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </button>

                {/* Delete (on hover) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setHabitToDelete(habit)
                    setDeleteModalOpen(true)
                  }}
                  className="opacity-0 group-hover:opacity-100 ml-1 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                  title="Удалить"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </button>
            )
          })}
        </div>

        {/* Right: selected habit details */}
        {selectedHabit ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 overflow-hidden min-h-0">

            {/* Habit header */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedHabit.color }}
              />
              <h3 className="font-semibold text-gray-900 text-base">{selectedHabit.name}</h3>
              <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
                С {format(new Date(selectedHabit.created_at), 'd MMM yyyy', { locale: ru })}
              </span>
            </div>

            {/* Stat cards */}
            {(() => {
              const s = buildSummary(selectedHabit)
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <StatCard label="За 30 дней"       value={`${s.completion30}%`}    color="amber"   />
                  <StatCard label="Всего выполнено"  value={`${s.totalAll}`}         color="emerald" />
                  <StatCard label="Текущий стрик"    value={`${s.currentStreak} дн.`} color="orange"  />
                  <StatCard label="Лучший стрик"     value={`${s.bestStreak} дн.`}   color="violet"  />
                </div>
              )
            })()}

            {/* Year heatmap */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Обзор года</p>
              <div className="flex gap-[3px] overflow-x-auto pb-1 select-none">
                {heatmapGrid.map((week, wi) => {
                  const firstDay = week.find(d => d !== null)
                  const prevFirstDay = wi > 0 ? heatmapGrid[wi - 1].find(d => d !== null) : undefined
                  const showMonth = firstDay &&
                    (!prevFirstDay || getMonth(firstDay.day) !== getMonth(prevFirstDay.day))
                  return (
                    <div key={wi} className="flex flex-col gap-[3px] flex-shrink-0">
                      <div className="h-3 text-[8px] text-gray-400 capitalize overflow-visible whitespace-nowrap">
                        {showMonth ? format(firstDay!.day, 'MMM', { locale: ru }) : ''}
                      </div>
                      {week.map((day, di) => (
                        <div
                          key={di}
                          className="w-[11px] h-[11px] rounded-[2px]"
                          style={{
                            backgroundColor:
                              day === null ? 'transparent'
                              : day.future ? (isDark ? '#293548' : '#F3F4F6')
                              : day.completed ? selectedHabit.color
                              : (isDark ? '#334155' : '#EBEBEB'),
                            opacity: day?.future ? 0.5 : 1,
                          }}
                          title={day?.date}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">

              <div className="flex flex-col min-h-0">
                <p className="text-xs font-medium text-gray-500 mb-1 flex-shrink-0">Стрики — 30 дней</p>
                <div className="flex-1 min-h-[120px] max-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={buildStreakLineData()} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 9, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        interval={4}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        minTickGap={10}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 11, borderRadius: 8,
                          backgroundColor: isDark ? '#1E293B' : '#fff',
                          border: isDark ? '1px solid #334155' : '1px solid #E5E7EB',
                          boxShadow: 'none',
                        }}
                        itemStyle={{ color: isDark ? '#F1F5F9' : '#111827' }}
                        labelStyle={{ color: isDark ? '#94A3B8' : '#6B7280' }}
                        formatter={(v: number, name: string) => [`${v} дн.`, name]}
                      />
                      {habits?.map(h => (
                        <Line
                          key={h.id}
                          type="monotone"
                          dataKey={`h_${h.id}`}
                          stroke={h.color}
                          strokeWidth={h.id === selectedHabit.id ? 2.5 : 1.5}
                          strokeOpacity={h.id === selectedHabit.id ? 1 : 0.25}
                          dot={false}
                          activeDot={h.id === selectedHabit.id ? { r: 3 } : false}
                          name={h.name}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex flex-col min-h-0">
                <p className="text-xs font-medium text-gray-500 mb-1 flex-shrink-0">Время дня</p>
                <div className="flex-1 min-h-[120px] max-h-[180px] flex items-center">
                  {buildTimeData(selectedHabit).length > 0 ? (
                    <>
                      {/* Chart with glow layers — no Legend inside so all layers align */}
                      <div className="relative flex-1 h-full min-h-[120px]">
                        {/* Wide glow */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{ filter: 'blur(20px)', opacity: isDark ? 0.85 : 0.35 }}
                          aria-hidden
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={buildTimeData(selectedHabit)} dataKey="value" nameKey="label"
                                innerRadius={40} outerRadius={65} paddingAngle={3} isAnimationActive={false} stroke="none"
                              >
                                {buildTimeData(selectedHabit).map((entry) => (
                                  <Cell key={entry.id} fill={isDark ? entry.neon : entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Tight glow */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{ filter: 'blur(6px)', opacity: isDark ? 0.6 : 0.25 }}
                          aria-hidden
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={buildTimeData(selectedHabit)} dataKey="value" nameKey="label"
                                innerRadius={40} outerRadius={65} paddingAngle={3} isAnimationActive={false} stroke="none"
                              >
                                {buildTimeData(selectedHabit).map((entry) => (
                                  <Cell key={entry.id} fill={isDark ? entry.neon : entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Main chart — no Legend, same layout as glow layers */}
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={buildTimeData(selectedHabit)}
                              dataKey="value"
                              nameKey="label"
                              innerRadius={40}
                              outerRadius={65}
                              paddingAngle={3}
                              stroke="none"
                            >
                              {buildTimeData(selectedHabit).map((entry) => (
                                <Cell key={entry.id} fill={isDark ? entry.neon : entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: number, name: string) => [`${v} раз`, name]}
                              contentStyle={{
                                fontSize: 11, borderRadius: 8,
                                backgroundColor: isDark ? '#1E293B' : '#fff',
                                border: isDark ? '1px solid #334155' : '1px solid #E5E7EB',
                                boxShadow: 'none',
                              }}
                              itemStyle={{ color: isDark ? '#F1F5F9' : '#111827' }}
                              labelStyle={{ color: isDark ? '#94A3B8' : '#6B7280' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Legend — outside the chart so it doesn't shift pie center */}
                      <div className="flex flex-col gap-1.5 pl-3 flex-shrink-0">
                        {buildTimeData(selectedHabit).map((entry) => (
                          <div key={entry.id} className="flex items-center gap-1.5">
                            <span
                              className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                              style={{ backgroundColor: isDark ? entry.neon : entry.color }}
                            />
                            <span style={{ color: isDark ? '#CBD5E1' : '#4B5563', fontSize: 10 }}>{entry.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 text-center px-4 leading-relaxed">
                      Выполните привычку несколько раз,<br />чтобы увидеть распределение.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 text-sm">
            Создайте привычку для отслеживания.
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Новая привычка">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Название"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Напр., Утренняя пробежка, Чтение…"
            required
            autoFocus
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Цвет</label>
            <div className="flex flex-wrap gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={clsx(
                    'w-8 h-8 rounded-full transition-all ring-2 ring-offset-1',
                    newColor === c ? 'ring-gray-700 scale-110' : 'ring-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit" disabled={createHabit.isPending}>Создать</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setHabitToDelete(null) }}
        title="Удаление привычки"
        message={habitToDelete
          ? `Удалить «${habitToDelete.name}»? Вся история будет безвозвратно удалена.`
          : ''}
        confirmLabel="Удалить"
        variant="danger"
        isLoading={deleteHabit.isPending}
        onConfirm={async () => {
          if (!habitToDelete) return
          await deleteHabit.mutateAsync(habitToDelete.id)
          toast.success('Привычка удалена')
          if (selectedHabitId === habitToDelete.id) setSelectedHabitId(null)
        }}
      />
    </div>
  )
}
