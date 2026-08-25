import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useBoards,
  useCreateBoard,
  useUpdateBoard,
  useDeleteBoard,
  useReorderBoards,
} from '@/hooks/useTasks'
import {
  useBoardGroups,
  useCreateBoardGroup,
  useRenameBoardGroup,
  useDeleteBoardGroup,
  useReorderBoardGroups,
} from '@/hooks/useBoardGroups'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import RowMenu from '@/components/ui/RowMenu'
import toast from 'react-hot-toast'
import type { Board } from '@/types/board'
import type { BoardGroup } from '@/types/boardGroup'

interface Props {
  taskCounts?: Map<number, number> // boardId → open task count
  onClose: () => void
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7 9h10M7 13h7M7 17h5" />
    </svg>
  )
}

function GROUP_KEY(id: number) {
  return `sidebar:group:${id}:open`
}

function isGroupOpen(id: number): boolean {
  if (typeof window === 'undefined') return true
  const v = window.localStorage.getItem(GROUP_KEY(id))
  return v === null ? true : v === '1'
}

function setGroupOpen(id: number, open: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GROUP_KEY(id), open ? '1' : '0')
}

export default function SidebarBoardTree({ taskCounts, onClose }: Props) {
  const { data: boards } = useBoards()
  const { data: groups } = useBoardGroups()
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({})

  const [createListOpen, setCreateListOpen] = useState(false)
  const [createListName, setCreateListName] = useState('')
  const [createListGroupId, setCreateListGroupId] = useState<number | null>(null)

  // null = idle, '' or string = inline input shown
  const [creatingGroupName, setCreatingGroupName] = useState<string | null>(null)

  const [renameTarget, setRenameTarget] = useState<
    | { type: 'list' | 'group'; id: number; current: string }
    | null
  >(null)
  const [renameValue, setRenameValue] = useState('')

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: number; name: string } | null>(null)
  const [deleteGroupCascade, setDeleteGroupCascade] = useState(false)

  const [deleteListTarget, setDeleteListTarget] = useState<{ id: number; name: string } | null>(null)

  const createBoard = useCreateBoard()
  const updateBoard = useUpdateBoard()
  const deleteBoard = useDeleteBoard()
  const createGroup = useCreateBoardGroup()
  const renameGroup = useRenameBoardGroup()
  const deleteGroup = useDeleteBoardGroup()
  const reorderBoards = useReorderBoards()
  const reorderGroups = useReorderBoardGroups()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Hydrate localStorage state on mount and when groups change.
  useEffect(() => {
    if (!groups) return
    const next: Record<number, boolean> = {}
    for (const g of groups) next[g.id] = isGroupOpen(g.id)
    setOpenMap(next)
  }, [groups])

  // Garbage-collect localStorage entries for groups that no longer exist.
  useEffect(() => {
    if (!groups || typeof window === 'undefined') return
    const valid = new Set(groups.map((g) => g.id))
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      const m = k.match(/^sidebar:group:(\d+):open$/)
      if (m && !valid.has(Number(m[1]))) window.localStorage.removeItem(k)
    }
  }, [groups])

  const { topLevelBoards, byGroup } = useMemo(() => {
    const top: Board[] = []
    const grouped = new Map<number, Board[]>()
    for (const b of boards ?? []) {
      if (b.group_id == null) top.push(b)
      else {
        const arr = grouped.get(b.group_id)
        if (arr) arr.push(b)
        else grouped.set(b.group_id, [b])
      }
    }
    const sortFn = (a: Board, bo: Board) =>
      a.sort_order !== bo.sort_order ? a.sort_order - bo.sort_order : a.id - bo.id
    top.sort(sortFn)
    for (const arr of grouped.values()) arr.sort(sortFn)
    return { topLevelBoards: top, byGroup: grouped }
  }, [boards])

  const toggle = (id: number) => {
    setOpenMap((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      setGroupOpen(id, next[id])
      return next
    })
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = createListName.trim()
    if (!name) return
    try {
      await createBoard.mutateAsync({ name, group_id: createListGroupId })
      setCreateListOpen(false)
      setCreateListName('')
      setCreateListGroupId(null)
    } catch {
      toast.error('Не удалось создать проект')
    }
  }

  const handleCreateGroup = async () => {
    const name = (creatingGroupName ?? '').trim()
    if (!name) {
      setCreatingGroupName(null)
      return
    }
    try {
      await createGroup.mutateAsync({ name })
      setCreatingGroupName(null)
    } catch {
      toast.error('Не удалось создать группу')
    }
  }

  const handleRename = async () => {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name || name === renameTarget.current) {
      setRenameTarget(null)
      return
    }
    try {
      if (renameTarget.type === 'list') {
        await updateBoard.mutateAsync({ id: renameTarget.id, data: { name } })
      } else {
        await renameGroup.mutateAsync({ id: renameTarget.id, data: { name } })
      }
      setRenameTarget(null)
    } catch {
      toast.error('Не удалось переименовать')
    }
  }

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return
    try {
      await deleteGroup.mutateAsync({ id: deleteGroupTarget.id, cascade: deleteGroupCascade })
      setDeleteGroupTarget(null)
      setDeleteGroupCascade(false)
    } catch {
      toast.error('Не удалось удалить группу')
    }
  }

  const handleDeleteList = async () => {
    if (!deleteListTarget) return
    try {
      await deleteBoard.mutateAsync(deleteListTarget.id)
      setDeleteListTarget(null)
    } catch {
      toast.error('Не удалось удалить проект')
    }
  }

  // True while a board is being dragged. Drives the visibility of the
  // "↑ Верхний уровень" drop zone — invisible at rest so it doesn't add noise.
  const [dragActiveType, setDragActiveType] = useState<'board' | 'group' | null>(null)

  const handleDragStart = (e: { active: { data: { current?: unknown } } }) => {
    const d = e.active.data.current as { type?: string } | undefined
    if (d?.type === 'board' || d?.type === 'group') setDragActiveType(d.type)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragActiveType(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const aData = active.data.current as { type: string; boardId?: number; groupId?: number | null } | undefined
    const oData = over.data.current as { type: string; groupId?: number | null } | undefined
    if (!aData || !oData) return

    if (aData.type === 'board' && oData.type === 'board') {
      const sourceGroup = aData.groupId ?? null
      const targetGroup = oData.groupId ?? null
      if (sourceGroup === targetGroup) {
        const list = sourceGroup === null
          ? topLevelBoards
          : (byGroup.get(sourceGroup) ?? [])
        const oldIdx = list.findIndex((b) => `board-${b.id}` === active.id)
        const newIdx = list.findIndex((b) => `board-${b.id}` === over.id)
        if (oldIdx === -1 || newIdx === -1) return
        const reordered = arrayMove(list, oldIdx, newIdx)
        reorderBoards.mutate({
          group_id: sourceGroup,
          ordered_ids: reordered.map((b) => b.id),
        })
      } else {
        const targetList = targetGroup === null
          ? topLevelBoards.filter((b) => b.id !== aData.boardId)
          : (byGroup.get(targetGroup) ?? []).filter((b) => b.id !== aData.boardId)
        const insertAt = targetList.findIndex((b) => `board-${b.id}` === over.id)
        const movedId = aData.boardId!
        const newSeq = [...targetList.map((b) => b.id)]
        newSeq.splice(insertAt < 0 ? newSeq.length : insertAt, 0, movedId)
        // Sequential: server must see group_id update before reorder
        // (otherwise reorder filters by old group_id and skips the moved board).
        try {
          await updateBoard.mutateAsync({ id: movedId, data: { group_id: targetGroup } })
          reorderBoards.mutate({ group_id: targetGroup, ordered_ids: newSeq })
        } catch {
          // updateBoard's onError already toasts; nothing more to do.
        }
      }
      return
    }

    // Drop a board ONTO a group header: move board into that group, append at end.
    // Without this branch dnd-kit's `over` resolves to the group container but our
    // handler used to no-op, so dragging a top-level project into a group did nothing.
    if (aData.type === 'board' && oData.type === 'group') {
      const sourceGroup = aData.groupId ?? null
      const targetGroup = oData.groupId!
      if (sourceGroup === targetGroup) return

      const movedId = aData.boardId!
      const targetList = (byGroup.get(targetGroup) ?? []).filter((b) => b.id !== movedId)
      const newSeq = [...targetList.map((b) => b.id), movedId]

      try {
        await updateBoard.mutateAsync({ id: movedId, data: { group_id: targetGroup } })
        reorderBoards.mutate({ group_id: targetGroup, ordered_ids: newSeq })
      } catch {
        // updateBoard's onError already toasts.
      }
      return
    }

    // Drop a board onto the dedicated "top-level" droppable zone — moves the
    // board out of its current group regardless of how many top-level boards
    // exist. Otherwise users with all projects nested in groups have no way
    // to escape (there's nothing to drop on at the root level).
    if (aData.type === 'board' && oData.type === 'top-level') {
      const sourceGroup = aData.groupId ?? null
      if (sourceGroup === null) return
      const movedId = aData.boardId!
      const newSeq = [
        movedId,
        ...topLevelBoards.filter((b) => b.id !== movedId).map((b) => b.id),
      ]
      try {
        await updateBoard.mutateAsync({ id: movedId, data: { group_id: null } })
        reorderBoards.mutate({ group_id: null, ordered_ids: newSeq })
      } catch {
        // updateBoard's onError already toasts.
      }
      return
    }

    if (aData.type === 'group' && oData.type === 'group') {
      const oldIdx = (groups ?? []).findIndex((g) => `group-${g.id}` === active.id)
      const newIdx = (groups ?? []).findIndex((g) => `group-${g.id}` === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(groups ?? [], oldIdx, newIdx)
      reorderGroups.mutate(reordered.map((g) => g.id))
    }
  }

  function SortableBoardRow({ board, indent }: { board: Board; indent: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `board-${board.id}`,
      data: { type: 'board', boardId: board.id, groupId: board.group_id },
      transition: { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    })
    const style = { transform: CSS.Transform.toString(transform), transition }
    const renaming = renameTarget?.type === 'list' && renameTarget.id === board.id

    return (
      <div
        ref={setNodeRef}
        style={{ ...style, opacity: isDragging ? 0.4 : 1 }}
        className={clsx('flex items-center', indent && 'pl-[18px]')}
        {...attributes}
        {...listeners}
      >
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') setRenameTarget(null)
            }}
            className="ts-side__link flex-1 bg-transparent border border-accent px-2 py-1 text-sm"
          />
        ) : (
          <NavLink
            to={`/list/${board.id}`}
            onClick={onClose}
            className={({ isActive }) =>
              clsx('ts-side__link ts-side__link--compact flex-1', isActive && 'active')
            }
          >
            <ListIcon />
            <span style={{ flex: 1 }}>{board.name}</span>
            {taskCounts && taskCounts.get(board.id) ? (
              <span className="ts-side__count">{taskCounts.get(board.id)}</span>
            ) : null}
          </NavLink>
        )}
        <RowMenu
          items={[
            {
              label: 'Переименовать',
              onClick: () => {
                setRenameTarget({ type: 'list', id: board.id, current: board.name })
                setRenameValue(board.name)
              },
            },
            {
              label: 'Удалить',
              destructive: true,
              onClick: () => setDeleteListTarget({ id: board.id, name: board.name }),
            },
          ]}
        />
      </div>
    )
  }

  function SortableGroup({ group }: { group: BoardGroup }) {
    const open = openMap[group.id] ?? true
    const children = byGroup.get(group.id) ?? []
    const renaming = renameTarget?.type === 'group' && renameTarget.id === group.id

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `group-${group.id}`,
      data: { type: 'group', groupId: group.id },
      transition: { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    })
    const style = { transform: CSS.Transform.toString(transform), transition }

    return (
      <div ref={setNodeRef} style={{ ...style, opacity: isDragging ? 0.4 : 1 }}>
        <div className="flex items-center" {...attributes} {...listeners}>
          <button
            type="button"
            onClick={() => toggle(group.id)}
            className="px-2 py-1"
          >
            <svg
              width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={clsx('transition-transform', open && 'rotate-90')}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setRenameTarget(null)
              }}
              className="flex-1 bg-transparent border border-accent px-2 py-1 text-[11px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => toggle(group.id)}
              className="flex-1 text-left text-[11px] font-semibold opacity-80 hover:opacity-100"
            >
              {group.name}
            </button>
          )}
          <RowMenu
            items={[
              {
                label: 'Переименовать',
                onClick: () => {
                  setRenameTarget({ type: 'group', id: group.id, current: group.name })
                  setRenameValue(group.name)
                },
              },
              {
                label: 'Удалить',
                destructive: true,
                onClick: () => {
                  setDeleteGroupTarget({ id: group.id, name: group.name })
                  setDeleteGroupCascade(false)
                },
              },
            ]}
          />
        </div>
        {open && (
          <SortableContext
            items={children.map((b) => `board-${b.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {children.map((b) => (
              <SortableBoardRow key={b.id} board={b} indent={true} />
            ))}
          </SortableContext>
        )}
      </div>
    )
  }

  function TopLevelDropZone({ visible }: { visible: boolean }) {
    const { setNodeRef, isOver } = useDroppable({
      id: 'top-level-zone',
      data: { type: 'top-level' },
    })
    return (
      <div
        ref={setNodeRef}
        aria-hidden={!visible}
        className={clsx(
          'transition-all duration-200 ease-out',
          visible
            ? 'h-7 mx-1 mb-1 flex items-center justify-center text-[10px] uppercase tracking-wider border border-dashed'
            : 'h-0 overflow-hidden border-0',
          visible && isOver
            ? 'border-accent bg-bg-sel text-accent'
            : visible
            ? 'border-line text-fg-mid'
            : '',
        )}
      >
        {visible && '↑ Верхний уровень'}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragActiveType(null)}
    >
      <SortableContext
        items={[
          ...topLevelBoards.map((b) => `board-${b.id}`),
          ...(groups ?? []).map((g) => `group-${g.id}`),
        ]}
        strategy={verticalListSortingStrategy}
      >
        <div>
          <div className="ts-side__group-title">
            <span>Проекты</span>
            <span className="flex items-center gap-1 normal-case tracking-normal opacity-90">
              <button
                type="button"
                onClick={() => setCreateListOpen(true)}
                title="Новый проект"
                aria-label="Новый проект"
                className="p-0.5 hover:bg-bg-hover hover:text-fg-body transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {creatingGroupName === null ? (
                <button
                  type="button"
                  onClick={() => setCreatingGroupName('')}
                  title="Новая группа"
                  aria-label="Новая группа"
                  className="p-0.5 hover:bg-bg-hover hover:text-fg-body transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              ) : (
                <input
                  autoFocus
                  value={creatingGroupName}
                  onChange={(e) => setCreatingGroupName(e.target.value)}
                  onBlur={handleCreateGroup}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateGroup()
                    if (e.key === 'Escape') setCreatingGroupName(null)
                  }}
                  placeholder="Имя группы"
                  className="bg-transparent border border-accent px-1.5 py-0 text-[10px] w-24"
                />
              )}
            </span>
          </div>
          <TopLevelDropZone visible={dragActiveType === 'board'} />
          {topLevelBoards.map((b) => (
            <SortableBoardRow key={b.id} board={b} indent={false} />
          ))}
          {(groups ?? []).map((g) => (
            <SortableGroup key={g.id} group={g} />
          ))}

          <Modal
            isOpen={createListOpen}
            onClose={() => setCreateListOpen(false)}
            title="Новый проект"
          >
            <form onSubmit={handleCreateList} className="space-y-4">
              <Input
                label="Название"
                value={createListName}
                onChange={(e) => setCreateListName(e.target.value)}
                autoFocus
                required
              />
              <div>
                <label className="text-[11px] uppercase opacity-70">Группа</label>
                <select
                  value={createListGroupId ?? ''}
                  onChange={(e) => setCreateListGroupId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full mt-1 px-2 py-1.5 border border-line bg-bg-cell"
                >
                  <option value="">Без группы (верхний уровень)</option>
                  {(groups ?? []).map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setCreateListOpen(false)}>Отмена</Button>
                <Button type="submit" disabled={!createListName.trim()}>Создать</Button>
              </div>
            </form>
          </Modal>

          <Modal
            isOpen={deleteGroupTarget !== null}
            onClose={() => setDeleteGroupTarget(null)}
            title={`Удалить группу «${deleteGroupTarget?.name ?? ''}»?`}
          >
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!deleteGroupCascade}
                  onChange={() => setDeleteGroupCascade(false)}
                />
                <span>Перенести проекты наверх (без удаления задач)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={deleteGroupCascade}
                  onChange={() => setDeleteGroupCascade(true)}
                />
                <span className="text-danger">Удалить группу вместе с проектами и их задачами</span>
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setDeleteGroupTarget(null)}>Отмена</Button>
                <Button variant="danger" onClick={handleDeleteGroup}>Удалить</Button>
              </div>
            </div>
          </Modal>

          <Modal
            isOpen={deleteListTarget !== null}
            onClose={() => setDeleteListTarget(null)}
            title={`Удалить проект «${deleteListTarget?.name ?? ''}»?`}
          >
            <div className="space-y-4">
              <p className="text-fg-body">
                Задачи проекта станут «без проекта» и будут видны в «Задачи».
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setDeleteListTarget(null)}>Отмена</Button>
                <Button variant="danger" onClick={handleDeleteList}>Удалить</Button>
              </div>
            </div>
          </Modal>
        </div>
      </SortableContext>
    </DndContext>
  )
}
