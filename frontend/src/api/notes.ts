import api from './client'

export interface NoteResponse {
  id: number
  title: string
  content: string
  task_id: number | null
  created_at: string
  updated_at: string
}

export interface NoteCreate {
  title?: string
  content?: string
  task_id?: number | null
}

export interface NoteUpdate {
  title?: string
  content?: string
  task_id?: number | null
}

export const notesApi = {
  list: () =>
    api.get<NoteResponse[]>('/notes').then((r) => r.data),

  create: (data: NoteCreate) =>
    api.post<NoteResponse>('/notes', data).then((r) => r.data),

  update: (id: number, data: NoteUpdate) =>
    api.put<NoteResponse>(`/notes/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/notes/${id}`),
}
