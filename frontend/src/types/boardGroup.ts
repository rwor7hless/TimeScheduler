export interface BoardGroup {
  id: number
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BoardGroupCreate {
  name: string
}

export interface BoardGroupUpdate {
  name?: string
}

export interface BoardGroupReorder {
  ordered_ids: number[]
}

export interface BoardReorder {
  group_id: number | null
  ordered_ids: number[]
}
