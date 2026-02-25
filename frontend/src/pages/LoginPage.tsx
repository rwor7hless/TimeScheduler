import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/today" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
    } catch {
      toast.error('Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="w-full max-w-sm animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
            Time<span className="text-amber-600">Scheduler</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Войдите в свой планировщик</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/30 border border-gray-100 dark:border-gray-700 space-y-4"
        >
          <Input
            label="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Логин"
            required
            autoFocus
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            required
          />
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          TimeScheduler &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
