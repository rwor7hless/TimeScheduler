import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'

/**
 * Single-report SSE lifecycle hook.
 *
 * Responsibilities:
 *  • start() — opens the stream, accumulates chunks, writes to `content`.
 *  • Guards against double-start from effect races (previously solved in
 *    NotificationsPage via `startedRef`).
 *  • On unmount aborts the underlying fetch so switching tabs doesn't
 *    leave a zombie stream writing to stale state. Backend's
 *    asyncio.shield still commits the final row to DB.
 *  • Invalidates ['reports'] on completion so other consumers refetch.
 */
export function useReportStream(reportId: number | undefined) {
  const qc = useQueryClient()
  const [content, setContent] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-mount guard: once we've started streaming a given reportId in this
  // hook instance, we don't restart it even if a cache refetch transiently
  // shows status 'pending' again.
  const startedIdsRef = useRef<Set<number>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  // Reset local buffer when the target report changes.
  useEffect(() => {
    setContent('')
    setError(null)
    setIsStreaming(false)
  }, [reportId])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const start = useCallback(() => {
    if (reportId === undefined) return
    if (startedIdsRef.current.has(reportId)) return
    startedIdsRef.current.add(reportId)

    setContent('')
    setError(null)
    setIsStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    reportsApi
      .streamReport(
        reportId,
        (chunk) => setContent((c) => c + chunk),
        () => {
          /* done — cleanup handled in finally */
        },
        (msg) => setError(msg),
      )
      .finally(() => {
        setIsStreaming(false)
        qc.invalidateQueries({ queryKey: ['reports'] })
      })

    return () => ctrl.abort()
  }, [reportId, qc])

  const reset = useCallback(() => {
    if (reportId !== undefined) {
      startedIdsRef.current.delete(reportId)
    }
    setContent('')
    setError(null)
    setIsStreaming(false)
  }, [reportId])

  return { content, isStreaming, error, start, reset }
}
