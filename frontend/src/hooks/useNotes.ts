import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi, type NoteCreate, type NoteUpdate } from '@/api/notes'
import { useAuth } from '@/context/AuthContext'

export function useNotes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notes', user?.user_id],
    queryFn: () => notesApi.list(),
    enabled: !!user?.user_id,
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: NoteCreate) => notesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: NoteUpdate }) => notesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => notesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}
