import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
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

// ─── Общие react-markdown компоненты — без секционной темизации ─────────────

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => (
    <p className="my-1.5" style={{ color: 'var(--fg-body)' }}>
      {children}
    </p>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 pl-4 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 pl-4 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => (
    <li style={{ color: 'var(--fg-body)' }}>{children}</li>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-1.5 font-semibold" style={{ color: 'var(--fg)' }}>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 font-semibold" style={{ color: 'var(--fg)' }}>
      {children}
    </h4>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="my-3 pl-3 italic"
      style={{ borderLeft: '2px solid var(--line)', color: 'var(--mid)' }}
    >
      {children}
    </blockquote>
  ),
  code: ({ className: cn, children }) => {
    if (cn) {
      // fenced code block с language-хх классом
      return (
        <code
          className={`${cn} block px-3 py-2 overflow-x-auto font-mono text-[12.5px]`}
          style={{ background: 'var(--bg-cell)', color: 'var(--fg)' }}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="px-1.5 py-[1px] font-mono text-[12.5px]"
        style={{ background: 'var(--bg-cell)', color: 'var(--fg)' }}
      >
        {children}
      </code>
    )
  },
  a: ({ children, href }) => (
    <a
      href={href}
      className="hover:underline"
      style={{ color: 'var(--accent)' }}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3" style={{ border: 0, borderTop: '1px solid var(--line)' }} />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-[13px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th
      className="px-2 py-1 text-left font-semibold"
      style={{ color: 'var(--fg)', borderBottom: '1px solid var(--line)' }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      className="px-2 py-1"
      style={{ color: 'var(--fg-body)', borderBottom: '1px solid var(--line-soft)' }}
    >
      {children}
    </td>
  ),
}

// ─── Одна секция: .kicker-заголовок + markdown-тело ─────────────────────────

function SectionBlock({
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
  return (
    <section>
      <h2 className="kicker">{heading}</h2>
      <div className="relative">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MARKDOWN_COMPONENTS}>
          {body}
        </ReactMarkdown>
        {isTail && isStreaming && <StreamCursor />}
      </div>
    </section>
  )
}

// ─── Основной компонент ────────────────────────────────────────────────────

interface Props {
  md: string
  isStreaming?: boolean
}

export function ReportContent({ md, isStreaming }: Props) {
  const { preamble, sections } = React.useMemo(() => splitSections(md), [md])

  if (!preamble && sections.length === 0) return null

  return (
    <div className="space-y-4">
      {preamble && (
        <div className="relative">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MARKDOWN_COMPONENTS}>
            {preamble}
          </ReactMarkdown>
          {isStreaming && sections.length === 0 && <StreamCursor />}
        </div>
      )}
      {sections.map((s, i) => (
        <SectionBlock
          key={`${i}-${s.heading}`}
          heading={s.heading}
          body={s.body}
          isTail={i === sections.length - 1}
          isStreaming={!!isStreaming}
        />
      ))}
    </div>
  )
}
