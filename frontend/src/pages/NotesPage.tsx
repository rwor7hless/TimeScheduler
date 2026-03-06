import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { useTasks } from '@/hooks/useTasks'
import type { Task } from '@/types/task'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string
  title: string
  content: string
  taskId: string | null
  updatedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem('notes') || '[]')
  } catch {
    return []
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem('notes', JSON.stringify(notes))
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function createNote(): Note {
  return {
    id: genId(),
    title: '',
    content: '',
    taskId: null,
    updatedAt: new Date().toISOString(),
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Toolbar config ───────────────────────────────────────────────────────────

type FormatType =
  | 'bold' | 'italic' | 'strike'
  | 'h1' | 'h2' | 'h3'
  | 'ul' | 'ol' | 'quote'
  | 'code' | 'codeblock' | 'hr'

interface ToolbarBtn {
  type: FormatType
  label: string
  title: string
}

const TOOLBAR_BTNS: ToolbarBtn[] = [
  { type: 'bold',      label: 'B',   title: 'Жирный (Ctrl+B)' },
  { type: 'italic',    label: 'I',   title: 'Курсив (Ctrl+I)' },
  { type: 'strike',    label: 'S',   title: 'Зачёркнутый' },
  { type: 'h1',        label: 'H1',  title: 'Заголовок 1' },
  { type: 'h2',        label: 'H2',  title: 'Заголовок 2' },
  { type: 'h3',        label: 'H3',  title: 'Заголовок 3' },
  { type: 'ul',        label: '•',   title: 'Маркированный список' },
  { type: 'ol',        label: '1.',  title: 'Нумерованный список' },
  { type: 'quote',     label: '❝',  title: 'Цитата' },
  { type: 'code',      label: '</>',  title: 'Код' },
  { type: 'codeblock', label: '```', title: 'Блок кода' },
  { type: 'hr',        label: '—',   title: 'Разделитель' },
]

// ─── Apply formatting to textarea ─────────────────────────────────────────────

function applyFormat(
  textarea: HTMLTextAreaElement,
  type: FormatType,
  onChange: (val: string) => void,
) {
  const { selectionStart: ss, selectionEnd: se, value } = textarea
  const selected = value.slice(ss, se)
  const before = value.slice(0, ss)
  const after = value.slice(se)

  let newVal = value
  let newSs = ss
  let newSe = se

  const lineStart = before.lastIndexOf('\n') + 1
  const linePrefix = value.slice(lineStart, ss)

  const wrapInline = (marker: string) => {
    if (selected) {
      newVal = before + marker + selected + marker + after
      newSs = ss + marker.length
      newSe = se + marker.length
    } else {
      newVal = before + marker + marker + after
      newSs = ss + marker.length
      newSe = ss + marker.length
    }
  }

  const prefixLine = (prefix: string) => {
    // check if already has the prefix
    const currentLine = value.slice(lineStart, se)
    const alreadyHas = currentLine.startsWith(prefix)
    if (alreadyHas) {
      newVal = value.slice(0, lineStart) + currentLine.slice(prefix.length) + value.slice(se + (after.length === value.length - se ? 0 : 0))
      newSs = Math.max(lineStart, ss - prefix.length)
      newSe = Math.max(lineStart, se - prefix.length)
    } else {
      newVal = value.slice(0, lineStart) + prefix + value.slice(lineStart)
      newSs = ss + prefix.length
      newSe = se + prefix.length
    }
  }

  switch (type) {
    case 'bold':    wrapInline('**'); break
    case 'italic':  wrapInline('*');  break
    case 'strike':  wrapInline('~~'); break
    case 'h1':      prefixLine('# ');  break
    case 'h2':      prefixLine('## '); break
    case 'h3':      prefixLine('### '); break
    case 'ul':      prefixLine('- ');  break
    case 'ol':      prefixLine('1. '); break
    case 'quote':   prefixLine('> ');  break
    case 'code':
      if (selected) {
        newVal = before + '`' + selected + '`' + after
        newSs = ss + 1
        newSe = se + 1
      } else {
        newVal = before + '``' + after
        newSs = ss + 1
        newSe = ss + 1
      }
      break
    case 'codeblock': {
      const insert = '```\n' + (selected || '') + '\n```'
      newVal = before + insert + after
      newSs = ss + 4
      newSe = ss + 4 + (selected?.length ?? 0)
      break
    }
    case 'hr': {
      const sep = '\n---\n'
      newVal = before + sep + after
      newSs = ss + sep.length
      newSe = ss + sep.length
      break
    }
    default:
      void linePrefix
  }

  onChange(newVal)
  // restore cursor after react re-render
  requestAnimationFrame(() => {
    textarea.setSelectionRange(newSs, newSe)
    textarea.focus()
  })
}

// ─── Toolbar component ────────────────────────────────────────────────────────

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onFormat: (type: FormatType) => void
}

function MarkdownToolbar({ onFormat }: MarkdownToolbarProps) {
  return (
    <div className="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
      {TOOLBAR_BTNS.map((btn, i) => (
        <button
          key={btn.type}
          type="button"
          title={btn.title}
          onMouseDown={(e) => {
            e.preventDefault() // keep textarea focus
            onFormat(btn.type)
          }}
          className={[
            'min-w-[32px] h-8 px-1.5 rounded text-xs font-medium transition-colors touch-manipulation select-none',
            'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
            // separator before heading group and code group
            i === 3 || i === 6 || i === 9 ? 'ml-1' : '',
          ].join(' ')}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

// ─── Task Picker ──────────────────────────────────────────────────────────────

interface TaskPickerProps {
  tasks: Task[]
  value: string | null
  onChange: (taskId: string | null) => void
}

function TaskPicker({ tasks, value, onChange }: TaskPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = value ? tasks.find(t => String(t.id) === value) : null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter(t => t.title.toLowerCase().includes(q))
  }, [tasks, search])

  // close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // focus search on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  const select = (taskId: string | null) => {
    onChange(taskId)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      {/* trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={[
          'flex items-center gap-1.5 w-full px-2.5 py-1 rounded-lg text-xs transition-colors touch-manipulation text-left',
          open
            ? 'bg-gray-100 dark:bg-gray-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700',
          selected
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-gray-500 dark:text-gray-400',
        ].join(' ')}
      >
        {selected ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="truncate font-medium">{selected.title}</span>
          </>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">Без задачи</span>
        )}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={['ml-auto shrink-0 transition-transform', open ? 'rotate-180' : ''].join(' ')}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          {/* search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск задачи..."
                className="flex-1 text-xs bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* options list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {/* clear option */}
            <button
              type="button"
              onClick={() => select(null)}
              className={[
                'flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors touch-manipulation text-left',
                !value
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50',
              ].join(' ')}
            >
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {!value && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              Без задачи
            </button>

            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">
                Задачи не найдены
              </p>
            ) : (
              filtered.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => select(String(t.id))}
                  className={[
                    'flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors touch-manipulation text-left',
                    String(t.id) === value
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50',
                  ].join(' ')}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: t.color || '#D97706' }}
                  />
                  <span className="truncate">{t.title}</span>
                  {String(t.id) === value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Note card in sidebar list ────────────────────────────────────────────────

interface NoteCardProps {
  note: Note
  isSelected: boolean
  task: Task | undefined
  onClick: () => void
}

function NoteCard({ note, isSelected, task, onClick }: NoteCardProps) {
  const preview = note.content.replace(/[#*`>~\-_\[\]()]/g, '').slice(0, 70)
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-3 rounded-lg transition-colors touch-manipulation',
        isSelected
          ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
          {note.title || 'Без названия'}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">
          {formatDate(note.updatedAt)}
        </span>
      </div>
      {task && (
        <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 truncate max-w-full">
          {task.title}
        </span>
      )}
      {preview && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
          {preview}
        </p>
      )}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: tasksData } = useTasks()
  // only active (not completed, not archived) tasks
  const tasks: Task[] = useMemo(
    () => (tasksData ?? []).filter(t => !t.completed_at && !t.is_archived),
    [tasksData]
  )

  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  // persist on change (debounced)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNotes(notes), 400)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [notes])

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
    ))
  }, [])

  const selectNote = useCallback((id: string) => {
    setSelectedId(id)
    setMobileView('editor')
    setEditorMode('edit')
  }, [])

  const createNew = useCallback(() => {
    const note = createNote()
    setNotes(prev => [note, ...prev])
    selectNote(note.id)
  }, [selectNote])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    setNotes(prev => prev.filter(n => n.id !== selectedId))
    setSelectedId(null)
    setMobileView('list')
  }, [selectedId])

  const handleFormat = useCallback((type: FormatType) => {
    if (!textareaRef.current || !selectedNote) return
    applyFormat(textareaRef.current, type, (val) =>
      updateNote(selectedNote.id, { content: val })
    )
  }, [selectedNote, updateNote])

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedNote) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); handleFormat('bold') }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); handleFormat('italic') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleFormat, selectedNote])

  const taskForNote = (note: Note) => note.taskId ? tasks.find(t => String(t.id) === note.taskId) : undefined

  // ── Sidebar (note list) ──────────────────────────────────────────────────
  const noteList = (
    <div className={[
      'flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
      'lg:w-64 lg:flex-shrink-0',
      mobileView === 'list' ? 'flex flex-col flex-1' : 'hidden lg:flex',
    ].join(' ')}>
      {/* header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Заметки</h1>
        <button
          type="button"
          onClick={createNew}
          title="Новая заметка"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors touch-manipulation"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600 mb-3">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">Нет заметок</p>
            <button
              type="button"
              onClick={createNew}
              className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              Создать первую
            </button>
          </div>
        ) : (
          notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              isSelected={note.id === selectedId}
              task={taskForNote(note)}
              onClick={() => selectNote(note.id)}
            />
          ))
        )}
      </div>
    </div>
  )

  // ── Editor ───────────────────────────────────────────────────────────────
  const editor = (
    <div className={[
      'flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-900',
      mobileView === 'editor' ? 'flex' : 'hidden lg:flex',
    ].join(' ')}>
      {!selectedNote ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-200 dark:text-gray-700 mb-4">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Выберите заметку или создайте новую</p>
        </div>
      ) : (
        <>
          {/* editor header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {/* back button — mobile only */}
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 touch-manipulation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            {/* title input */}
            <input
              type="text"
              value={selectedNote.title}
              onChange={e => updateNote(selectedNote.id, { title: e.target.value })}
              placeholder="Заголовок..."
              className="flex-1 min-w-0 text-base font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600"
            />

            {/* preview toggle */}
            <button
              type="button"
              onClick={() => setEditorMode(m => m === 'edit' ? 'preview' : 'edit')}
              title={editorMode === 'edit' ? 'Предпросмотр' : 'Редактировать'}
              className={[
                'flex items-center justify-center w-8 h-8 rounded-lg transition-colors touch-manipulation shrink-0',
                editorMode === 'preview'
                  ? 'bg-amber-500 text-white'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300',
              ].join(' ')}
            >
              {editorMode === 'edit' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              )}
            </button>

            {/* delete */}
            <button
              type="button"
              onClick={deleteSelected}
              title="Удалить заметку"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors touch-manipulation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>

          {/* task link */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500 shrink-0">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Задача:</span>
            <TaskPicker
              tasks={tasks}
              value={selectedNote.taskId}
              onChange={taskId => updateNote(selectedNote.id, { taskId })}
            />
          </div>

          {/* toolbar (edit mode only) */}
          {editorMode === 'edit' && (
            <MarkdownToolbar textareaRef={textareaRef} onFormat={handleFormat} />
          )}

          {/* content area */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {editorMode === 'edit' ? (
              <textarea
                ref={textareaRef}
                value={selectedNote.content}
                onChange={e => updateNote(selectedNote.id, { content: e.target.value })}
                placeholder={`Пишите здесь...\n\n# Заголовок\n**жирный**, *курсив*, \`код\``}
                spellCheck
                className="w-full h-full min-h-[300px] px-4 py-3 text-sm text-gray-800 dark:text-gray-200 bg-transparent border-none outline-none resize-none leading-relaxed placeholder-gray-300 dark:placeholder-gray-600 font-mono"
              />
            ) : (
              <div className="px-4 py-3 markdown-preview">
                {selectedNote.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {selectedNote.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 text-sm italic">Нет содержимого</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden">
      {noteList}
      {editor}
    </div>
  )
}
