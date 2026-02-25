import { useState } from 'react'
import Button from '@/components/ui/Button'
import { exportApi } from '@/api/export'
import toast from 'react-hot-toast'

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const TasksIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
)

const ChartIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

export default function ExportPage() {
  const [loading, setLoading] = useState(false)

  const handleExport = async (
    type: 'tasks' | 'stats',
    format: 'csv' | 'json'
  ) => {
    setLoading(true)
    try {
      if (type === 'tasks') {
        await exportApi.tasks(format)
      } else {
        await exportApi.stats(format)
      }
      toast.success(`${type === 'tasks' ? 'Задачи' : 'Статистика'} экспортированы в ${format.toUpperCase()}`)
    } catch {
      toast.error('Ошибка экспорта')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="text-gray-400">
          <DownloadIcon />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Экспорт данных</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <TasksIcon />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Задачи</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Все задачи с приоритетами и тегами</p>
            </div>
          </div>
          <div className="flex gap-2 mt-auto pt-4">
            <Button
              variant="secondary"
              onClick={() => handleExport('tasks', 'json')}
              disabled={loading}
              className="flex-1"
            >
              JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExport('tasks', 'csv')}
              disabled={loading}
              className="flex-1"
            >
              CSV
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ChartIcon />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Статистика</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Метрики продуктивности и аналитика</p>
            </div>
          </div>
          <div className="flex gap-2 mt-auto pt-4">
            <Button
              variant="secondary"
              onClick={() => handleExport('stats', 'json')}
              disabled={loading}
              className="flex-1"
            >
              JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExport('stats', 'csv')}
              disabled={loading}
              className="flex-1"
            >
              CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
