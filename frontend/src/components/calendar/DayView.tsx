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
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000

function getMoscowNow(): { minutesFromMidnight: number; dateStr: string } {
  const utc = new Date()
  const moscow = new Date(utc.getTime() + MSK_OFFSET_MS)
  const minutesFromMidnight = moscow.getUTCHours() * 60 + moscow.getUTCMinutes()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${moscow.getUTCFullYear()}-${pad(moscow.getUTCMonth() + 1)}-${pad(moscow.getUTCDate())}`
  return { minutesFromMidnight, dateStr }
}

function weekdayIndex(d: Date) {
  return (d.getDay() + 6) % 7
}

function computeOverlapLayout(tasks: Task[]): Map<number, { left: string; width: string }> {
  const result = new Map<number, { left: string; width: string }>()
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
    const colEnds: number[] = []
    const colMap = new Map<number, number>()
    for (const t of group) {
      const free = colEnds.findIndex(e => e <= t.start)
      if (free >= 0) { colMap.set(t.id, free); colEnds[free] = t.end }
      else { colMap.set(t.id, colEnds.length); colEnds.push(t.end) }
    }
    const n = colEnds.length
    for (const t of group) {
      const col = colMap.get(t.id)!
      result.set(t.id, {
        left: `calc(${(col / n) * 100}% + 2px)`,
        width: `calc(${(1 / n) * 100}% - 4px)`,
      })
    }
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
  const dragRef = useRef<DragInfo | null>(null)
  const hasMoved = useRef(false)
  const [ghost, setGhost] = useState<GhostState | null>(null)
  const [moscowNow, setMoscowNow] = useState(() => getMoscowNow())

  useEffect(() => {
    const tick = () => setMoscowNow(getMoscowNow())
    const id = setInterval(tick, 60 * 1000)
    tick()
    return () => clearInterval(id)
  }, [])

  const dayTasks = useMemo(() => {
    const wd = weekdayIndex(date)
    return tasks.filter((t) => {
      if (!t.scheduled_start) return false
      if (t.repeat_days?.length) return t.repeat_days.includes(wd)
      return isSameDay(parseISO(t.scheduled_start), date)
    })
  }, [tasks, date])

  const overlapLayout = useMemo(() => computeOverlapLayout(dayTasks), [dayTasks])

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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col min-h-0">
      <div className="flex flex-1 min-h-0">
        {/* Time column */}
        <div className="w-16 flex-shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="flex-1 min-h-0 flex items-center justify-center px-2 text-xs font-mono text-gray-400 select-none text-center"
            >
              {format(addHours(startOfDay(date), hour), 'HH:00')}
            </div>
          ))}
        </div>

        {/* Grid + tasks */}
        <div ref={gridRef} className="flex-1 relative flex flex-col min-h-0">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="flex-1 min-h-0 border-t border-gray-100 cursor-pointer hover:bg-amber-50/50 transition-colors"
              onClick={() => {
                if (ghost) return
                onSlotClick(format(addHours(startOfDay(date), hour), "yyyy-MM-dd'T'HH:mm"))
              }}
            />
          ))}

          {/* Current time line (MSK) */}
          {format(date, 'yyyy-MM-dd') === moscowNow.dateStr && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none"
              style={{
                top: `${(moscowNow.minutesFromMidnight / TOTAL_MINUTES) * 100}%`,
                height: '2px',
                backgroundColor: '#ea580c',
                boxShadow: '0 0 4px rgba(234,88,12,0.5)',
              }}
            />
          )}

          {dayTasks.map((task) => {
            const pos = getPos(task)
            if (!pos) return null
            const layout = overlapLayout.get(task.id)
            const isDragging = ghost?.task.id === task.id

            return (
              <div
                key={task.id}
                className={`absolute overflow-hidden z-10 select-none transition-opacity ${isDragging ? 'opacity-30' : ''}`}
                style={{
                  top: pos.top,
                  height: pos.height,
                  left: layout?.left ?? '2px',
                  width: layout?.width ?? 'calc(100% - 4px)',
                  minHeight: '20px',
                  cursor: onTaskMove ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => handleTaskPD(e, task)}
                onPointerMove={handleTaskPM}
                onPointerUp={handleTaskPU}
                onPointerCancel={handleTaskPC}
              >
                <TaskCard task={task} onClick={() => {}} compact className="h-full pointer-events-none" />
              </div>
            )
          })}

          {/* Drag ghost */}
          {ghost && (
            <div
              className="absolute overflow-hidden z-20 pointer-events-none"
              style={{
                top: `${(ghost.startMin / TOTAL_MINUTES) * 100}%`,
                height: `${(Math.min(ghost.durationMin, TOTAL_MINUTES - ghost.startMin) / TOTAL_MINUTES) * 100}%`,
                left: overlapLayout.get(ghost.task.id)?.left ?? '2px',
                width: overlapLayout.get(ghost.task.id)?.width ?? 'calc(100% - 4px)',
                minHeight: '20px',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
              }}
            >
              <TaskCard task={ghost.task} onClick={() => {}} compact className="h-full pointer-events-none" />
              <div className="absolute bottom-1 right-1 text-[10px] font-mono bg-black/60 text-white px-1 rounded leading-tight">
                {String(Math.floor(ghost.startMin / 60)).padStart(2, '0')}:{String(ghost.startMin % 60).padStart(2, '0')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
