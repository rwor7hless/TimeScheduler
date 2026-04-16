import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBoards, useCreateBoard, useDeleteBoard } from '@/hooks/useTasks'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const ProjectIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
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
      toast.success('Проект создан')
      navigate(`/project/${board.id}`)
    } catch {
      toast.error('Не удалось создать проект')
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
      toast.success('Проект удалён')
    } catch {
      toast.error('Не удалось удалить проект')
    }
  }

  if (isLoading) return <Spinner className="mt-20" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Проекты</h2>
        <Button onClick={() => setCreateModalOpen(true)}>+ Новый проект</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Default project */}
        <Link
          to="/project"
          className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-400 dark:border-amber-700 dark:bg-amber-900/10 dark:hover:bg-amber-900/20 transition-colors group"
        >
          <div className="text-amber-600 group-hover:text-amber-700 dark:text-amber-400 dark:group-hover:text-amber-300 mb-2">
            <ProjectIcon />
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100">Входящие</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Без проекта</span>
        </Link>

        {/* Custom projects */}
        {boards?.map((board) => (
          <div
            key={board.id}
            className="relative flex flex-col p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-md transition-all group"
          >
            <Link
              to={`/project/${board.id}`}
              className="flex flex-col items-center justify-center flex-1"
            >
              <div className="text-gray-400 group-hover:text-amber-500 mb-2 transition-colors">
                <ProjectIcon />
              </div>
              <span className="font-medium text-gray-900 dark:text-gray-100">{board.name}</span>
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                openDeleteModal(board.id, board.name)
              }}
              className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Удалить проект"
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
        title="Новый проект"
      >
        <form onSubmit={handleCreateBoard} className="space-y-4">
          <Input
            label="Название проекта"
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
        title="Удаление проекта"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Удалить проект &laquo;{boardToDelete?.name}&raquo;? Задачи будут перемещены во «Входящие».
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
