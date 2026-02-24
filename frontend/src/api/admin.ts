import api from './client'

export interface UserResponse {
  id: number
  username: string
  is_admin: boolean
  created_at: string
}

export interface UserCreate {
  username: string
  password: string
}

export const adminApi = {
  listUsers: () => api.get<UserResponse[]>('/admin/users').then((r) => r.data),
  registerUser: (data: UserCreate) =>
    api.post<UserResponse>('/admin/users', data).then((r) => r.data),
  deleteUser: (userId: number) =>
    api.delete(`/admin/users/${userId}`),
}
