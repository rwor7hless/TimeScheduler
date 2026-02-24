import api from './client'

export const telegramApi = {
  status: () => api.get<{ connected: boolean }>('/telegram/status').then((r) => r.data),
  connect: (key: string) =>
    api.post<{ connected: boolean }>('/telegram/connect', { key }).then((r) => r.data),
  disconnect: () =>
    api.delete<{ connected: boolean }>('/telegram/connect').then((r) => r.data),
}
