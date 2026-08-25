import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { reportsApi } from '@/api/reports'
import { useReports } from '@/hooks/useReports'
import { useReportStream } from '@/hooks/useReportStream'
import { useAuth } from '@/context/AuthContext'
import { mondayOfTodayISO } from '@/hooks/useWeekStats'
import { ReportContent } from '@/components/reports/ReportContent'
import { ThinkingIndicator } from '@/components/reports/ThinkingIndicator'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

interface Props {
  weekStart: string
}

/**
 * Embedded weekly AI report block, driven by the current ?week= URL param.
 *
 * States (in order of handling):
 *   • no record + past week   → CTA to generate on demand
 *   • no record + current week → "появится в воскресенье" + CTA (if allowed)
 *   • pending / in_progress (mine)    → ThinkingIndicator while SSE runs
 *   • pending / in_progress (другое)  → "пишется в другой вкладке"
 *   • error                           → error card + retry
 *   • done / streaming with content   → ReportContent
 *
 * Uses `useReportStream` (single-report variant of the multi-report
 * manager that NotificationsPage still uses via ReportAccordion).
 */
export function WeekReportBody({ weekStart }: Props) {
  const qc = useQueryClient()
  const { canRequestSummary, isAdmin } = useAuth()
  const canGenerate = canRequestSummary || isAdmin
  const { data: reports, isLoading: reportsLoading } = useReports()

  const report = useMemo(
    () => reports?.find((r) => r.week_start === weekStart),
    [reports, weekStart],
  )
  const today = mondayOfTodayISO()
  const isCurrentWeek = weekStart === today
  const isPastWeek = weekStart < today

  const [requesting, setRequesting] = useState(false)
  const { content, isStreaming, error, start, reset } = useReportStream(report?.id)
  const wasStreamingRef = useRef(false)
  const glow = useAnimationControls()

  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && (content || report?.status === 'done')) {
      // Stream just finished AND we have content → one-shot accent flash on the
      // section border. A box-shadow glow is what this used to be; the spec bans them.
      glow.start({
        borderColor: ['var(--line)', 'var(--accent)', 'var(--line)'],
        transition: { duration: 0.9, ease: 'easeOut' },
      })
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming, content, report?.status, glow])

  // Auto-start stream the moment we land on a pending report.
  useEffect(() => {
    if (report?.status === 'pending') start()
  }, [report?.id, report?.status, start])

  // When the URL switches to a different week, reset our local accumulator so
  // stale content from the previous week doesn't flash in.
  useEffect(() => {
    reset()
  }, [weekStart, reset])

  const handleGenerate = useCallback(async () => {
    setRequesting(true)
    try {
      const next = isCurrentWeek
        ? await reportsApi.requestSummary()
        : await reportsApi.generate(weekStart)
      qc.invalidateQueries({ queryKey: ['reports'] })
      if (next.status === 'in_progress') {
        toast('Отчёт уже пишется в другой сессии')
      }
      // Start() will fire on next render via the effect above.
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } }
      toast.error(e.response?.data?.detail ?? 'Не удалось запросить отчёт')
    } finally {
      setRequesting(false)
    }
  }, [isCurrentWeek, weekStart, qc])

  const generatedAt = report?.created_at
    ? format(parseISO(report.created_at), 'd MMM, HH:mm', { locale: ru })
    : null

  // -- Render branches -----------------------------------------------------

  if (reportsLoading) {
    return <Spinner className="!w-6 !h-6 mt-6" />
  }

  // Streaming or done → content exists.
  const effectiveContent = content || (report?.status === 'done' ? report.content : null)

  if (effectiveContent) {
    return (
      <motion.section animate={glow} className="space-y-2 border border-line px-3 py-2">
        <SectionHeader generatedAt={generatedAt} earlyGenerated={!!isCurrentWeek && report?.status === 'done'} />
        <ReportContent md={effectiveContent} isStreaming={isStreaming} />
      </motion.section>
    )
  }

  // No content yet. Classify the empty state.
  return (
    <section className="space-y-3">
      <SectionHeader generatedAt={generatedAt} earlyGenerated={false} />
      <AnimatePresence mode="wait">
        {!report && isCurrentWeek && (
          <EmptyState
            key="current"
            icon="clock"
            title="Отчёт появится в воскресенье 21:00"
            body="AI-разбор сам соберётся по завершении недели. Можно запросить заранее — тогда разбор будет неполным."
            cta={canGenerate ? {
              label: requesting ? 'Запрос…' : 'Сгенерировать сейчас',
              onClick: handleGenerate,
              disabled: requesting,
            } : undefined}
          />
        )}

        {!report && isPastWeek && (
          <EmptyState
            key="past"
            icon="archive"
            title="За эту неделю отчёта нет"
            body="Можно попробовать сгенерировать его сейчас. LLM соберёт данные по этой неделе, если она в истории."
            cta={canGenerate ? {
              label: requesting ? 'Запрос…' : 'Попробовать сгенерировать',
              onClick: handleGenerate,
              disabled: requesting,
            } : undefined}
          />
        )}

        {report?.status === 'pending' && <ThinkingIndicator key="pending" />}

        {report?.status === 'in_progress' && !isStreaming && (
          <motion.div
            key="other-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 text-sm text-fg-mid px-4 py-6 border border-line bg-bg-cell"
          >
            <Spinner className="!w-5 !h-5" />
            <span>Отчёт пишется в другой вкладке…</span>
          </motion.div>
        )}

        {report?.status === 'in_progress' && isStreaming && <ThinkingIndicator key="streaming-wait" />}

        {(report?.status === 'error' || error) && (
          <ErrorCard
            key="error"
            message={error ?? report?.error_msg ?? 'Не удалось сгенерировать отчёт'}
            onRetry={canGenerate ? handleGenerate : undefined}
            retrying={requesting}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

function SectionHeader({
  generatedAt,
  earlyGenerated,
}: {
  generatedAt: string | null
  earlyGenerated: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-fg-body uppercase tracking-wider">
        AI-разбор недели
      </h3>
      {generatedAt && (
        <div className="flex items-center gap-2 text-[11px] text-fg-mid">
          {earlyGenerated && (
            <span className="px-1.5 py-0.5 bg-bg-sel text-accent font-medium">
              Сгенерировано досрочно
            </span>
          )}
          <span>{generatedAt}</span>
        </div>
      )}
    </div>
  )
}

interface EmptyStateProps {
  icon: 'clock' | 'archive'
  title: string
  body: string
  cta?: { label: string; onClick: () => void; disabled?: boolean }
}

function EmptyState({ icon, title, body, cta }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className=" border border-line bg-bg-cell px-5 py-8 flex flex-col items-center text-center gap-3"
    >
      <div className="text-fg-mid">
        {icon === 'clock' ? <ClockIcon /> : <ArchiveIcon />}
      </div>
      <div>
        <div className="text-base font-semibold text-fg">{title}</div>
        <div className="mt-1 text-sm text-fg-mid max-w-md">{body}</div>
      </div>
      {cta && (
        <Button type="button" onClick={cta.onClick} disabled={cta.disabled} className="mt-1">
          {cta.label}
        </Button>
      )}
    </motion.div>
  )
}

function ErrorCard({
  message,
  onRetry,
  retrying,
}: {
  message: string
  onRetry?: () => void
  retrying: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border border-danger bg-bg-cell px-5 py-5"
    >
      <p className="font-semibold text-danger">Не удалось сгенерировать отчёт</p>
      <p className="mt-1 text-xs font-mono text-danger break-all">{message}</p>
      {onRetry && (
        <Button type="button" onClick={onRetry} disabled={retrying} className="mt-3">
          {retrying ? 'Запрос…' : 'Повторить'}
        </Button>
      )}
    </motion.div>
  )
}

function ClockIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v13H3V8" />
      <rect x="1" y="3" width="22" height="5" rx="1" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  )
}
