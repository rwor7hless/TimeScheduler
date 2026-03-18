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

export const exportApi = {
  tasks: (format: 'csv' | 'json' = 'json') =>
    api
      .get('/export/tasks', {
        params: { format },
        responseType: 'blob',
      })
      .then((r) => downloadBlob(r.data, `tasks.${format}`))
      .catch(() => toast.error('Ошибка при экспорте задач')),

  stats: (format: 'csv' | 'json' = 'json', period: 'week' | 'month' | 'year' = 'month') =>
    api
      .get('/export/stats', {
        params: { format, period },
        responseType: 'blob',
      })
      .then((r) => downloadBlob(r.data, `stats.${format}`))
      .catch(() => toast.error('Ошибка при экспорте статистики')),
}
