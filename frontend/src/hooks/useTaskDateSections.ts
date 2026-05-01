import { useMemo } from 'react'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Task } from '@/types/task'

export type DateSectionKey = number | 'later' | 'noDate'

function getTaskDateOnly(task: Task): string | null {
  if (task.scheduled_start) return task.scheduled_start.slice(0, 10)
  if (task.deadline) return task.deadline.slice(0, 10)
  return null
}

function getDateSectionKey(task: Task, todayStr: string): DateSectionKey | null {
  const taskDate = getTaskDateOnly(task)
  if (!taskDate) return 'noDate'
  if (taskDate <= todayStr) return null
  const diffDays = differenceInCalendarDays(parseISO(taskDate), parseISO(todayStr))
  if (diffDays > 30) return 'later'
  return diffDays
}

function getDateSectionLabel(key: DateSectionKey, today: Date): string {
  if (key === 'later') return 'Позднее'
  if (key === 'noDate') return 'Отложенное'
  if (key === 1) return 'Завтра'
  if (key === 2) return 'Послезавтра'
  if (key === 3) return 'Через 3 дня'
  if (typeof key === 'number') {
    return format(addDays(today, key), 'd MMMM', { locale: ru })
  }
  return ''
}

export interface DateSection {
  key: DateSectionKey
  label: string
  tasks: Task[]
}

export interface TaskDateBuckets {
  /** Tasks with deadline strictly before today (excluding done/archived/recurring). */
  overdue: Task[]
  /** Tasks scheduled today, deadline today, or pinned to my_day. */
  today: Task[]
  /** Future-dated tasks grouped into sections (Завтра, Через N, Позднее, Отложенное). */
  sections: DateSection[]
}

/**
 * Returns the today/overdue/future bucketing used by both `/today` and `/tasks`.
 * Pure with respect to its inputs.
 */
export function useTaskDateSections(
  tasks: Task[] | undefined,
  todayStr: string,
): TaskDateBuckets {
  return useMemo(() => {
    if (!tasks) return { overdue: [], today: [], sections: [] }
    const today = parseISO(todayStr)

    const overdue: Task[] = []
    const todayBucket: Task[] = []
    const futureBuckets = new Map<DateSectionKey, Task[]>()

    for (const task of tasks) {
      if (task.is_archived) continue
      if (task.done) continue
      if (task.repeat_days && task.repeat_days.length > 0) continue

      // Overdue — deadline strictly before today.
      if (task.deadline != null && task.deadline.slice(0, 10) < todayStr) {
        overdue.push(task)
        continue
      }

      // Today — scheduled today, deadline today, or pinned to my_day.
      const ts = task.scheduled_start?.slice(0, 10)
      const td = task.deadline?.slice(0, 10)
      if (ts === todayStr || td === todayStr || task.my_day) {
        todayBucket.push(task)
        continue
      }

      const key = getDateSectionKey(task, todayStr)
      if (key === null) continue
      const arr = futureBuckets.get(key)
      if (arr) arr.push(task)
      else futureBuckets.set(key, [task])
    }

    for (const arr of futureBuckets.values()) {
      arr.sort((a, b) => {
        const aD = getTaskDateOnly(a) ?? ''
        const bD = getTaskDateOnly(b) ?? ''
        if (aD !== bD) return aD < bD ? -1 : 1
        const aT = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity
        const bT = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity
        if (aT !== bT) return aT - bT
        return a.title.localeCompare(b.title, 'ru')
      })
    }

    overdue.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

    const sections: DateSection[] = []
    for (let i = 1; i <= 30; i++) {
      const arr = futureBuckets.get(i)
      if (arr && arr.length > 0) {
        sections.push({ key: i, label: getDateSectionLabel(i, today), tasks: arr })
      }
    }
    const later = futureBuckets.get('later')
    if (later && later.length > 0) {
      sections.push({ key: 'later', label: getDateSectionLabel('later', today), tasks: later })
    }
    const noDate = futureBuckets.get('noDate')
    if (noDate && noDate.length > 0) {
      sections.push({ key: 'noDate', label: getDateSectionLabel('noDate', today), tasks: noDate })
    }

    return { overdue, today: todayBucket, sections }
  }, [tasks, todayStr])
}
