import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

interface UserInfo {
  username: string
  user_id: number
  is_admin: boolean
}

interface AuthContextType {
  isAuthenticated: boolean
  user: UserInfo | null
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'))
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api
        .get<UserInfo>('/auth/me')
        .then((r) => {
          setUser(r.data)
        })
        .catch(() => {
          localStorage.removeItem('token')
          setIsAuthenticated(false)
          setUser(null)
        })
    } else {
      setUser(null)
    }
  }, [isAuthenticated])

  const login = useCallback(async (username: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const response = await api.post('/auth/token', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    localStorage.setItem('token', response.data.access_token)
    setIsAuthenticated(true)
    const meRes = await api.get<UserInfo>('/auth/me')
    setUser(meRes.data)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    queryClient.clear()
    setIsAuthenticated(false)
    setUser(null)
  }, [queryClient])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isAdmin: user?.is_admin ?? false,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
