import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { searchApi } from '@/api/search'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { useCreateTask } from '@/hooks/useTasks'
import { parseTaskInput } from '@/utils/parseTask'
import { buildCommands, filterCommands, type CommandContext } from './commands'

interface Props {
  isOpen: boolean
  onClose: () => void
}

/** Строка списка: и команда, и результат поиска приводятся к одному виду. */
interface Row {
  key: string
  label: string
  hint: string
  run: () => void
}

/** Поиск дёргаем только начиная с двух символов — на одном он бесполезен. */
const MIN_QUERY = 2

export default function CommandPalette({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const { toggle } = useTheme()
  const { isAdmin } = useAuth()
  const createTask = useCreateTask()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActive(0)
    inputRef.current?.focus()
  }, [isOpen])

  const commands = useMemo(() => buildCommands({ isAdmin }), [isAdmin])

  const { data: results } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchApi.search(query),
    enabled: isOpen && query.trim().length >= MIN_QUERY,
  })

  const rows: Row[] = useMemo(() => {
    const ctx: CommandContext = {
      navigate: (to) => { navigate(to); onClose() },
      toggleTheme: () => { toggle(); onClose() },
      newTask: () => { navigate('/today'); onClose() },
    }
    const cmds: Row[] = filterCommands(commands, query).map((c) => ({
      key: c.id,
      label: c.label,
      hint: c.hint ?? '',
      run: () => c.run(ctx),
    }))
    if (!results) return cmds
    return [
      ...cmds,
      ...results.tasks.map((t) => ({
        key: `task:${t.id}`, label: t.title, hint: 'Задача',
        run: () => { navigate('/tasks'); onClose() },
      })),
      ...results.habits.map((h) => ({
        key: `habit:${h.id}`, label: h.name, hint: 'Привычка',
        run: () => { navigate('/habits'); onClose() },
      })),
      ...results.boards.map((b) => ({
        key: `board:${b.id}`, label: b.name, hint: 'Проект',
        run: () => { navigate(`/list/${b.id}`); onClose() },
      })),
    ]
  }, [commands, query, results, navigate, onClose, toggle])

  async function createFromQuery() {
    const parsed = parseTaskInput(query, new Date())
    const title = parsed.title.trim()
    if (!title) return
    try {
      await createTask.mutateAsync({
        title,
        // Без даты задача попадает в «Мой день» — так же, как из быстрого ввода.
        my_day: !parsed.scheduledDate,
        scheduled_start:
          parsed.scheduledDate && parsed.startTime
            ? new Date(`${parsed.scheduledDate}T${parsed.startTime}:00`).toISOString()
            : null,
        deadline: parsed.deadline
          ? new Date(`${parsed.deadline}T23:59:00`).toISOString()
          : null,
      })
      toast.success('Задача создана')
      onClose()
    } catch {
      toast.error('Не удалось создать задачу')
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, rows.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Свободный текст, ничего не нашлось — создаём задачу, как велит спек.
      if (rows.length === 0) void createFromQuery()
      else rows[active]?.run()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="ts-palette" role="dialog" aria-modal="true" aria-label="Командная палитра">
        <input
          ref={inputRef}
          className="ts-palette__input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
          placeholder="Команда, поиск или новая задача…"
          aria-label="Команда, поиск или новая задача"
        />
        <div className="ts-palette__list">
          {rows.length === 0 ? (
            <div className="ts-palette__empty">
              {query.trim() ? 'Enter — создать задачу' : 'Ничего не найдено'}
            </div>
          ) : (
            rows.map((r, i) => (
              <button
                key={r.key}
                type="button"
                className={`ts-palette__row${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={r.run}
              >
                <span className="ts-palette__label">{r.label}</span>
                <span className="ts-palette__hint">{r.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
