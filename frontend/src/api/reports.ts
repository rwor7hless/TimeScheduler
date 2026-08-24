import client from './client'
import type { WeeklyReport } from '@/types/report'

// Backend сериализует Prisma Date как полный ISO ("2026-04-13T00:00:00.000Z").
// Фронту удобнее иметь YYYY-MM-DD: это исключает (а) рассинхронизацию
// при сравнении с локально-вычисленным `mondayOfTodayISO()` и (б) сдвиг
// на ±1 день при `parseISO` в негативных часовых поясах.
function normalizeWeekStart<T extends WeeklyReport>(rep: T): T {
  return rep.week_start && rep.week_start.length > 10
    ? { ...rep, week_start: rep.week_start.slice(0, 10) }
    : rep
}

export const reportsApi = {
  list: (limit = 26): Promise<WeeklyReport[]> =>
    client
      .get('/reports', { params: { limit } })
      .then((r) => (r.data as WeeklyReport[]).map(normalizeWeekStart)),

  generate: (weekStart?: string): Promise<WeeklyReport> =>
    client
      .post('/reports/generate', null, {
        params: weekStart ? { week_start: weekStart } : undefined,
      })
      .then((r) => normalizeWeekStart(r.data as WeeklyReport)),

  requestSummary: (): Promise<WeeklyReport> =>
    client.post('/reports/request-summary').then((r) => normalizeWeekStart(r.data as WeeklyReport)),

  /**
   * Стримит генерацию отчёта через SSE (fetch + ReadableStream).
   * Вызывает onChunk для каждого текстового чанка.
   * Вызывает onDone когда модель закончила.
   * Вызывает onError при сетевой/серверной ошибке.
   */
  streamReport: async (
    reportId: number,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (msg: string) => void,
  ): Promise<void> => {
    const token = localStorage.getItem('token')
    let response: Response
    try {
      response = await fetch(`/api/reports/${reportId}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (e) {
      onError(String(e))
      return
    }

    if (!response.ok) {
      onError(`HTTP ${response.status}`)
      return
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE: события разделены двойным переносом строки
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.startsWith('data: ') ? part.slice(6) : part
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          if (msg.t !== undefined) onChunk(msg.t as string)
          if (msg.done) onDone()
          if (msg.error) onError(msg.error as string)
        } catch {
          // неполный JSON-фрагмент — игнорируем
        }
      }
    }
  },
}
