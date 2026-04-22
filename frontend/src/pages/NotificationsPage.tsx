import { useState, useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'
import { useReports, markReportsSeen } from '@/hooks/useReports'
import { useAuth } from '@/context/AuthContext'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { ReportAccordion } from '@/components/reports/ReportAccordion'

export default function NotificationsPage() {
  const qc = useQueryClient()
  const { data: reports, isLoading } = useReports()
  const { canRequestSummary } = useAuth()

  // Сбрасываем счётчик непрочитанных при открытии страницы
  useEffect(() => {
    markReportsSeen()
  }, [])

  // reportId → накопленный текст стрима
  const [streamMap, setStreamMap] = useState<Record<number, string>>({})
  // set of currently-streaming report IDs
  const [streamingIds, setStreamingIds] = useState<Set<number>>(new Set())
  const [requestingSummary, setRequestingSummary] = useState(false)

  // Отчёты, которые мы уже начинали стримить в этой сессии — чтобы не запускать
  // их повторно из-за гонки «removed from streamingIds» ↔ «refetch ещё не дошёл».
  const startedRef = useRef<Set<number>>(new Set())

  const startStream = useCallback(
    (reportId: number) => {
      startedRef.current.add(reportId)
      setStreamingIds((s) => new Set(s).add(reportId))
      setStreamMap((m) => ({ ...m, [reportId]: '' }))

      reportsApi
        .streamReport(
          reportId,
          (chunk) => {
            setStreamMap((m) => ({ ...m, [reportId]: (m[reportId] ?? '') + chunk }))
          },
          () => {
            /* done — cleanup в finally */
          },
          (err) => {
            toast.error(`Ошибка генерации: ${err}`)
          },
        )
        .finally(() => {
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

  // Автостарт стриминга если на странице уже есть pending-отчёт (напр. от крона).
  // ВАЖНО: не трогаем отчёты, которые уже стримили — иначе после завершения
  // старый reports-кэш покажет их pending (refetch ещё не дошёл), а streamingIds
  // уже пустой, и мы запустим вторую генерацию.
  useEffect(() => {
    if (!reports) return
    const pending = reports.find(
      (r) =>
        r.status === 'pending' &&
        !streamingIds.has(r.id) &&
        !startedRef.current.has(r.id),
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">История отчётов</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Архив прошлых недель. Актуальный разбор и аналитика — на{' '}
            <a href="/stats?tab=week" className="text-amber-600 dark:text-amber-400 hover:underline">
              вкладке Статистика
            </a>
            . AI-отчёт генерируется автоматически каждое воскресенье в 21:00
            {canRequestSummary && ' · или по запросу'}.
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
          <svg
            className="w-10 h-10 mx-auto mb-3 opacity-40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p className="text-sm">Отчётов пока нет</p>
          <p className="text-xs mt-1">Первый отчёт появится в воскресенье вечером</p>
        </div>
      )}

      {!isLoading && reports && reports.length > 0 && (
        <ReportAccordion
          reports={reports}
          streamMap={streamMap}
          streamingIds={streamingIds}
        />
      )}
    </div>
  )
}
