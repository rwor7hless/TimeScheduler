import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBoards, useCreateBoard, useDeleteBoard } from '@/hooks/useTasks'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const KanbanIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/>
  </svg>
)

export default function BoardsPage() {
  const navigate = useNavigate()
  const { data: boards, isLoading } = useBoards()
  const createBoard = useCreateBoard()
  const deleteBoard = useDeleteBoard()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [boardToDelete, setBoardToDelete] = useState<{ id: number; name: string } | null>(null)

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newBoardName.trim()
    if (!name) return
    try {
      const board = await createBoard.mutateAsync(name)
      setCreateModalOpen(false)
      setNewBoardName('')
      toast.success('Доска создана')
      navigate(`/kanban/${board.id}`)
    } catch {
      toast.error('Не удалось создать доску')
    }
  }

  const openDeleteModal = (id: number, name: string) => {
    setBoardToDelete({ id, name })
    setDeleteModalOpen(true)
  }

  const handleDeleteBoard = async () => {
    if (!boardToDelete) return
    try {
      await deleteBoard.mutateAsync(boardToDelete.id)
      setDeleteModalOpen(false)
      setBoardToDelete(null)
      toast.success('Доска удалена')
    } catch {
      toast.error('Не удалось удалить доску')
    }
  }

  if (isLoading) return <Spinner className="mt-20" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Доски</h2>
        <Button onClick={() => setCreateModalOpen(true)}>+ Новая доска</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Default board */}
        <Link
          to="/kanban"
          className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-400 transition-colors group"
        >
          <div className="text-amber-600 group-hover:text-amber-700 mb-2">
            <KanbanIcon />
          </div>
          <span className="font-medium text-gray-900">Основная</span>
          <span className="text-xs text-gray-500 mt-0.5">Главная доска</span>
        </Link>

        {/* Custom boards */}
        {boards?.map((board) => (
          <div
            key={board.id}
            className="relative flex flex-col p-6 rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:shadow-md transition-all group"
          >
            <Link
              to={`/kanban/${board.id}`}
              className="flex flex-col items-center justify-center flex-1"
            >
              <div className="text-gray-400 group-hover:text-amber-500 mb-2 transition-colors">
                <KanbanIcon />
              </div>
              <span className="font-medium text-gray-900">{board.name}</span>
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                openDeleteModal(board.id, board.name)
              }}
              className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Удалить доску"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false)
          setNewBoardName('')
        }}
        title="Новая доска"
      >
        <form onSubmit={handleCreateBoard} className="space-y-4">
          <Input
            label="Название доски"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder="Введите название..."
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={createBoard.isPending || !newBoardName.trim()}>
              Создать
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setBoardToDelete(null)
        }}
        title="Удаление доски"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Удалить доску &laquo;{boardToDelete?.name}&raquo;? Задачи будут перемещены в основную доску.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false)
                setBoardToDelete(null)
              }}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteBoard}
              disabled={deleteBoard.isPending}
            >
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
