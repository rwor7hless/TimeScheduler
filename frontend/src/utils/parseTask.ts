import { addDays, format } from 'date-fns'

export interface ParsedTask {
  title: string
  scheduledDate: string | null  // yyyy-MM-dd
  startTime: string | null      // HH:mm
  endTime: string | null        // HH:mm
  deadline: string | null       // yyyy-MM-dd
  spans: TokenSpan[]            // character ranges in original input that were parsed
}

export interface TokenSpan {
  start: number
  end: number
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function timeStr(h: number, m: number) { return `${pad(h)}:${pad(m)}` }

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return timeStr(Math.floor(total / 60) % 24, total % 60)
}

function applyPeriod(hour: number, period?: string): number {
  if (!period) return hour
  const p = period.toLowerCase()
  if (p === 'дня' || p === 'вечера' || p === 'вечером') return hour < 12 ? hour + 12 : hour
  if (p === 'ночи') return hour >= 1 && hour <= 6 ? hour : hour < 12 ? hour + 12 : hour
  return hour  // утра/утром
}

// ─── Word-boundary note ───────────────────────────────────────────────────────
// JS \b only works for [a-zA-Z0-9_]. Cyrillic chars are \W, so \b before/after
// Cyrillic always fails. We use lookbehind/lookahead instead:
//   (?<![а-яёА-ЯЁa-zA-Z0-9]) = not preceded by letter/digit  (word start)
//   (?![а-яёА-ЯЁa-zA-Z0-9])  = not followed by letter/digit  (word end)

// ─── Weekdays ─────────────────────────────────────────────────────────────────

const WEEKDAY: Record<string, number> = {
  'понедельник': 1, 'пн': 1,
  'вторник': 2, 'вт': 2,
  'среду': 3, 'среда': 3, 'ср': 3,
  'четверг': 4, 'чт': 4,
  'пятницу': 5, 'пятница': 5, 'пт': 5,
  'субботу': 6, 'суббота': 6, 'сб': 6,
  'воскресенье': 0, 'воскресенья': 0, 'вс': 0,
}

function nextWeekday(dayName: string, today: Date): string | null {
  const target = WEEKDAY[dayName]
  if (target === undefined) return null
  const cur = today.getDay()
  let diff = target - cur
  if (diff <= 0) diff += 7
  return format(addDays(today, diff), 'yyyy-MM-dd')
}

// ─── Month names ──────────────────────────────────────────────────────────────

const MONTH: Record<string, number> = {
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
  'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
  'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
}

function dayMonthToDate(day: number, monthName: string, today: Date): string | null {
  const month = MONTH[monthName.toLowerCase()]
  if (!month) return null
  let year = today.getFullYear()
  const candidate = new Date(year, month - 1, day)
  if (candidate < today) year++
  return `${year}-${pad(month)}-${pad(day)}`
}

const DEADLINE_WEEKDAY: Record<string, number> = {
  'понедельника': 1, 'вторника': 2, 'среды': 3, 'четверга': 4,
  'пятницы': 5, 'субботы': 6, 'воскресенья': 0,
}

// ─── Span collection ─────────────────────────────────────────────────────────
// Run patterns on the original string to collect token spans (for highlighting).
// The same patterns are used for value extraction below.

const SPAN_PATTERNS: RegExp[] = [
  // 1. Duration
  /(?<![а-яёА-ЯЁa-zA-Z0-9])на\s+(?:полчаса|полчасика|час(?![а-яёА-ЯЁa-zA-Z0-9])|\d+(?:[.,]\d+)?\s*час(?:а|ов)?(?![а-яёА-ЯЁa-zA-Z0-9])|\d+\s*мин(?:уты?|ут)?(?![а-яёА-ЯЁa-zA-Z0-9]))/gi,
  // 2. Time range
  /(?<![а-яёА-ЯЁa-zA-Z0-9])с\s+\d{1,2}(?:[.:]\d{2})?\s+до\s+\d{1,2}(?:[.:]\d{2})?(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
  // 3. Deadline "до [date]"
  /(?<![а-яёА-ЯЁa-zA-Z0-9])до\s+(?:завтра|послезавтра|понедельника|вторника|среды|четверга|пятницы|субботы|воскресенья|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|\d{1,2}[./]\d{1,2}(?:[./]\d{4})?)/gi,
  // 4. Single time "в HH" / "в HH:MM" (with optional period)
  /(?<![а-яёА-ЯЁa-zA-Z0-9])в\s+\d{1,2}(?:[.:]\d{2})?\s*(?:утра|утром|дня|вечера|вечером|ночи)?(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
  // 5. Named dates
  /(?<![а-яёА-ЯЁa-zA-Z0-9])(?:сегодня|завтра|послезавтра)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
  // 6. Weekday "в X"
  /(?<![а-яёА-ЯЁa-zA-Z0-9])в\s+(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|пн|вт|ср|чт|пт|сб|вс)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
  // 7. "18 апреля"
  /(?<!\d)\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
  // 8. "18.04" / "18.04.2026"
  /(?<!\d)\d{1,2}[./]\d{1,2}(?:[./]\d{4})?(?!\d)/g,
]

function collectSpans(input: string): TokenSpan[] {
  const raw: TokenSpan[] = []
  for (const pattern of SPAN_PATTERNS) {
    // Reset lastIndex in case regex was used before (global flag)
    pattern.lastIndex = 0
    for (const m of input.matchAll(pattern)) {
      if (m.index !== undefined) raw.push({ start: m.index, end: m.index + m[0].length })
    }
  }
  // Sort and merge overlapping spans
  raw.sort((a, b) => a.start - b.start)
  const merged: TokenSpan[] = []
  for (const s of raw) {
    const last = merged[merged.length - 1]
    if (last && s.start <= last.end) { last.end = Math.max(last.end, s.end) }
    else merged.push({ ...s })
  }
  return merged
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseTaskInput(input: string, today: Date): ParsedTask {
  const spans = collectSpans(input)

  let text = input
  let scheduledDate: string | null = null
  let startTime: string | null = null
  let endTime: string | null = null
  let deadline: string | null = null
  let durationMinutes: number | null = null
  const todayStr = format(today, 'yyyy-MM-dd')

  function consume(regex: RegExp, fn: (m: RegExpMatchArray) => void): void {
    text = text.replace(regex, (...args) => {
      const groups = args.slice(1, -2) as string[]
      fn(['', ...groups] as unknown as RegExpMatchArray)
      return ' '
    })
  }

  // ── 1. Duration ────────────────────────────────────────────────────────────
  consume(
    /(?<![а-яёА-ЯЁa-zA-Z0-9])на\s+(полчаса|полчасика|час(?![а-яёА-ЯЁa-zA-Z0-9])|\d+(?:[.,]\d+)?\s*час(?:а|ов)?(?![а-яёА-ЯЁa-zA-Z0-9])|\d+\s*мин(?:уты?|ут)?(?![а-яёА-ЯЁa-zA-Z0-9]))/gi,
    ([, match]) => {
      const m = match.toLowerCase().trim()
      if (m === 'полчаса' || m === 'полчасика') { durationMinutes = 30; return }
      if (m === 'час') { durationMinutes = 60; return }
      const h = m.match(/^(\d+(?:[.,]\d+)?)\s*час/)
      if (h) { durationMinutes = Math.round(parseFloat(h[1].replace(',', '.')) * 60); return }
      const mn = m.match(/^(\d+)\s*мин/)
      if (mn) { durationMinutes = parseInt(mn[1]) }
    }
  )

  // ── 2. Time range ──────────────────────────────────────────────────────────
  consume(
    /(?<![а-яёА-ЯЁa-zA-Z0-9])с\s+(\d{1,2})(?:[.:](\d{2}))?\s+до\s+(\d{1,2})(?:[.:](\d{2}))?(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
    ([, h1, m1, h2, m2]) => {
      if (!startTime) {
        startTime = timeStr(parseInt(h1), m1 ? parseInt(m1) : 0)
        endTime   = timeStr(parseInt(h2), m2 ? parseInt(m2) : 0)
      }
    }
  )

  // ── 3. Deadline "до [date]" ────────────────────────────────────────────────
  consume(
    /(?<![а-яёА-ЯЁa-zA-Z0-9])до\s+(завтра|послезавтра|понедельника|вторника|среды|четверга|пятницы|субботы|воскресенья|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|\d{1,2}[./]\d{1,2}(?:[./]\d{4})?)/gi,
    ([, dateStr]) => {
      const s = dateStr.toLowerCase().trim()
      if (s === 'завтра') { deadline = format(addDays(today, 1), 'yyyy-MM-dd'); return }
      if (s === 'послезавтра') { deadline = format(addDays(today, 2), 'yyyy-MM-dd'); return }
      const wd = DEADLINE_WEEKDAY[s]
      if (wd !== undefined) {
        const cur = today.getDay(); let diff = wd - cur
        if (diff <= 0) diff += 7
        deadline = format(addDays(today, diff), 'yyyy-MM-dd'); return
      }
      const dm = s.match(/^(\d{1,2})\s+(\S+)$/)
      if (dm) { deadline = dayMonthToDate(parseInt(dm[1]), dm[2], today) ?? null; return }
      const num = s.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?$/)
      if (num) {
        const y = num[3] ? parseInt(num[3]) : today.getFullYear()
        deadline = `${y}-${pad(parseInt(num[2]))}-${pad(parseInt(num[1]))}`
      }
    }
  )

  // ── 4. Single time ─────────────────────────────────────────────────────────
  if (!startTime) {
    consume(
      /(?<![а-яёА-ЯЁa-zA-Z0-9])в\s+(\d{1,2})(?:[.:](\d{2}))?\s*(?:(утра|утром|дня|вечера|вечером|ночи)(?![а-яёА-ЯЁa-zA-Z0-9]))?/gi,
      ([, h, m, period]) => {
        let hour = parseInt(h)
        if (hour > 23) return
        hour = applyPeriod(hour, period)
        startTime = timeStr(hour, m ? parseInt(m) : 0)
      }
    )
  }

  if (startTime && !endTime) endTime = addMinutes(startTime, durationMinutes ?? 60)

  // ── 5. Named dates ─────────────────────────────────────────────────────────
  consume(
    /(?<![а-яёА-ЯЁa-zA-Z0-9])сегодня(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
    () => { if (!scheduledDate) scheduledDate = todayStr }
  )
  consume(
    /(?<![а-яёА-ЯЁa-zA-Z0-9])завтра(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
    () => { if (!scheduledDate) scheduledDate = format(addDays(today, 1), 'yyyy-MM-dd') }
  )
  consume(
    /(?<![а-яёА-ЯЁa-zA-Z0-9])послезавтра(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
    () => { if (!scheduledDate) scheduledDate = format(addDays(today, 2), 'yyyy-MM-dd') }
  )

  // ── 6. Weekday ─────────────────────────────────────────────────────────────
  consume(
    /(?<![а-яёА-ЯЁa-zA-Z0-9])в\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|пн|вт|ср|чт|пт|сб|вс)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
    ([, day]) => { if (!scheduledDate) scheduledDate = nextWeekday(day.toLowerCase(), today) }
  )

  // ── 7. "18 апреля" ─────────────────────────────────────────────────────────
  consume(
    /(?<!\d)(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
    ([, d, mon]) => { if (!scheduledDate) scheduledDate = dayMonthToDate(parseInt(d), mon, today) }
  )

  // ── 8. "18.04" / "18/04" / "18.04.2026" ───────────────────────────────────
  consume(
    /(?<!\d)(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?!\d)/g,
    ([, d, m, y]) => {
      if (parseInt(d) > 31 || parseInt(m) > 12) return
      if (!scheduledDate) {
        const year = y ? parseInt(y) : today.getFullYear()
        scheduledDate = `${year}-${pad(parseInt(m))}-${pad(parseInt(d))}`
      }
    }
  )

  if (startTime && !scheduledDate) scheduledDate = todayStr

  const title = text.replace(/\s{2,}/g, ' ').trim()

  return {
    title: title.length > 0 ? title : input.trim(),
    scheduledDate,
    startTime,
    endTime,
    deadline,
    spans,
  }
}

// ─── Human-readable date ──────────────────────────────────────────────────────

const MONTH_SHORT: Record<number, string> = {
  1: 'янв', 2: 'фев', 3: 'мар', 4: 'апр', 5: 'май', 6: 'июн',
  7: 'июл', 8: 'авг', 9: 'сен', 10: 'окт', 11: 'ноя', 12: 'дек',
}

export function friendlyDate(dateStr: string, todayStr: string): string {
  const tomorrow = format(addDays(new Date(todayStr), 1), 'yyyy-MM-dd')
  if (dateStr === todayStr) return 'сегодня'
  if (dateStr === tomorrow) return 'завтра'
  const [, m, d] = dateStr.split('-').map(Number)
  return `${d} ${MONTH_SHORT[m]}`
}
