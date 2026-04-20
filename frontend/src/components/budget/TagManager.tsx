import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  useBudgetTags,
  useCreateBudgetTag,
  useUpdateBudgetTag,
  useDeleteBudgetTag,
} from '@/hooks/useBudget'
import type { BudgetTagResponse } from '@/api/budget'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function TagManager({ isOpen, onClose }: Props) {
  const { data: tags = [] } = useBudgetTags()
  const create = useCreateBudgetTag()
  const update = useUpdateBudgetTag()
  const del = useDeleteBudgetTag()

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6B7280')

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    create.mutate({ name, color: newColor }, {
      onSuccess: () => {
        toast.success(`Тег «${name}» создан`)
        setNewName('')
        setNewColor('#6B7280')
      },
      onError: () => toast.error('Ошибка'),
    })
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Теги">
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Переименование или смена цвета сразу применится ко всем транзакциям и планам с этим тегом.
          </p>

          {tags.length === 0 && (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="text-3xl mb-2">🏷️</div>
              <p className="text-sm text-gray-400">Тегов ещё нет.</p>
            </div>
          )}

          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {tags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                onUpdate={(data) => update.mutate({ id: tag.id, data })}
                onDelete={() => setDeleteId(tag.id)}
              />
            ))}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent flex-shrink-0"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
              placeholder="Новый тег"
              className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Добавить</Button>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Готово</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Удалить тег?"
        message="Тег снимется со всех транзакций и планов."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={async () => {
          if (!deleteId) return
          del.mutate(deleteId, {
            onSuccess: () => toast.success('Удалено'),
            onError: () => toast.error('Ошибка'),
          })
          setDeleteId(null)
        }}
      />
    </>
  )
}

function TagRow({
  tag,
  onUpdate,
  onDelete,
}: {
  tag: BudgetTagResponse
  onUpdate: (data: { name?: string; color?: string }) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color)

  useEffect(() => {
    setName(tag.name)
    setColor(tag.color)
  }, [tag.id, tag.name, tag.color])

  const commitName = () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === tag.name) {
      setName(tag.name)
      return
    }
    onUpdate({ name: trimmed })
  }

  const commitColor = (c: string) => {
    setColor(c)
    if (c !== tag.color) onUpdate({ color: c })
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <input
        type="color"
        value={color}
        onChange={(e) => commitColor(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent flex-shrink-0"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commitName(); (e.target as HTMLInputElement).blur() }
          if (e.key === 'Escape') { setName(tag.name); (e.target as HTMLInputElement).blur() }
        }}
        className="flex-1 text-sm px-2.5 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 focus:bg-white dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-100"
      />
      <button
        type="button"
        onClick={onDelete}
        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 p-1"
        title="Удалить"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
