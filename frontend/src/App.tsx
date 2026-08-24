import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
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
import { queryClient } from '@/lib/queryClient'

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
              </Route>
            </Route>
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1F2937',
              color: '#F9FAFB',
              fontSize: '14px',
              borderRadius: '8px',
            },
          }}
        />
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
