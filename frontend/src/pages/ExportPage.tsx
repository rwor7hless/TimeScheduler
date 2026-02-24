import { useState } from 'react'
import Button from '@/components/ui/Button'
import { exportApi } from '@/api/export'
import toast from 'react-hot-toast'

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
      toast.success(`${type} exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tasks export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-medium text-gray-900 mb-2">Tasks</h3>
          <p className="text-sm text-gray-500 mb-4">
            Export all tasks with their details, priorities, and tags.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => handleExport('tasks', 'json')}
              disabled={loading}
            >
              JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExport('tasks', 'csv')}
              disabled={loading}
            >
              CSV
            </Button>
          </div>
        </div>

        {/* Stats export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-medium text-gray-900 mb-2">Statistics</h3>
          <p className="text-sm text-gray-500 mb-4">
            Export aggregated statistics and productivity metrics.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => handleExport('stats', 'json')}
              disabled={loading}
            >
              JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExport('stats', 'csv')}
              disabled={loading}
            >
              CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
