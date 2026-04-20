import { addDays, format } from 'date-fns'
import type { ExpenseCategoryId } from '@/types/budget'

export interface ParsedBudget {
  amount: number | null
  type: 'expense' | 'income'
  category: ExpenseCategoryId | null
  date: string | null           // yyyy-MM-dd, null → today
  description: string
  tagNames: string[]            // raw tag names without the "#" prefix
  spans: TokenSpan[]            // char ranges of parsed tokens, for highlighting
}

export interface TokenSpan {
  start: number
  end: number
}

function pad(n: number) { return String(n).padStart(2, '0') }

// ── Category keyword dictionary ─────────────────────────────────────────────
// Matched as whole words (Cyrillic-aware). Order matters within a list — longer
// keywords come first to avoid partial matches.

const CATEGORY_KEYWORDS: { id: ExpenseCategoryId; words: string[] }[] = [
  { id: 'food',          words: ['продукты', 'пятёрочка', 'пятерочка', 'перекрёсток', 'перекресток', 'вкусвилл', 'магнит', 'ашан', 'метро', 'доставка', 'ресторан', 'кафе', 'бар', 'кофе', 'обед', 'ужин', 'завтрак', 'еда', 'пиво', 'пицца', 'суши'] },
  { id: 'transport',     words: ['транспорт', 'автобус', 'троллейбус', 'трамвай', 'маршрутка', 'заправка', 'бензин', 'парковка', 'такси', 'убер', 'uber', 'bolt', 'яндекс', 'метро', 'проезд'] },
  { id: 'housing',       words: ['аренда', 'квартира', 'коммуналка', 'коммунал', 'жкх', 'электричество', 'интернет', 'связь', 'жильё', 'жилье', 'мтс', 'билайн', 'мегафон', 'теле2'] },
  { id: 'health',        words: ['здоровье', 'лекарства', 'аптека', 'стоматолог', 'клиника', 'анализы', 'анализ', 'врач', 'больница', 'витамины'] },
  { id: 'entertainment', words: ['развлечения', 'кинотеатр', 'концерт', 'театр', 'клуб', 'кино', 'игра', 'игры', 'досуг', 'boardgame'] },
  { id: 'clothing',      words: ['одежда', 'обувь', 'куртка', 'кроссовки', 'футболка', 'джинсы', 'рубашка'] },
  { id: 'tech',          words: ['техника', 'ноутбук', 'ноут', 'телефон', 'монитор', 'наушники', 'гаджет', 'железо', 'компьютер', 'клавиатура', 'мышка'] },
  { id: 'education',     words: ['образование', 'курсы', 'курс', 'учёба', 'учеба', 'книги', 'книга', 'учебник', 'репетитор'] },
  { id: 'travel',        words: ['путешествия', 'путешествие', 'гостиница', 'отель', 'airbnb', 'хостел', 'билет', 'билеты', 'трип', 'поездка'] },
  { id: 'subscriptions', words: ['подписки', 'подписка', 'netflix', 'spotify', 'youtube', 'premium', 'plus', 'apple', 'icloud', 'google'] },
]

// Income triggers (prefix + keyword list)
const INCOME_WORDS = ['доход', 'доходы', 'зарплата', 'зп', 'аванс', 'пришло', 'получил', 'получила', 'кешбэк', 'кешбек', 'cashback', 'премия', 'дивиденды', 'перевод']

// Month names (shared with task parser for consistency)
const MONTH: Record<string, number> = {
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
  'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
  'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
}

// Weekdays — budget entries look BACK, so we resolve to the most recent past day
const PAST_WEEKDAY: Record<string, number> = {
  'понедельник': 1, 'пн': 1,
  'вторник': 2, 'вт': 2,
  'среду': 3, 'среда': 3, 'ср': 3,
  'четверг': 4, 'чт': 4,
  'пятницу': 5, 'пятница': 5, 'пт': 5,
  'субботу': 6, 'суббота': 6, 'сб': 6,
  'воскресенье': 0, 'воскресенья': 0, 'вс': 0,
}

function lastWeekday(dayName: string, today: Date): string | null {
  const target = PAST_WEEKDAY[dayName.toLowerCase()]
  if (target === undefined) return null
  const cur = today.getDay()
  let diff = target - cur
  if (diff >= 0) diff -= 7
  return format(addDays(today, diff), 'yyyy-MM-dd')
}

// ── Span collection ────────────────────────────────────────────────────────
// Separate list so parser can rebuild spans before mutating `text`.

const SPAN_PATTERNS: RegExp[] = [
  /(?<![а-яёА-ЯЁa-zA-Z0-9])(?:сегодня|вчера|позавчера)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
  /(?<![а-яёА-ЯЁa-zA-Z0-9])в\s+(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|пн|вт|ср|чт|пт|сб|вс)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
  /(?<!\d)\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
  /(?<!\d)\d{1,2}[./]\d{1,2}(?:[./]\d{4})?(?!\d)/g,
  /#[\wа-яёА-ЯЁ0-9_-]+/gi,
  /(?<![а-яёА-ЯЁa-zA-Z0-9])\+(?=\s*\d)/g,  // leading "+" income marker
]

function collectSpans(input: string, categoryHits: TokenSpan[], amountSpan: TokenSpan | null, incomeKeywordSpans: TokenSpan[]): TokenSpan[] {
  const raw: TokenSpan[] = [...categoryHits, ...incomeKeywordSpans]
  if (amountSpan) raw.push(amountSpan)
  for (const pattern of SPAN_PATTERNS) {
    pattern.lastIndex = 0
    for (const m of input.matchAll(pattern)) {
      if (m.index !== undefined) raw.push({ start: m.index, end: m.index + m[0].length })
    }
  }
  raw.sort((a, b) => a.start - b.start)
  const merged: TokenSpan[] = []
  for (const s of raw) {
    const last = merged[merged.length - 1]
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end)
    else merged.push({ ...s })
  }
  return merged
}

// ── Small extractors ───────────────────────────────────────────────────────

function findAmount(input: string): { value: number; span: TokenSpan } | null {
  // Match a number, allowing space as thousand separator: "1 500", "1 500.50", "350,50"
  const re = /(?<![\d.,])(\d{1,3}(?:\s\d{3})*|\d+)(?:[.,](\d{1,2}))?(?![\d])/
  const m = re.exec(input)
  if (!m) return null
  const intPart = m[1].replace(/\s/g, '')
  const decPart = m[2] ?? ''
  const value = parseFloat(`${intPart}${decPart ? '.' + decPart : ''}`)
  if (isNaN(value) || value <= 0) return null
  return { value, span: { start: m.index, end: m.index + m[0].length } }
}

function findCategory(input: string): { id: ExpenseCategoryId; spans: TokenSpan[] } | null {
  const lower = input.toLowerCase()
  for (const { id, words } of CATEGORY_KEYWORDS) {
    for (const word of words) {
      // Cyrillic-safe word boundary
      const re = new RegExp(`(?<![а-яёА-ЯЁa-zA-Z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![а-яёА-ЯЁa-zA-Z0-9])`, 'gi')
      const match = re.exec(lower)
      if (match) {
        return {
          id,
          spans: [{ start: match.index, end: match.index + match[0].length }],
        }
      }
    }
  }
  return null
}

function findIncomeKeyword(input: string): TokenSpan | null {
  const lower = input.toLowerCase()
  for (const word of INCOME_WORDS) {
    const re = new RegExp(`(?<![а-яёА-ЯЁa-zA-Z0-9])${word}(?![а-яёА-ЯЁa-zA-Z0-9])`, 'gi')
    const m = re.exec(lower)
    if (m) return { start: m.index, end: m.index + m[0].length }
  }
  return null
}

// ── Main parser ────────────────────────────────────────────────────────────

export function parseBudgetInput(input: string, today: Date): ParsedBudget {
  // 1. Amount
  const amountMatch = findAmount(input)
  const amount = amountMatch?.value ?? null
  const amountSpan = amountMatch?.span ?? null

  // 2. Income detection (+ prefix OR keyword)
  const plusMatch = /(?<![а-яёА-ЯЁa-zA-Z0-9])\+(?=\s*\d)/.exec(input)
  const incomeKeyword = findIncomeKeyword(input)
  const type: 'expense' | 'income' = plusMatch || incomeKeyword ? 'income' : 'expense'

  // 3. Category (only for expenses)
  const catMatch = type === 'expense' ? findCategory(input) : null
  const category = catMatch?.id ?? null
  const categorySpans = catMatch?.spans ?? []

  // 4. Date, tags, description
  let text = input
  let date: string | null = null
  const tagNames: string[] = []

  function consume(regex: RegExp, fn: (m: RegExpMatchArray) => void): void {
    text = text.replace(regex, (...args) => {
      const match = args[0] as string
      const groups = args.slice(1, -2) as string[]
      fn([match, ...groups] as unknown as RegExpMatchArray)
      return ' '
    })
  }

  // Tags
  consume(/#([\wа-яёА-ЯЁ0-9_-]+)/gi, ([, name]) => {
    if (name) tagNames.push(name)
  })

  // Named dates
  consume(/(?<![а-яёА-ЯЁa-zA-Z0-9])сегодня(?![а-яёА-ЯЁa-zA-Z0-9])/gi, () => {
    if (!date) date = format(today, 'yyyy-MM-dd')
  })
  consume(/(?<![а-яёА-ЯЁa-zA-Z0-9])вчера(?![а-яёА-ЯЁa-zA-Z0-9])/gi, () => {
    if (!date) date = format(addDays(today, -1), 'yyyy-MM-dd')
  })
  consume(/(?<![а-яёА-ЯЁa-zA-Z0-9])позавчера(?![а-яёА-ЯЁa-zA-Z0-9])/gi, () => {
    if (!date) date = format(addDays(today, -2), 'yyyy-MM-dd')
  })

  // Weekday → last occurrence
  consume(
    /(?<![а-яёА-ЯЁa-zA-Z0-9])в\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|пн|вт|ср|чт|пт|сб|вс)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
    ([, day]) => { if (!date) date = lastWeekday(day, today) },
  )

  // "18 апреля"
  consume(
    /(?<!\d)(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?![а-яёА-ЯЁa-zA-Z0-9])/gi,
    ([, d, mon]) => {
      const month = MONTH[mon.toLowerCase()]
      if (!month) return
      const day = parseInt(d)
      if (!date) {
        let year = today.getFullYear()
        const candidate = new Date(year, month - 1, day)
        if (candidate > today) year--
        date = `${year}-${pad(month)}-${pad(day)}`
      }
    },
  )

  // "18.04" / "18/04" / "18.04.2026"
  consume(
    /(?<!\d)(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?!\d)/g,
    ([, d, m, y]) => {
      const day = parseInt(d); const mon = parseInt(m)
      if (day < 1 || day > 31 || mon < 1 || mon > 12) return
      if (!date) {
        const year = y ? parseInt(y) : today.getFullYear()
        date = `${year}-${pad(mon)}-${pad(day)}`
      }
    },
  )

  // Strip amount & "+" marker from description; keep income keywords & category
  // words intact because they double as meaningful labels ("зарплата", "кафе").
  if (amountSpan) {
    text = text.slice(0, amountSpan.start) + ' ' + text.slice(amountSpan.end)
  }
  if (plusMatch) {
    text = text.slice(0, plusMatch.index) + ' ' + text.slice(plusMatch.index + 1)
  }

  const description = text.replace(/\s{2,}/g, ' ').trim()

  // Collect all spans for the transparent-input highlight
  const spans = collectSpans(
    input,
    categorySpans,
    amountSpan,
    incomeKeyword ? [incomeKeyword] : (plusMatch ? [{ start: plusMatch.index, end: plusMatch.index + 1 }] : []),
  )

  return {
    amount,
    type,
    category,
    date,
    description,
    tagNames,
    spans,
  }
}

// ── Helper: render parsed input as highlighted segments ────────────────────

export function buildBudgetSegments(text: string, spans: TokenSpan[]) {
  if (!text || spans.length === 0) return [{ text, highlighted: false }]
  const segs: { text: string; highlighted: boolean }[] = []
  let pos = 0
  for (const span of spans) {
    if (span.start > pos) segs.push({ text: text.slice(pos, span.start), highlighted: false })
    if (span.end > span.start) segs.push({ text: text.slice(span.start, span.end), highlighted: true })
    pos = span.end
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), highlighted: false })
  return segs
}
