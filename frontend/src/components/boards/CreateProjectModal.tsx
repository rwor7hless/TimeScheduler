import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useCreateBoard } from '@/hooks/useTasks'
import { useBoardGroups } from '@/hooks/useBoardGroups'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Предвыбранная группа — сайдбар открывает модалку из конкретной группы. */
  defaultGroupId?: number | null
}

/**
 * Одна модалка на два вызова: кнопку в дереве проектов и команду палитры.
 * Раньше она была вшита в SidebarBoardTree, а ниже 900px сайдбар не
 * рендерится — то есть создать проект с телефона было нельзя.
 */
export default function CreateProjectModal({ isOpen, onClose, defaultGroupId = null }: Props) {
  const { data: groups } = useBoardGroups()
  const createBoard = useCreateBoard()
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState<number | null>(defaultGroupId)

  function close() {
    setName('')
    setGroupId(defaultGroupId)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await createBoard.mutateAsync({ name: trimmed, group_id: groupId })
      close()
    } catch {
      toast.error('Не удалось создать проект')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Новый проект">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
        <div>
          <label className="text-[11px] uppercase opacity-70">Группа</label>
          <select
            value={groupId ?? ''}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-1 px-2 py-1.5 border border-line bg-bg-cell"
          >
            <option value="">Без группы (верхний уровень)</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>Отмена</Button>
          <Button type="submit" disabled={!name.trim()}>Создать</Button>
        </div>
      </form>
    </Modal>
  )
}
