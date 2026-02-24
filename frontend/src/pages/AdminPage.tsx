import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type UserResponse } from '@/api/admin'
import { useAuth } from '@/context/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import ConfirmModal from '@/components/ui/ConfirmModal'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const { user } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null)
  const qc = useQueryClient()
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.listUsers(),
  })
  const register = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      adminApi.registerUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setUsername('')
      setPassword('')
      toast.success('User registered')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail ?? 'Failed to register')
    },
  })

  const deleteUser = useMutation({
    mutationFn: (userId: number) => adminApi.deleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setDeleteTarget(null)
      toast.success('User and all their data deleted')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail ?? 'Failed to delete user')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    register.mutate({ username: username.trim(), password })
  }

  if (isLoading) return <Spinner className="mt-20" />

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Admin Panel</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Register User</h3>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="New username"
            required
            className="min-w-0 sm:min-w-[160px] flex-1"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="min-w-0 sm:min-w-[160px] flex-1"
          />
          <Button type="submit" disabled={register.isPending} className="min-h-[44px] sm:min-h-0 touch-manipulation">
            {register.isPending ? 'Creating...' : 'Register'}
          </Button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Users</h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600 text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-2 sm:pr-4">ID</th>
                <th className="py-2 pr-2 sm:pr-4">Username</th>
                <th className="py-2 pr-2 sm:pr-4">Role</th>
                <th className="py-2 pr-2 sm:pr-4 hidden sm:table-cell">Created</th>
                <th className="py-2 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: UserResponse) => (
                <tr key={u.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-2 sm:pr-4 text-gray-600 dark:text-gray-400">{u.id}</td>
                  <td className="py-2 pr-2 sm:pr-4 font-medium text-gray-900 dark:text-gray-100">{u.username}</td>
                  <td className="py-2 pr-2 sm:pr-4">
                    {u.is_admin ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Admin</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">User</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 sm:pr-4 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="py-2 text-right">
                    {u.id !== user?.user_id && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(u)}
                        disabled={deleteUser.isPending}
                        className="min-h-[36px] touch-manipulation"
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить пользователя?"
        message={
          deleteTarget
            ? `Удалить пользователя «${deleteTarget.username}»? Все его данные (задачи, привычки, доски и т.д.) будут безвозвратно удалены.`
            : ''
        }
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
        isLoading={deleteUser.isPending}
        onConfirm={async () => {
          if (deleteTarget) await deleteUser.mutateAsync(deleteTarget.id)
        }}
      />
    </div>
  )
}
