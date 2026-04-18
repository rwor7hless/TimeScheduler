import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { motion } from 'framer-motion'
import { THEMES, classifySection, type SectionTheme } from './sectionStyles'
import { SectionIcon } from './ReportIcons'
import { StreamCursor } from './ThinkingIndicator'

// ─── Парсер markdown → секции по ## заголовкам ───────────────────────────────

interface ParsedSection {
  heading: string
  body: string
}

interface Parsed {
  preamble: string
  sections: ParsedSection[]
}

function splitSections(md: string): Parsed {
  // `^##\s+(.+)$` с флагом m: ровно два `#`, пробел, текст до конца строки.
  // Не матчит `### ...` — перед пробелом должен стоять именно `##`.
  const re = /^##\s+(.+)$/gm
  const matches = [...md.matchAll(re)]

  if (matches.length === 0) {
    return { preamble: md.trim(), sections: [] }
  }

  const firstIdx = matches[0].index ?? 0
  const preamble = md.slice(0, firstIdx).trim()
  const sections: ParsedSection[] = []

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const heading = (m[1] ?? '').trim()
    const bodyStart = (m.index ?? 0) + m[0].length
    const bodyEnd = i + 1 < matches.length ? (matches[i + 1].index ?? md.length) : md.length
    const body = md.slice(bodyStart, bodyEnd).trim()
    sections.push({ heading, body })
  }

  return { preamble, sections }
}

// ─── Inline SVG иконки для буллет-маркеров в теле секций ────────────────────

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3L2.5 20h19L12 3z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="17.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ─── «Карточка совета» — для нумерованного списка в секции advice ───────────

function AdviceCard({
  index,
  children,
}: {
  index: number
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/15 px-3 py-2.5 transition-colors">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white font-semibold text-[13px] flex items-center justify-center shadow-sm tabular-nums">
        {String(index).padStart(2, '0')}
      </div>
      <div className="flex-1 pt-1 text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 [&_p]:!m-0">
        {children}
      </div>
    </div>
  )
}

// ─── Кастомные react-markdown компоненты, зависящие от темы ─────────────────

function buildComponents(theme: SectionTheme): Components {
  const isAdvice = theme.key === 'advice'
  const isDone = theme.key === 'done'
  const isFails = theme.key === 'fails'

  return {
    p: ({ children }) => (
      <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 my-2 tracking-[-0.003em]">
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong className={theme.boldClass}>{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => (
      <ul className="space-y-1.5 my-3 list-none pl-0">{children}</ul>
    ),
    ol: ({ children }) => {
      if (isAdvice) {
        // Для секции «3 совета» нумерованный список превращается в карточки.
        const items = React.Children.toArray(children).filter(
          (c): c is React.ReactElement => React.isValidElement(c),
        )
        return (
          <div className="space-y-2.5 my-3">
            {items.map((item, idx) => (
              <AdviceCard key={idx} index={idx + 1}>
                {item.props.children}
              </AdviceCard>
            ))}
          </div>
        )
      }
      return (
        <ol className="list-decimal list-inside space-y-1.5 my-3 text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 marker:text-gray-400 marker:font-semibold">
          {children}
        </ol>
      )
    },
    li: ({ children }) => {
      if (isAdvice) {
        // Контент уже упакован в AdviceCard на уровне ol.
        return <li className="hidden">{children}</li>
      }
      if (isDone) {
        return (
          <li className="flex items-start gap-2">
            <span className="mt-[3px] flex-shrink-0 text-emerald-500 dark:text-emerald-400">
              <CheckIcon />
            </span>
            <span className="flex-1 text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 [&_p]:!m-0">
              {children}
            </span>
          </li>
        )
      }
      if (isFails) {
        return (
          <li className={'flex items-start gap-2 ' + theme.listRowBgClass}>
            <span className="mt-[3px] flex-shrink-0 text-rose-500 dark:text-rose-400">
              <AlertIcon />
            </span>
            <span className="flex-1 text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 [&_p]:!m-0">
              {children}
            </span>
          </li>
        )
      }
      return (
        <li className="flex items-start gap-2">
          <span
            className={`mt-[9px] flex-shrink-0 w-1.5 h-1.5 rounded-full ${theme.bulletClass}`}
          />
          <span className="flex-1 text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 [&_p]:!m-0">
            {children}
          </span>
        </li>
      )
    },
    h3: ({ children }) => (
      <h3
        className={`text-[13px] font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-1.5 pl-2 border-l-2 ${theme.h3BorderClass}`}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1">
        {children}
      </h4>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={`border-l-4 pl-3 italic text-gray-600 dark:text-gray-400 my-3 ${theme.quoteBorderClass}`}
      >
        {children}
      </blockquote>
    ),
    code: ({ className: cn, children }) => {
      if (cn) {
        // fenced code block с language-хх классом
        return (
          <code
            className={`${cn} block px-3 py-2 rounded-lg bg-gray-900 text-gray-100 text-[12.5px] font-mono overflow-x-auto`}
          >
            {children}
          </code>
        )
      }
      return (
        <code
          className={`px-1.5 py-[1px] rounded ${theme.codeClass} text-[12.5px] font-mono`}
        >
          {children}
        </code>
      )
    },
    a: ({ children, href }) => (
      <a
        href={href}
        className="text-amber-600 dark:text-amber-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="my-3 border-gray-200/70 dark:border-gray-700/50" />,
    table: ({ children }) => (
      <div className="overflow-x-auto my-3">
        <table className="w-full text-[13px] border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-2 py-1 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
        {children}
      </td>
    ),
  }
}

// Компоненты для «голой» преамбулы (без тематики — на всякий случай,
// если стрим ещё не дошёл до первого `## заголовка`).
const NEUTRAL_COMPONENTS = buildComponents(THEMES.default)

// ─── Карточка одной секции ──────────────────────────────────────────────────

function SectionCard({
  heading,
  body,
  isTail,
  isStreaming,
}: {
  heading: string
  body: string
  isTail: boolean
  isStreaming: boolean
}) {
  const theme = THEMES[classifySection(heading)]
  const components = React.useMemo(() => buildComponents(theme), [theme])

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`${theme.cardClass} px-4 sm:px-5 pt-3.5 pb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-none`}
    >
      <header className="flex items-center gap-2.5 mb-1">
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${theme.iconChipClass}`}
        >
          <SectionIcon name={theme.iconName} />
        </span>
        <h2
          className={`text-[15px] sm:text-base font-semibold tracking-tight ${theme.titleClass}`}
        >
          {heading}
        </h2>
      </header>
      <div className={`h-px w-full ${theme.underlineClass} mb-2.5`} />
      <div className="relative">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={components}
        >
          {body}
        </ReactMarkdown>
        {isTail && isStreaming && <StreamCursor />}
      </div>
    </motion.section>
  )
}

// ─── Основной компонент ────────────────────────────────────────────────────

interface Props {
  md: string
  isStreaming?: boolean
}

/**
 * Секции, которые занимают половину ширины на md+ — образуют 4 ряда:
 *   [intro | rating]
 *   [projects (full)]
 *   [done | fails]
 *   [advice | summary]
 * Порядок совпадает с порядком, который требует промпт, поэтому пары сбиваются
 * только если модель нарушит структуру — тогда один одинокий полу-блок.
 */
const HALF_WIDTH_KEYS = new Set(['intro', 'rating', 'done', 'fails', 'advice', 'summary'])

export function ReportContent({ md, isStreaming }: Props) {
  const { preamble, sections } = React.useMemo(() => splitSections(md), [md])

  if (!preamble && sections.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-auto items-start">
      {preamble && (
        <div className="relative px-1 md:col-span-2">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={NEUTRAL_COMPONENTS}
          >
            {preamble}
          </ReactMarkdown>
          {isStreaming && sections.length === 0 && <StreamCursor />}
        </div>
      )}
      {sections.map((s, i) => {
        const sectionKey = classifySection(s.heading)
        const spanClass = HALF_WIDTH_KEYS.has(sectionKey) ? '' : 'md:col-span-2'
        return (
          <div key={`${i}-${s.heading}`} className={spanClass}>
            <SectionCard
              heading={s.heading}
              body={s.body}
              isTail={i === sections.length - 1}
              isStreaming={!!isStreaming}
            />
          </div>
        )
      })}
    </div>
  )
}
