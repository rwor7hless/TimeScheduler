import client from './client'
import type { WeeklyReport } from '@/types/report'

export interface DailyTipPersona {
  id: string
  name: string
  eyes_l: string
  eyes_r: string
}

export interface DailyTipResponse {
  date: string
  disabled?: boolean
  persona: DailyTipPersona | null
  short: string | null
  long: string | null
}

export const reportsApi = {
  list: (limit = 26): Promise<WeeklyReport[]> =>
    client.get('/reports', { params: { limit } }).then((r) => r.data),

  generate: (weekStart?: string): Promise<WeeklyReport> =>
    client
      .post('/reports/generate', null, {
        params: weekStart ? { week_start: weekStart } : undefined,
      })
      .then((r) => r.data),

  getDailyTip: (forcePersona?: string, refresh = false): Promise<DailyTipResponse> => {
    const params: Record<string, string> = {}
    if (forcePersona) params.persona = forcePersona
    if (refresh) params.refresh = '1'
    return client
      .get('/reports/daily-tip', {
        params: Object.keys(params).length > 0 ? params : undefined,
      })
      .then((r) => r.data)
  },

  requestSummary: (): Promise<WeeklyReport> =>
    client.post('/reports/request-summary').then((r) => r.data),

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
