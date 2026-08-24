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
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ position: 'relative', zIndex: 1 }}
    >
      <div className="w-full max-w-sm fade-in">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #eaffb0, var(--accent))',
              boxShadow: '0 14px 30px -10px rgba(212,255,90,0.45), inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-ink)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h1
            className="text-3xl font-semibold"
            style={{
              background: 'linear-gradient(180deg, var(--ink), var(--ink-2))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            Time<span style={{ color: 'var(--accent)' }}>Scheduler</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-3)' }}>
            Войдите в свой планировщик
          </p>
        </div>

        <form onSubmit={handleSubmit} className="popover p-6 space-y-4">
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

        <p className="text-center text-xs mt-6" style={{ color: 'var(--ink-3)' }}>
          TimeScheduler &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
