import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
})

let sessionExpiredHandled = false

export function handleSessionExpired() {
  if (sessionExpiredHandled) return
  sessionExpiredHandled = true
  localStorage.removeItem('token')
  toast.error('Сессия истекла, войдите снова', { duration: 2500 })
  setTimeout(() => {
    window.location.href = '/login'
  }, 800)
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handleSessionExpired()
    }
    return Promise.reject(error)
  }
)

export default api
