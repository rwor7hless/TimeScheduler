import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format, parseISO, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import Spinner from '@/components/ui/Spinner'
import type { WeeklyReport } from '@/types/report'
import { ReportStatusBadge } from './ReportStatusBadge'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ReportContent } from './ReportContent'

// ─── Один элемент аккордеона ────────────────────────────────────────────────

interface ItemProps {
  report: WeeklyReport
  isOpen: boolean
  streamingContent?: string
  isStreaming: boolean
  onToggle: () => void
}

function statusDotClass(status: string, isStreaming: boolean): string {
  if (isStreaming || status === 'in_progress')
    return 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.6)] animate-pulse'
  if (status === 'pending')
    return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)] animate-pulse'
  if (status === 'done') return 'bg-emerald-400'
  return 'bg-rose-400'
}

function ChevronDown({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function ReportItem({
  report,
  isOpen,
  streamingContent,
  isStreaming,
  onToggle,
}: ItemProps) {
  const weekStart = parseISO(report.week_start)
  const weekEnd = addDays(weekStart, 6)
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
  const rangeLabel = sameMonth
    ? `${format(weekStart, 'd', { locale: ru })}–${format(weekEnd, 'd MMM yyyy', { locale: ru })}`
    : `${format(weekStart, 'd MMM', { locale: ru })} — ${format(weekEnd, 'd MMM yyyy', { locale: ru })}`

  const generatedAt = format(parseISO(report.created_at), 'd MMM, HH:mm', { locale: ru })
  const content =
    streamingContent ?? (report.status === 'done' ? report.content : null)

  return (
    <li className="rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm overflow-hidden transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-gray-50/70 dark:hover:bg-gray-800/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 rounded-2xl"
      >
        <span
          className={`flex-shrink-0 w-2 h-2 rounded-full ${statusDotClass(report.status, isStreaming)}`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
            Отчёт за неделю
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {rangeLabel}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">
            Сгенерирован {generatedAt}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <ReportStatusBadge status={report.status} isStreaming={isStreaming} />
          <ChevronDown isOpen={isOpen} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-gray-100 dark:border-gray-700/60 px-3 sm:px-4 py-4 bg-gradient-to-b from-transparent to-gray-50/30 dark:to-gray-900/20">
              {/* Pending, стрим ещё не начался */}
              {report.status === 'pending' && !content && <ThinkingIndicator />}

              {/* Стрим идёт в этой вкладке, но первый токен ещё не пришёл */}
              {isStreaming && !content && report.status !== 'pending' && (
                <ThinkingIndicator />
              )}

              {/* Чужая вкладка уже генерирует */}
              {report.status === 'in_progress' && !isStreaming && !content && (
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 px-2 py-4">
                  <Spinner className="!w-5 !h-5" />
                  <span>Отчёт пишется в другой вкладке…</span>
                </div>
              )}

              {/* Ошибка без контента */}
              {report.status === 'error' && !content && (
                <div className="text-sm px-2 py-2">
                  <p className="font-medium text-rose-600 dark:text-rose-400 mb-1">
                    Не удалось сгенерировать отчёт
                  </p>
                  {report.error_msg && (
                    <p className="text-xs font-mono text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2 border border-rose-100 dark:border-rose-900/40">
                      {report.error_msg}
                    </p>
                  )}
                </div>
              )}

              {/* Финальный/стримящийся контент */}
              {content && (
                <ReportContent md={content} isStreaming={isStreaming} />
              )}

              {/* Футер — время создания, для свёрнутого режима сюда точно не заглянут */}
              <p className="mt-4 text-[11px] text-gray-300 dark:text-gray-600 px-1">
                Создан {generatedAt}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

// ─── Главный компонент ─────────────────────────────────────────────────────

interface Props {
  reports: WeeklyReport[]
  streamMap: Record<number, string>
  streamingIds: Set<number>
}

export function ReportAccordion({ reports, streamMap, streamingIds }: Props) {
  // null = все свёрнуты; пользователь контролирует.
  const [openId, setOpenId] = useState<number | null>(null)

  // Первое появление отчётов: раскрываем самый свежий РОВНО один раз.
  // После этого — никаких «автоматически откроем» при сворачивании.
  const didInitialOpenRef = useRef(false)
  useEffect(() => {
    if (didInitialOpenRef.current) return
    if (!reports || reports.length === 0) return
    didInitialOpenRef.current = true
    setOpenId(reports[0].id)
  }, [reports])

  // Когда стартует стрим — раскрываем этот отчёт (пользователь обычно сам нажал
  // «Сгенерировать» или дожидается кронового pending, и ему хочется видеть процесс).
  // Эффект срабатывает ТОЛЬКО на добавление нового streaming-id, а не на каждый
  // ререндер с тем же id — поэтому, если пользователь закроет отчёт во время
  // стрима, повторно мы его не раскроем.
  useEffect(() => {
    if (streamingIds.size === 0) return
    const firstStreamingId = Array.from(streamingIds)[0]
    setOpenId(firstStreamingId)
  }, [streamingIds])

  return (
    <ul className="space-y-3 list-none pl-0">
      {reports.map((report) => (
        <ReportItem
          key={report.id}
          report={report}
          isOpen={openId === report.id}
          streamingContent={streamMap[report.id]}
          isStreaming={streamingIds.has(report.id)}
          onToggle={() =>
            setOpenId((prev) => (prev === report.id ? null : report.id))
          }
        />
      ))}
    </ul>
  )
}
