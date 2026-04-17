import api from './client'
import type { Tag } from '@/types/task'

export interface SearchResult {
  tasks: { id: number; title: string; status: string; priority: string; color: string; board_id: number | null; tags: Tag[]; type: string }[]
  habits: { id: number; name: string; color: string; is_active: boolean; type: string }[]
  boards: { id: number; name: string; type: string }[]
}

export const searchApi = {
  search: (q: string) =>
    api.get<SearchResult>('/search', { params: { q } }).then((r) => r.data),
}
