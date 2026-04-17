import toast from 'react-hot-toast'
import api from './client'

function downloadBlob(data: Blob, filename: string) {
  const url = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function showExportError(err: unknown, fallback: string) {
  // 401 уже обрабатывает interceptor — двойного тоста не показываем
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 401) return
  toast.error(fallback)
}

export const exportApi = {
  tasks: (format: 'csv' | 'json' = 'json', params?: Record<string, string>) =>
    api
      .get('/export/tasks', {
        params: { format, ...params },
        responseType: 'blob',
      })
      .then((r) => downloadBlob(r.data, `tasks.${format}`))
      .catch((err) => showExportError(err, 'Ошибка при экспорте задач')),

  stats: (format: 'csv' | 'json' = 'json', period: 'week' | 'month' | 'year' = 'month') =>
    api
      .get('/export/stats', {
        params: { format, period },
        responseType: 'blob',
      })
      .then((r) => downloadBlob(r.data, `stats.${format}`))
      .catch((err) => showExportError(err, 'Ошибка при экспорте статистики')),
}
