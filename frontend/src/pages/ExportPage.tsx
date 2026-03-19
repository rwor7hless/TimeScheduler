import { useState } from 'react'
import Button from '@/components/ui/Button'
import { exportApi } from '@/api/export'
import { useBoards, useTags } from '@/hooks/useTasks'
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
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [boardId, setBoardId] = useState('')
  const [tag, setTag] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)

  const { data: boards } = useBoards()
  const { data: tags } = useTags()

  const handleExport = async (
    type: 'tasks' | 'stats',
    format: 'csv' | 'json'
  ) => {
    setLoading(true)
    try {
      if (type === 'tasks') {
        const params: Record<string, string> = { format }
        if (priority) params.priority = priority
        if (status) params.status = status
        if (boardId) params.board_id = boardId
        if (tag) params.tag = tag
        if (includeArchived) params.include_archived = 'true'
        await exportApi.tasks(format, params)
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
              <p className="text-xs text-gray-500 dark:text-gray-400">С фильтрами по приоритету, статусу, доске и тегам</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700"
            >
              <option value="">Все приоритеты</option>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="urgent">Срочный</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700"
            >
              <option value="">Все статусы</option>
              <option value="todo">К выполнению</option>
              <option value="in_progress">В работе</option>
              <option value="done">Готово</option>
            </select>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700"
            >
              <option value="">Все доски</option>
              {boards?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700"
            >
              <option value="">Все теги</option>
              {tags?.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-amber-500"
            />
            Включить архивные
          </label>

          <div className="flex gap-2 mt-auto">
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
