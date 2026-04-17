import { useState, useCallback, useEffect } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'
import { useReports, markReportsSeen } from '@/hooks/useReports'
import { useAuth } from '@/context/AuthContext'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import type { WeeklyReport } from '@/types/report'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, isStreaming }: { status: string; isStreaming: boolean }) {
  if (isStreaming || status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
        Пишет…
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Генерируется…
      </span>
    )
  }
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Готово
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400">
      Ошибка
    </span>
  )
}

// ─── Streaming cursor ──────────────────────────────────────────────────────────

function StreamCursor() {
  return (
    <span className="inline-block w-0.5 h-4 bg-amber-400 animate-pulse ml-0.5 align-middle" />
  )
}

// ─── Thinking indicator (до первого токена от LLM) ────────────────────────────

const THINKING_MESSAGES = [
  'Собираю данные за неделю…',
  'Считаю закрытые задачи…',
  'Смотрю на провалы и просрочки…',
  'Анализирую привычки…',
  'Формулирую честный разбор…',
  'ИИ думает над ответом…',
]

function ThinkingIndicator() {
  const [msgIdx, setMsgIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % THINKING_MESSAGES.length)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-end gap-1 h-5">
        <span
          className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1s' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"
          style={{ animationDelay: '150ms', animationDuration: '1s' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"
          style={{ animationDelay: '300ms', animationDuration: '1s' }}
        />
      </div>
      <span
        key={msgIdx}
        className="text-sm text-gray-500 dark:text-gray-400"
      >
        {THINKING_MESSAGES[msgIdx]}
      </span>
    </div>
  )
}

// ─── Report card ──────────────────────────────────────────────────────────────

interface ReportCardProps {
  report: WeeklyReport
  streamingContent?: string
  isStreaming?: boolean
}

function ReportCard({ report, streamingContent, isStreaming }: ReportCardProps) {
  const weekStart = parseISO(report.week_start)
  const weekEnd = addDays(weekStart, 6)
  const rangeLabel = `${format(weekStart, 'd MMM', { locale: ru })} — ${format(weekEnd, 'd MMM yyyy', { locale: ru })}`

  const content = streamingContent ?? (report.status === 'done' ? report.content : null)

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Отчёт за неделю</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rangeLabel}</p>
        </div>
        <StatusBadge status={report.status} isStreaming={!!isStreaming} />
      </div>

      {/* Card body */}
      <div className="px-5 py-5">
        {/* Pending but not yet streaming */}
        {report.status === 'pending' && !content && (
          <ThinkingIndicator />
        )}

        {/* Streaming started from this tab, но первый токен ещё не пришёл */}
        {isStreaming && !content && report.status !== 'pending' && (
          <ThinkingIndicator />
        )}

        {/* In progress but not from this tab */}
        {report.status === 'in_progress' && !isStreaming && !content && (
          <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
            <Spinner className="!w-5 !h-5" />
            <span>Отчёт пишется в другой вкладке…</span>
          </div>
        )}

        {report.status === 'error' && !content && (
          <div className="text-sm text-red-500 dark:text-red-400">
            <p className="font-medium mb-1">Не удалось сгенерировать отчёт</p>
            {report.error_msg && (
              <p className="text-xs font-mono text-red-400 dark:text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                {report.error_msg}
              </p>
            )}
          </div>
        )}

        {content && (
          <div className="prose prose-sm dark:prose-invert max-w-none
            prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-gray-100
            prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2
            prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1
            prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
            prose-li:text-gray-700 dark:prose-li:text-gray-300
            prose-strong:text-gray-900 dark:prose-strong:text-gray-100
            prose-ul:my-2 prose-ol:my-2
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {content}
            </ReactMarkdown>
            {isStreaming && <StreamCursor />}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4">
        <p className="text-[11px] text-gray-300 dark:text-gray-600">
          {format(parseISO(report.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
        </p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const qc = useQueryClient()
  const { data: reports, isLoading } = useReports()
  const { canRequestSummary } = useAuth()

  // Сбрасываем счётчик непрочитанных при открытии страницы
  useEffect(() => { markReportsSeen() }, [])

  // reportId → accumulated text
  const [streamMap, setStreamMap] = useState<Record<number, string>>({})
  // set of currently-streaming report IDs
  const [streamingIds, setStreamingIds] = useState<Set<number>>(new Set())
  const [requestingSummary, setRequestingSummary] = useState(false)

  const startStream = useCallback(
    (reportId: number) => {
      setStreamingIds((s) => new Set(s).add(reportId))
      setStreamMap((m) => ({ ...m, [reportId]: '' }))

      reportsApi
        .streamReport(
          reportId,
          (chunk) => {
            setStreamMap((m) => ({ ...m, [reportId]: (m[reportId] ?? '') + chunk }))
          },
          () => { /* done — cleanup happens in finally */ },
          (err) => {
            toast.error(`Ошибка генерации: ${err}`)
          },
        )
        .finally(() => {
          // Сбрасываем кнопку и обновляем список в любом случае
          setStreamingIds((s) => {
            const next = new Set(s)
            next.delete(reportId)
            return next
          })
          qc.invalidateQueries({ queryKey: ['reports'] })
        })
    },
    [qc],
  )

  // Автостарт стриминга если на странице уже есть pending-отчёт (напр. от крона)
  useEffect(() => {
    if (!reports) return
    const pending = reports.find(
      (r) => r.status === 'pending' && !streamingIds.has(r.id),
    )
    if (pending) startStream(pending.id)
  }, [reports, streamingIds, startStream])

  const handleRequestSummary = useCallback(async () => {
    setRequestingSummary(true)
    try {
      const report = await reportsApi.requestSummary()
      qc.invalidateQueries({ queryKey: ['reports'] })
      if (report.status === 'in_progress') {
        toast('Отчёт уже пишется в другой сессии')
      } else {
        startStream(report.id)
      }
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } }
      const detail = e.response?.data?.detail ?? 'Не удалось запросить отчёт'
      toast.error(detail)
    } finally {
      setRequestingSummary(false)
    }
  }, [qc, startStream])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Уведомления</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            AI-отчёт генерируется автоматически каждое воскресенье в 21:00
            {canRequestSummary && ' · или по запросу'}
          </p>
        </div>
        {canRequestSummary && (
          <Button
            type="button"
            onClick={handleRequestSummary}
            disabled={requestingSummary || streamingIds.size > 0}
            className="whitespace-nowrap"
          >
            {requestingSummary ? 'Запрос…' : 'Сгенерировать сейчас'}
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading && <Spinner className="mt-20" />}

      {!isLoading && (!reports || reports.length === 0) && (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p className="text-sm">Отчётов пока нет</p>
          <p className="text-xs mt-1">Первый отчёт появится в воскресенье вечером</p>
        </div>
      )}

      {!isLoading && reports && reports.length > 0 && (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              streamingContent={streamMap[report.id]}
              isStreaming={streamingIds.has(report.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
