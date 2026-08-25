import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import AppShell from '@/components/layout/AppShell'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import LoginPage from '@/pages/LoginPage'
import AdminPage from '@/pages/AdminPage'
import CalendarPage from '@/pages/CalendarPage'
import TodoListPage from '@/pages/TodoListPage'
import HabitsPage from '@/pages/HabitsPage'
import StatsPage from '@/pages/StatsPage'
import TodayPage from '@/pages/TodayPage'
import TasksPage from '@/pages/TasksPage'
import NotificationsPage from '@/pages/NotificationsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import { queryClient } from '@/lib/queryClient'

/** Отдельный компонент, потому что useTheme() работает только внутри ThemeProvider. */
function ThemedToaster() {
  const { colors } = useTheme()
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: colors.surface,
          color: colors.fg,
          border: `1px solid ${colors.line}`,
          fontSize: '14px',
        },
      }}
    />
  )
}

function ListPageRedirect() {
  const { boardId } = useParams<{ boardId: string }>()
  return <Navigate to={`/list/${boardId}`} replace />
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

function AdminRoute() {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/calendar/day" replace />
  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/today" replace />} />
                <Route path="/today" element={<TodayPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/calendar" element={<Navigate to="/calendar/day" replace />} />
                <Route path="/calendar/day" element={<CalendarPage />} />
                <Route path="/calendar/week" element={<CalendarPage />} />
                <Route path="/calendar/month" element={<CalendarPage />} />
                {/* legacy redirects */}
                {/* Совместимость: страниц за этими путями нет и не было —
                    /boards и /kanban остаются, чтобы старые закладки и
                    ссылки из Telegram продолжали открываться. */}
                <Route path="/boards" element={<Navigate to="/today" replace />} />
                <Route path="/projects" element={<Navigate to="/today" replace />} />
                <Route path="/project" element={<Navigate to="/tasks" replace />} />
                <Route path="/project/:boardId" element={<ListPageRedirect />} />
                <Route path="/kanban" element={<Navigate to="/tasks" replace />} />
                <Route path="/kanban/:boardId" element={<ListPageRedirect />} />
                {/* new list route */}
                <Route path="/list/:boardId" element={<TodoListPage />} />
                <Route path="/habits" element={<HabitsPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
                {/* Ловушка: неизвестный путь остаётся внутри шелла и получает
                    404-экран, а не пустую страницу. */}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
        <ThemedToaster />
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
