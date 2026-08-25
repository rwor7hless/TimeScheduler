import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type UserResponse, type UserUpdate } from '@/api/admin'
import { backupApi } from '@/api/backup'
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
  const [togglingId, setTogglingId] = useState<number | null>(null)
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

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) =>
      adminApi.updateUser(id, data),
    onMutate: ({ id }) => setTogglingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Обновлено')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail ?? 'Не удалось обновить')
    },
    onSettled: () => setTogglingId(null),
  })

  const triggerS3Backup = useMutation({
    mutationFn: () => backupApi.triggerS3(),
    onSuccess: (res) => {
      const mb = (res.size / (1024 * 1024)).toFixed(2)
      toast.success(`Бэкап загружен: ${res.key} (${mb} MB, ${Math.round(res.durationMs / 1000)} с)`)
    },
    onError: (err: { response?: { data?: { detail?: string; message?: string } } }) => {
      toast.error(
        err.response?.data?.detail ?? err.response?.data?.message ?? 'Не удалось сделать бэкап',
      )
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
      <h2 className="text-lg font-semibold text-fg">Admin Panel</h2>

      <div className="bg-bg-cell border border-line p-4">
        <h3 className="text-sm font-medium text-fg-body mb-1">Бэкап БД → S3</h3>
        <p className="text-xs text-fg-mid mb-3">
          Принудительный запуск pg_dump → Cloud.ru S3. Авто-крон работает ежедневно в 03:00 МСК.
        </p>
        <Button
          type="button"
          onClick={() => triggerS3Backup.mutate()}
          disabled={triggerS3Backup.isPending}
          className="min-h-0 touch-manipulation"
        >
          {triggerS3Backup.isPending ? 'Бэкап выполняется…' : 'Сделать бэкап сейчас'}
        </Button>
      </div>

      <div className="bg-bg-cell border border-line p-4">
        <h3 className="text-sm font-medium text-fg-body mb-3">Register User</h3>
        <form onSubmit={handleSubmit} className="flex flex-row flex-wrap gap-3 items-end">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="New username"
            required
            className="min-w-[160px] flex-1"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="min-w-[160px] flex-1"
          />
          <Button type="submit" disabled={register.isPending} className="min-h-0 touch-manipulation">
            {register.isPending ? 'Creating...' : 'Register'}
          </Button>
        </form>
      </div>

      <div className="bg-bg-cell border border-line p-4">
        <h3 className="text-sm font-medium text-fg-body mb-3">Users</h3>
        <div className="overflow-x-auto mx-0">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="border-b border-line text-left text-fg-mid">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Username</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Саммари</th>
                <th className="py-2 pr-4 table-cell">Created</th>
                <th className="py-2 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: UserResponse) => {
                const isSelfAdmin = u.is_admin
                const checked = isSelfAdmin || u.can_request_summary
                const disabled = isSelfAdmin || togglingId === u.id
                return (
                  <tr key={u.id} className="border-b border-line-soft">
                    <td className="py-2 pr-4 text-fg-body">{u.id}</td>
                    <td className="py-2 pr-4 font-medium text-fg">{u.username}</td>
                    <td className="py-2 pr-4">
                      {u.is_admin ? (
                        <span className="text-accent font-medium">Admin</span>
                      ) : (
                        <span className="text-fg-mid">User</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() =>
                            updateUser.mutate({
                              id: u.id,
                              data: { can_request_summary: !u.can_request_summary },
                            })
                          }
                          className="h-4 w-4 accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Может запрашивать недельное саммари"
                        />
                        {isSelfAdmin && (
                          <span className="text-[11px] text-fg-mid">всегда</span>
                        )}
                      </label>
                    </td>
                    <td className="py-2 pr-4 text-fg-mid table-cell">
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
                )
              })}
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
