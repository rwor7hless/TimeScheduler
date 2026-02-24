import api from './client'

export const exportApi = {
  tasks: (format: 'csv' | 'json' = 'json') =>
    api.get('/export/tasks', {
      params: { format },
      responseType: 'blob',
    }).then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `tasks.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    }),

  stats: (format: 'csv' | 'json' = 'json', period: 'week' | 'month' | 'year' = 'month') =>
    api.get('/export/stats', {
      params: { format, period },
      responseType: 'blob',
    }).then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `stats.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    }),
}
