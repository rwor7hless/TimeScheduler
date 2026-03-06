import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import AdminPage from '@/pages/AdminPage'
import CalendarPage from '@/pages/CalendarPage'
import BoardsPage from '@/pages/BoardsPage'
import KanbanPage from '@/pages/KanbanPage'
import HabitsPage from '@/pages/HabitsPage'
import StatsPage from '@/pages/StatsPage'
import ExportPage from '@/pages/ExportPage'
import TodayPage from '@/pages/TodayPage'
import NotesPage from '@/pages/NotesPage'
import { queryClient } from '@/lib/queryClient'

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
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/today" replace />} />
                <Route path="/today" element={<TodayPage />} />
                <Route path="/calendar" element={<Navigate to="/calendar/day" replace />} />
                <Route path="/calendar/day" element={<CalendarPage />} />
                <Route path="/calendar/week" element={<CalendarPage />} />
                <Route path="/calendar/month" element={<CalendarPage />} />
                <Route path="/boards" element={<BoardsPage />} />
                <Route path="/kanban" element={<KanbanPage />} />
                <Route path="/kanban/:boardId" element={<KanbanPage />} />
                <Route path="/habits" element={<HabitsPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/export" element={<ExportPage />} />
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
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
