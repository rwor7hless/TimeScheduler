import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { format, isSameDay, parseISO, startOfDay, addHours } from 'date-fns'
import type { Task } from '@/types/task'
import TaskCard from '@/components/tasks/TaskCard'

interface DayViewProps {
  date: Date
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onSlotClick: (datetime: string) => void
  onTaskMove?: (task: Task, newStart: string, newEnd: string) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const TOTAL_MINUTES = 24 * 60
const SNAP = 15
const HOUR_H_DESKTOP = 100
const HOUR_H_MOBILE = 52

function useHourHeight(): number {
  const [h, setH] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? HOUR_H_MOBILE : HOUR_H_DESKTOP,
  )
  useEffect(() => {
    const onResize = () => {
      setH(window.innerWidth < 640 ? HOUR_H_MOBILE : HOUR_H_DESKTOP)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return h
}

function getLocalNow(): { minutesFromMidnight: number; dateStr: string } {
  const now = new Date()
  const minutesFromMidnight = now.getHours() * 60 + now.getMinutes()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return { minutesFromMidnight, dateStr }
}

function weekdayIndex(d: Date) {
  return (d.getDay() + 6) % 7
}

const STACK_OFFSET = 14 // px сдвига каждой вложенной задачи

function computeOverlapLayout(tasks: Task[]): Map<number, { left: string; width: string; overlapping: boolean; zIndex: number }> {
  const result = new Map<number, { left: string; width: string; overlapping: boolean; zIndex: number }>()
  if (!tasks.length) return result

  const items = tasks.map(t => {
    const s = parseISO(t.scheduled_start!)
    const e = t.scheduled_end ? parseISO(t.scheduled_end) : addHours(s, 1)
    const sm = s.getHours() * 60 + s.getMinutes()
    const em = e.getHours() * 60 + e.getMinutes()
    return { id: t.id, start: sm, end: Math.max(em, sm + SNAP) }
  })

  items.sort((a, b) => a.start - b.start)

  const visited = new Set<number>()
  for (const item of items) {
    if (visited.has(item.id)) continue
    const group: typeof items = []
    const q = [item]
    while (q.length) {
      const cur = q.shift()!
      if (visited.has(cur.id)) continue
      visited.add(cur.id)
      group.push(cur)
      for (const o of items) {
        if (!visited.has(o.id) && o.start < cur.end && o.end > cur.start) q.push(o)
      }
    }

    if (group.length === 1) {
      result.set(group[0].id, { left: '2px', width: 'calc(100% - 4px)', overlapping: false, zIndex: 10 })
      continue
    }

    // Родительская — та, у которой наибольший охват (end - start), при равенстве — раньше начавшаяся
    group.sort((a, b) => {
      const durA = a.end - a.start
      const durB = b.end - b.start
      if (durA !== durB) return durB - durA
      return a.start - b.start
    })

    const [parent, ...children] = group
    result.set(parent.id, { left: '2px', width: 'calc(100% - 4px)', overlapping: false, zIndex: 10 })

    // Дети стакаются: каждый следующий смещён на STACK_OFFSET вправо и чуть уже, z-index растёт
    children.forEach((child, i) => {
      const offset = (i + 1) * STACK_OFFSET
      result.set(child.id, {
        left: `${offset + 2}px`,
        width: `calc(100% - ${offset + 4}px)`,
        overlapping: true,
        zIndex: 11 + i,
      })
    })
  }
  return result
}

interface DragInfo {
  task: Task
  offsetMin: number
  durationMin: number
  ghostMin: number
}

interface GhostState {
  task: Task
  startMin: number
  durationMin: number
}

export default function DayView({ date, tasks, onTaskClick, onSlotClick, onTaskMove }: DayViewProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragInfo | null>(null)
  const hasMoved = useRef(false)
  const [ghost, setGhost] = useState<GhostState | null>(null)
  const [localNow, setLocalNow] = useState(() => getLocalNow())
  const HOUR_H = useHourHeight()

  useEffect(() => {
    const tick = () => setLocalNow(getLocalNow())
    const id = setInterval(tick, 60 * 1000)
    tick()
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!scrollRef.current) return
    const now = getLocalNow()
    const dateStr = format(date, 'yyyy-MM-dd')
    const targetMin = dateStr === now.dateStr ? now.minutesFromMidnight : 9 * 60
    const targetPx = (targetMin / TOTAL_MINUTES) * HOUR_H * 24
    const containerH = scrollRef.current.clientHeight
    scrollRef.current.scrollTop = Math.max(0, targetPx - containerH / 2)
  }, [date, HOUR_H])

  const dayTasks = useMemo(() => {
    const wd = weekdayIndex(date)
    return tasks.filter((t) => {
      if (!t.scheduled_start) return false
      if (t.repeat_days?.length) return t.repeat_days.includes(wd)
      return isSameDay(parseISO(t.scheduled_start), date)
    })
  }, [tasks, date])

  const overlapLayout = useMemo(() => computeOverlapLayout(dayTasks), [dayTasks])

  // Tasks whose deadline lands on this day and that aren't already on the timeline.
  const dayDeadlines = useMemo(() => {
    const dKey = format(date, 'yyyy-MM-dd')
    return tasks.filter((t) => {
      if (!t.deadline) return false
      if (t.is_archived || t.done) return false
      if (t.deadline.slice(0, 10) !== dKey) return false
      if (t.scheduled_start && t.scheduled_start.slice(0, 10) === dKey) return false
      return true
    })
  }, [tasks, date])

  const minutesFromY = useCallback((clientY: number) => {
    if (!gridRef.current) return 0
    const r = gridRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(TOTAL_MINUTES - 1, ((clientY - r.top) / r.height) * TOTAL_MINUTES))
  }, [])

  const getPos = (task: Task) => {
    if (!task.scheduled_start) return null
    const s = parseISO(task.scheduled_start)
    const e = task.scheduled_end ? parseISO(task.scheduled_end) : addHours(s, 1)
    const sm = s.getHours() * 60 + s.getMinutes()
    const em = e.getHours() * 60 + e.getMinutes()
    const dur = Math.max((em > sm ? em : em + TOTAL_MINUTES) - sm, SNAP)
    return { top: `${(sm / TOTAL_MINUTES) * 100}%`, height: `${(Math.min(dur, TOTAL_MINUTES - sm) / TOTAL_MINUTES) * 100}%` }
  }

  const handleTaskPD = useCallback((e: React.PointerEvent, task: Task) => {
    if (!task.scheduled_start) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    hasMoved.current = false

    const s = parseISO(task.scheduled_start)
    const end = task.scheduled_end ? parseISO(task.scheduled_end) : addHours(s, 1)
    const sm = s.getHours() * 60 + s.getMinutes()
    const em = end.getHours() * 60 + end.getMinutes()
    const dur = Math.min(Math.max((em > sm ? em : em + TOTAL_MINUTES) - sm, SNAP), TOTAL_MINUTES)
    const click = minutesFromY(e.clientY)

    dragRef.current = {
      task,
      offsetMin: Math.max(0, Math.min(click - sm, dur - SNAP)),
      durationMin: dur,
      ghostMin: sm,
    }
  }, [minutesFromY])

  const handleTaskPM = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const raw = minutesFromY(e.clientY)
    const maxStart = TOTAL_MINUTES - dragRef.current.durationMin
    const snapped = Math.round((raw - dragRef.current.offsetMin) / SNAP) * SNAP
    const clamped = Math.max(0, Math.min(maxStart, snapped))
    if (clamped !== dragRef.current.ghostMin) {
      hasMoved.current = true
      dragRef.current.ghostMin = clamped
      setGhost({ task: dragRef.current.task, startMin: clamped, durationMin: dragRef.current.durationMin })
    }
  }, [minutesFromY])

  const handleTaskPU = useCallback((_e: React.PointerEvent) => {
    const state = dragRef.current
    if (!state) return
    const moved = hasMoved.current
    dragRef.current = null
    hasMoved.current = false
    setGhost(null)

    if (!moved) {
      onTaskClick(state.task)
    } else if (onTaskMove) {
      const pad = (n: number) => String(n).padStart(2, '0')
      const dateStr = format(date, 'yyyy-MM-dd')
      const endMin = Math.min(state.ghostMin + state.durationMin, TOTAL_MINUTES)
      const sh = Math.floor(state.ghostMin / 60)
      const sm = state.ghostMin % 60
      const eh = Math.floor(endMin / 60) % 24
      const em = endMin % 60
      const newStart = new Date(`${dateStr}T${pad(sh)}:${pad(sm)}:00`).toISOString()
      const newEnd = new Date(`${dateStr}T${pad(eh)}:${pad(em)}:00`).toISOString()
      onTaskMove(state.task, newStart, newEnd)
    }
  }, [date, onTaskClick, onTaskMove])

  const handleTaskPC = useCallback((_e: React.PointerEvent) => {
    dragRef.current = null
    hasMoved.current = false
    setGhost(null)
  }, [])

  return (
    <div className="bg-bg-cell border border-line overflow-hidden h-full flex flex-col min-h-0">
      {dayDeadlines.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-line bg-bg-cell flex-shrink-0">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-danger opacity-80">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 21V4l16 0-3 5 3 5H4" />
            </svg>
            Дедлайны
          </div>
          {dayDeadlines.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onTaskClick(task)}
              title={task.title}
              className="text-[11px] px-2 py-0.5 font-medium border-l-2 truncate max-w-[180px]"
              style={{
                backgroundColor: `${task.color}18`,
                borderLeftColor: task.color,
                color: task.color,
              }}
            >
              {task.title}
            </button>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex" style={{ height: `${HOUR_H * 24}px` }}>
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r border-line-soft bg-bg-raised">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: `${HOUR_H}px` }}
                className="flex items-start justify-center px-2 pt-1 text-xs font-mono text-fg-mid select-none"
              >
                {format(addHours(startOfDay(date), hour), 'HH:00')}
              </div>
            ))}
          </div>

          {/* Grid + tasks */}
          <div ref={gridRef} className="flex-1 relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: `${HOUR_H}px` }}
                className="border-t border-line-soft cursor-pointer hover:bg-bg-sel transition-colors relative"
                onClick={() => {
                  if (ghost) return
                  onSlotClick(format(addHours(startOfDay(date), hour), "yyyy-MM-dd'T'HH:mm"))
                }}
              >
                <div className="absolute inset-x-0 top-1/2 h-px bg-bg-hover opacity-40 pointer-events-none" />
              </div>
            ))}

            {format(date, 'yyyy-MM-dd') === localNow.dateStr && (() => {
              const pct = (localNow.minutesFromMidnight / TOTAL_MINUTES) * 100
              const h = Math.floor(localNow.minutesFromMidnight / 60)
              const m = localNow.minutesFromMidnight % 60
              const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
              return (
                <>
                  <div
                    className="absolute z-30 pointer-events-none"
                    style={{ top: `calc(${pct}% - 4px)`, left: '0px', width: '8px', height: '8px', backgroundColor: 'var(--red)' }}
                  />
                  <div
                    className="absolute left-0 right-0 z-30 pointer-events-none"
                    style={{ top: `calc(${pct}% - 1px)`, height: '2px', backgroundColor: 'var(--red)' }}
                  />
                  <div
                    className="absolute z-30 pointer-events-none right-1 -translate-y-1/2 text-[10px] font-mono text-danger bg-bg-hover px-1 border border-danger"
                    style={{ top: `calc(${pct}% - 1px)` }}
                  >
                    {label}
                  </div>
                </>
              )
            })()}

            {dayTasks.map((task) => {
              const pos = getPos(task)
              if (!pos) return null
              const layout = overlapLayout.get(task.id)
              const isDragging = ghost?.task.id === task.id

              return (
                <div
                  key={task.id}
                  className={`absolute overflow-hidden select-none transition-opacity ${isDragging ? 'opacity-30' : ''}`}
                  style={{
                    top: pos.top,
                    height: pos.height,
                    left: layout?.left ?? '2px',
                    width: layout?.width ?? 'calc(100% - 4px)',
                    minHeight: '20px',
                    zIndex: layout?.zIndex ?? 10,
                    cursor: onTaskMove ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                    touchAction: 'none',
                  }}
                  onPointerDown={(e) => handleTaskPD(e, task)}
                  onPointerMove={handleTaskPM}
                  onPointerUp={handleTaskPU}
                  onPointerCancel={handleTaskPC}
                >
                  <TaskCard task={task} onClick={() => {}} compact overlapping={layout?.overlapping ?? false} className="h-full pointer-events-none" />
                </div>
              )
            })}

            {ghost && (
              <div
                className="absolute overflow-hidden z-20 pointer-events-none"
                style={{
                  top: `${(ghost.startMin / TOTAL_MINUTES) * 100}%`,
                  height: `${(Math.min(ghost.durationMin, TOTAL_MINUTES - ghost.startMin) / TOTAL_MINUTES) * 100}%`,
                  left: overlapLayout.get(ghost.task.id)?.left ?? '2px',
                  width: overlapLayout.get(ghost.task.id)?.width ?? 'calc(100% - 4px)',
                  minHeight: '20px',
                  filter: 'drop-(0 4px 12px rgba(0,0,0,0.25))',
                }}
              >
                <TaskCard task={ghost.task} onClick={() => {}} compact className="h-full pointer-events-none" />
                <div className="absolute bottom-1 right-1 text-[10px] font-mono bg-bg text-bg px-1 leading-tight">
                  {String(Math.floor(ghost.startMin / 60)).padStart(2, '0')}:{String(ghost.startMin % 60).padStart(2, '0')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
