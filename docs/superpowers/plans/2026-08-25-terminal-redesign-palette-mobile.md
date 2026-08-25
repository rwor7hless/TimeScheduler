# Terminal Redesign — Palette & Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `Ctrl+K` command palette and make every screen work at 375px, closing the terminal redesign.

**Architecture:** Two pieces that share one component. The palette is a single input with three behaviours off the same field, mounted once in `AppShell`; on mobile it has no keyboard trigger, so `MobileTabBar`'s central `+` opens the same component. The mobile pass is not a second stylesheet — it is one named Tailwind screen, `narrow` (`max-width: 899px`), declared once in `tailwind.config.js` and referenced from the markup that needs it. Plan 2 collapsed 98 `sm:`/`md:`/`lg:` prefixes to their wide arm; this plan puts the narrow arm back under that single name.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Vitest, TanStack Query, react-router.

**Spec:** `docs/superpowers/specs/2026-08-24-terminal-redesign-design.md` — this plan implements its steps 4 and 5.

## Scope

This is **plan 3 of 3**. Plans 1 and 2 are complete: tokens are the only source of colour, every screen is migrated, and `legacy-classes.test.ts`'s baseline is empty. When this plan finishes, the branch is ready to merge.

## Global Constraints

- Branch: `feature/backend-nestjs-port`. This plan's completion is what unblocks the merge to `main`.
- `--radius: 0` everywhere. No `box-shadow`, no `backdrop-filter`, anywhere, ever.
- No network font loading. No CDN calls of any kind — the Android APK runs offline.
- Readable tokens (`fg`, `fgBody`, `mid`, `accent`, `red`, `green`) must clear **4.5:1**. Decorative tokens (`dim`, `muted`, `faint`) are deliberately below it, and no date, counter, or error may render only at those tiers.
- Two themes only. Never write a `dark:` variant — the tokens already switch.
- **One breakpoint.** `narrow` = `max-width: 899px`, defined once in `tailwind.config.js`. `sm:`/`md:`/`lg:`/`xl:`/`2xl:` stay banned by `legacy-classes.test.ts`; do not reintroduce them, and do not write a second raw `@media` where a `narrow:` utility would do.
- Every class the markup references must exist in `globals.css` (`css-classes.test.ts`), every `var(--…)` must resolve (`css-vars.test.ts`), and every `<svg>` must declare its own size (`svg-size.test.ts`). All three are guards this plan must keep green — they exist because plan 1 broke exactly these three things silently.
- Below 900px every tap target is **≥44px**. `--row-h` already becomes 44px there; anything that sets its own height must follow.
- Run `npm test && npm run build` from `frontend/` at the end of every task.

### On testing this plan

Plans 1 and 2 tested pure functions and scanned source text; there is no jsdom or
`@testing-library/react` in this project, and this plan does not add them. So the
palette's *logic* is extracted into pure, tested functions — shortcut matching,
command construction, result merging — and the component around them is thin enough
to be reviewed by eye. Where a step cannot be tested, it says so and gives the manual
check instead of pretending. Do not claim a step passed on a test that does not exist.

---

### Task 1: Share the navigation list

The spec requires the palette's navigation commands to be generated from *the same*
list `Sidebar.tsx` renders, so the two cannot drift. Today that list is built inline
in `Sidebar.tsx:166-180`. Extracting it is a prerequisite for Task 3 and worth its own
task because it must not change anything the user sees.

**Files:**
- Create: `frontend/src/lib/nav.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Test: `frontend/src/lib/nav.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface NavItem { to: string; label: string; match?: (pathname: string) => boolean; icon: JSX.Element }`
  - `interface NavGroup { id: string; title: string | null; items: NavItem[] }`
  - `buildNav(opts: { isAdmin: boolean }): NavGroup[]` — the structure, without counts.
  - The icon components (`ClockIcon`, `BoardsIcon`, `CalIcon`, `HabitIcon`, `StatsIcon`, `BellIcon`, `AdminIcon`) move here and are exported, because both consumers render them.

Counts and unread dots stay in `Sidebar.tsx`: they are live query data, and the palette
does not show them. `buildNav` returns structure only.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/nav.test.ts`. The assertion that earns its keep is the drift
one: every route the nav points at must be a route `App.tsx` actually defines.

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { buildNav } from './nav'

const APP = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')

/** Пути из <Route path="…">, включая индексные редиректы. */
function declaredRoutes(): string[] {
  return Array.from(APP.matchAll(/<Route\s+path="([^"]+)"/g), (m) => m[1])
}

describe('buildNav', () => {
  it('every nav destination is a route App.tsx declares', () => {
    const routes = declaredRoutes()
    const missing = buildNav({ isAdmin: true })
      .flatMap((g) => g.items)
      .map((i) => i.to)
      .filter((to) => !routes.some((r) => r === to || to.startsWith(r.replace(/\/:.*$/, '') + '/')))
    expect(missing).toEqual([])
  })

  it('hides the admin entry for a non-admin', () => {
    const labels = buildNav({ isAdmin: false }).flatMap((g) => g.items).map((i) => i.label)
    expect(labels).not.toContain('Админ')
  })

  it('exposes the admin entry for an admin', () => {
    const labels = buildNav({ isAdmin: true }).flatMap((g) => g.items).map((i) => i.label)
    expect(labels).toContain('Админ')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/nav.test.ts
```

Expected: FAIL — `Failed to resolve import "./nav"`.

- [ ] **Step 3: Create the module**

Move the seven icon components out of `Sidebar.tsx` verbatim into
`frontend/src/lib/nav.tsx` and export each. Then add:

```tsx
export interface NavItem {
  to: string
  label: string
  /** Активность по префиксу, когда `to` не равен pathname (например /calendar/day). */
  match?: (pathname: string) => boolean
  icon: JSX.Element
}

export interface NavGroup {
  id: string
  /** null — группа без заголовка. */
  title: string | null
  items: NavItem[]
}

/**
 * Структура навигации без живых данных. Счётчики и точки непрочитанного
 * остаются в Sidebar: палитра их не показывает, а тянуть сюда запросы значило
 * бы дёргать их и там, где они не нужны.
 */
export function buildNav({ isAdmin }: { isAdmin: boolean }): NavGroup[] {
  const groups: NavGroup[] = [
    { id: 'myday', title: null, items: [
      { to: '/today', label: 'Мой день', icon: <ClockIcon /> },
    ]},
    { id: 'planning', title: 'Планирование', items: [
      { to: '/tasks', label: 'Задачи', match: (p) => p === '/tasks', icon: <BoardsIcon /> },
      { to: '/calendar/day', label: 'Календарь', match: (p) => p.startsWith('/calendar'), icon: <CalIcon /> },
    ]},
    { id: 'tracking', title: 'Отслеживание', items: [
      { to: '/habits', label: 'Привычки', icon: <HabitIcon /> },
      { to: '/stats', label: 'Статистика', icon: <StatsIcon /> },
    ]},
    { id: 'history', title: 'История', items: [
      { to: '/notifications', label: 'История', icon: <BellIcon /> },
    ]},
  ]
  if (isAdmin) groups[groups.length - 1].items.push({ to: '/admin', label: 'Админ', icon: <AdminIcon /> })
  return groups
}
```

Keep the group titles exactly as `Sidebar.tsx` renders them today — read them out of
the file rather than inventing them, or the sidebar's headings change and this task
stops being invisible.

- [ ] **Step 4: Rewire Sidebar onto it**

`Sidebar.tsx` imports `buildNav` and the icons instead of declaring them, and merges
its live counts onto the returned items by `to`:

```tsx
const nav = buildNav({ isAdmin })
const COUNTS: Record<string, number | undefined> = {
  '/today': myDayCount > 0 ? myDayCount : undefined,
  '/tasks': tasksCount > 0 ? tasksCount : undefined,
  '/notifications': unread > 0 ? unread : undefined,
}
```

- [ ] **Step 5: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 6: Verify the sidebar is unchanged**

This task must be invisible. Open the app, confirm the groups, labels, order, icons,
counts and the unread dot are exactly as before.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/nav.tsx frontend/src/lib/nav.test.ts frontend/src/components/layout/Sidebar.tsx
git commit -m "refactor: share the nav list between Sidebar and the coming palette"
```

---

### Task 2: The keyboard shortcut

`Ctrl+K` must survive a Cyrillic layout. `event.key` is `'л'` there; `event.code` is
`'KeyK'` regardless. This is the whole reason the spec calls the binding out, so it
gets a pure function and a test rather than being buried in an effect.

**Files:**
- Create: `frontend/src/hooks/useCommandPalette.ts`
- Test: `frontend/src/hooks/useCommandPalette.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isPaletteShortcut(e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey'>): boolean`
  - `useCommandPalette(): { isOpen: boolean; open: () => void; close: () => void }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { isPaletteShortcut } from './useCommandPalette'

const ev = (over: Partial<{ code: string; ctrlKey: boolean; metaKey: boolean }>) =>
  ({ code: 'KeyK', ctrlKey: false, metaKey: false, ...over })

describe('isPaletteShortcut', () => {
  it('matches Ctrl+K', () => {
    expect(isPaletteShortcut(ev({ ctrlKey: true }))).toBe(true)
  })

  it('matches Cmd+K', () => {
    expect(isPaletteShortcut(ev({ metaKey: true }))).toBe(true)
  })

  it('matches on a Cyrillic layout, where the key is "л" but the code is still KeyK', () => {
    // Именно поэтому биндинг на event.code, а не на event.key: с русской
    // раскладкой event.key === 'л', и проверка по key просто не сработала бы.
    expect(isPaletteShortcut({ code: 'KeyK', ctrlKey: true, metaKey: false })).toBe(true)
  })

  it('ignores a bare K', () => {
    expect(isPaletteShortcut(ev({}))).toBe(false)
  })

  it('ignores Ctrl with another letter', () => {
    expect(isPaletteShortcut(ev({ code: 'KeyJ', ctrlKey: true }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/hooks/useCommandPalette.test.ts
```

Expected: FAIL — `Failed to resolve import "./useCommandPalette"`.

- [ ] **Step 3: Implement**

```ts
import { useCallback, useEffect, useState } from 'react'

/**
 * Привязка к `event.code`, а не к `event.key`. На русской раскладке
 * `event.key` для этой клавиши — 'л', и проверка по key молча перестала бы
 * работать ровно у того пользователя, для которого это приложение написано.
 */
export function isPaletteShortcut(
  e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey'>,
): boolean {
  return e.code === 'KeyK' && (e.ctrlKey || e.metaKey)
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isPaletteShortcut(e)) return
      e.preventDefault()
      setIsOpen((v) => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { isOpen, open, close }
}
```

- [ ] **Step 4: Run the tests to verify green**

```bash
cd frontend && npm test
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useCommandPalette.ts frontend/src/hooks/useCommandPalette.test.ts
git commit -m "feat(palette): Ctrl+K binding that survives a Cyrillic layout"
```

---

### Task 3: The command list

**Files:**
- Create: `frontend/src/components/palette/commands.ts`
- Test: `frontend/src/components/palette/commands.test.ts`

**Interfaces:**
- Consumes: `buildNav`, `NavGroup` from Task 1.
- Produces:
  - `interface Command { id: string; label: string; hint?: string; run: (ctx: CommandContext) => void }`
  - `interface CommandContext { navigate: (to: string) => void; toggleTheme: () => void; newTask: () => void }`
  - `buildCommands(opts: { isAdmin: boolean }): Command[]`
  - `filterCommands(commands: Command[], query: string): Command[]` — case-insensitive substring on `label`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { buildCommands, filterCommands } from './commands'
import { buildNav } from '@/lib/nav'

const ctx = () => ({ navigate: vi.fn(), toggleTheme: vi.fn(), newTask: vi.fn() })

describe('buildCommands', () => {
  it('produces a command for every navigation destination', () => {
    const labels = buildCommands({ isAdmin: true }).map((c) => c.label)
    for (const item of buildNav({ isAdmin: true }).flatMap((g) => g.items)) {
      expect(labels).toContain(item.label)
    }
  })

  it('navigates to the destination the nav declares', () => {
    const c = ctx()
    const today = buildCommands({ isAdmin: false }).find((x) => x.label === 'Мой день')!
    today.run(c)
    expect(c.navigate).toHaveBeenCalledWith('/today')
  })

  it('carries the two actions the spec names', () => {
    const labels = buildCommands({ isAdmin: false }).map((c) => c.label)
    expect(labels).toContain('Новая задача')
    expect(labels).toContain('Сменить тему')
  })

  it('gives every command a unique id', () => {
    const ids = buildCommands({ isAdmin: true }).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('filterCommands', () => {
  it('matches case-insensitively on a substring', () => {
    const found = filterCommands(buildCommands({ isAdmin: false }), 'ЗАДАЧ')
    expect(found.map((c) => c.label)).toContain('Задачи')
  })

  it('returns everything for an empty query', () => {
    const all = buildCommands({ isAdmin: false })
    expect(filterCommands(all, '')).toHaveLength(all.length)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/components/palette/commands.test.ts
```

Expected: FAIL — `Failed to resolve import "./commands"`.

- [ ] **Step 3: Implement**

```ts
import { buildNav } from '@/lib/nav'

export interface CommandContext {
  navigate: (to: string) => void
  toggleTheme: () => void
  newTask: () => void
}

export interface Command {
  id: string
  label: string
  hint?: string
  run: (ctx: CommandContext) => void
}

/**
 * Навигационные команды строятся из того же buildNav, что рендерит Sidebar —
 * спек требует именно этого, чтобы список не разъезжался в двух местах.
 */
export function buildCommands({ isAdmin }: { isAdmin: boolean }): Command[] {
  const nav = buildNav({ isAdmin })
    .flatMap((g) => g.items)
    .map<Command>((item) => ({
      id: `nav:${item.to}`,
      label: item.label,
      hint: 'Перейти',
      run: (ctx) => ctx.navigate(item.to),
    }))

  return [
    ...nav,
    { id: 'action:new-task', label: 'Новая задача', hint: 'Создать', run: (ctx) => ctx.newTask() },
    { id: 'action:toggle-theme', label: 'Сменить тему', hint: 'Оформление', run: (ctx) => ctx.toggleTheme() },
  ]
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((c) => c.label.toLowerCase().includes(q))
}
```

- [ ] **Step 4: Run the tests to verify green**

```bash
cd frontend && npm test
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/palette
git commit -m "feat(palette): commands generated from the shared nav list"
```

---

### Task 4: The palette itself

One input, three behaviours off the same field, per the spec's table: empty shows the
command list; typed text shows `/api/search` results merged with matching commands;
free text plus Enter with nothing selected creates a task through the existing
`parseTaskInput`.

**Files:**
- Create: `frontend/src/components/palette/CommandPalette.tsx`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/styles/globals.css`

**Interfaces:**
- Consumes: `useCommandPalette` (Task 2), `buildCommands`/`filterCommands`/`Command`/`CommandContext` (Task 3), `searchApi` from `@/api/search`, `parseTaskInput` from `@/utils/parseTask`, `useCreateTask` from `@/hooks/useTasks`, `useTheme` from `@/context/ThemeContext`.
- Produces: `<CommandPalette isOpen onClose />`, mounted once in `AppShell`.

- [ ] **Step 1: Add the palette's classes to globals.css**

`css-classes.test.ts` fails the moment the component references a class that does not
exist, so the stylesheet goes first. Add, next to `.popover`:

```css
/* ============================================================================
   COMMAND PALETTE
   ============================================================================ */

.ts-palette {
  position: fixed;
  top: 12vh;
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 32px));
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-raised);
  border: 1px solid var(--line);
  z-index: 60;
}
.ts-palette__input {
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--fg);
  font-family: inherit;
  font-size: var(--fs);
  outline: none;
}
.ts-palette__input::placeholder {
  color: var(--dim);
}
.ts-palette__list {
  overflow-y: auto;
  min-height: 0;
}
.ts-palette__group {
  padding: 6px 12px 2px;
  color: var(--dim);
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.ts-palette__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  height: var(--row-h);
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--fg-body);
  font-family: inherit;
  font-size: var(--fs);
  text-align: left;
  cursor: pointer;
}
.ts-palette__row:hover,
.ts-palette__row.is-active {
  background: var(--bg-sel);
  color: var(--fg);
}
.ts-palette__hint {
  color: var(--mid);
  font-size: 11px;
  flex-shrink: 0;
}
.ts-palette__empty {
  padding: 12px;
  color: var(--mid);
  font-size: 12px;
}
```

- [ ] **Step 2: Write the component**

Create `frontend/src/components/palette/CommandPalette.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { searchApi } from '@/api/search'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { useCreateTask } from '@/hooks/useTasks'
import { parseTaskInput } from '@/utils/parseTask'
import { buildCommands, filterCommands, type Command, type CommandContext } from './commands'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface Row {
  key: string
  label: string
  hint: string
  run: () => void
}

export default function CommandPalette({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const { toggle } = useTheme()
  const { isAdmin } = useAuth()
  const createTask = useCreateTask()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActive(0)
      inputRef.current?.focus()
    }
  }, [isOpen])

  const commands = useMemo(() => buildCommands({ isAdmin }), [isAdmin])

  // Поиск дёргаем только когда есть что искать; палитра открывается пустой.
  const { data: results } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchApi.search(query),
    enabled: isOpen && query.trim().length >= 2,
  })

  async function createFromQuery() {
    const parsed = parseTaskInput(query, new Date())
    const title = parsed.title.trim()
    if (!title) return
    try {
      await createTask.mutateAsync({
        title,
        my_day: !parsed.scheduledDate,
        scheduled_start: parsed.scheduledDate && parsed.startTime
          ? new Date(`${parsed.scheduledDate}T${parsed.startTime}:00`).toISOString()
          : null,
        deadline: parsed.deadline ? new Date(`${parsed.deadline}T23:59:00`).toISOString() : null,
      })
      toast.success('Задача создана')
      onClose()
    } catch {
      toast.error('Не удалось создать задачу')
    }
  }

  const ctx: CommandContext = {
    navigate: (to) => { navigate(to); onClose() },
    toggleTheme: () => { toggle(); onClose() },
    newTask: () => { navigate('/today'); onClose() },
  }

  const rows: Row[] = useMemo(() => {
    const cmds: Row[] = filterCommands(commands, query).map((c: Command) => ({
      key: c.id, label: c.label, hint: c.hint ?? '', run: () => c.run(ctx),
    }))
    if (!results) return cmds
    const found: Row[] = [
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
    return [...cmds, ...found]
  // ctx пересоздаётся каждый рендер, но ничего не замыкает сверх navigate/onClose
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands, query, results])

  if (!isOpen) return null

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Свободный текст без выбранной строки — создаём задачу, как велит спек.
      if (rows.length === 0) void createFromQuery()
      else rows[active]?.run()
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="ts-palette" role="dialog" aria-label="Командная палитра">
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
                <span className="truncate">{r.label}</span>
                <span className="ts-palette__hint">{r.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Mount it once in AppShell**

`AppShell.tsx` calls `useCommandPalette()` and renders `<CommandPalette isOpen={isOpen} onClose={close} />` as a sibling of `<main>`. Keep the returned `open` — Task 5's `MobileTabBar` needs it.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

Expected: green, including `css-classes.test.ts` — if it fails, a `ts-palette*` class in
the component has no rule in Step 1's block.

- [ ] **Step 5: Verify the three behaviours by hand**

There is no jsdom in this project, so this step is the test. In `npm run dev`:

- `Ctrl+K` opens it. Switch to a Russian layout and press `Ctrl+К` — it must still open.
- Empty field lists the navigation commands plus «Новая задача» and «Сменить тему».
- `↑` `↓` move the highlight, `Enter` runs it, `Esc` closes.
- Type two or more characters of a real task title — search results appear under the commands.
- Type text matching nothing and press `Enter` — a task is created and a toast confirms.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/palette frontend/src/components/layout/AppShell.tsx frontend/src/styles/globals.css
git commit -m "feat(palette): Ctrl+K palette — navigate, search, create"
```

---

### Task 5: MobileTabBar, and deleting the drawer

The spec replaces the burger, drawer and backdrop outright. They are already inert —
plan 2 collapsed them to a bare `hidden` — so this task deletes them rather than
restyling them.

**Files:**
- Create: `frontend/src/components/layout/MobileTabBar.tsx`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/tailwind.config.js`

**Interfaces:**
- Consumes: `buildNav` (Task 1), `useCommandPalette`'s `open` (Task 2).
- Produces: `<MobileTabBar onPlus={() => void} />`.

- [ ] **Step 1: Declare the one breakpoint**

In `frontend/tailwind.config.js`, inside `theme.extend`:

```js
      screens: {
        narrow: { max: '899px' },
      },
```

This is the plan's single breakpoint. `sm:`/`md:`/`lg:` remain banned by
`legacy-classes.test.ts`; `narrow:` is the only prefix any markup may use from here on.

- [ ] **Step 2: Write the tab bar**

Create `frontend/src/components/layout/MobileTabBar.tsx`. Four entries per the spec —
Мой день / Задачи / Привычки / Статистика — plus the central `+`:

```tsx
import { NavLink } from 'react-router-dom'
import { buildNav } from '@/lib/nav'

const TABS = ['/today', '/tasks', '/habits', '/stats']

export default function MobileTabBar({ onPlus }: { onPlus: () => void }) {
  const items = buildNav({ isAdmin: false })
    .flatMap((g) => g.items)
    .filter((i) => TABS.includes(i.to))
    .sort((a, b) => TABS.indexOf(a.to) - TABS.indexOf(b.to))

  const [left, right] = [items.slice(0, 2), items.slice(2)]

  return (
    <nav className="ts-tabbar" aria-label="Основная навигация">
      {left.map((i) => (
        <NavLink key={i.to} to={i.to} className="ts-tabbar__item" aria-label={i.label}>
          {i.icon}
          <span className="ts-tabbar__label">{i.label}</span>
        </NavLink>
      ))}
      <button type="button" className="ts-tabbar__plus" onClick={onPlus} aria-label="Создать">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {right.map((i) => (
        <NavLink key={i.to} to={i.to} className="ts-tabbar__item" aria-label={i.label}>
          {i.icon}
          <span className="ts-tabbar__label">{i.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: Add its styles**

In `globals.css`. Every target is 44px tall, per the constraint:

```css
/* ============================================================================
   MOBILE TAB BAR — существует только ниже 900px
   ============================================================================ */

.ts-tabbar {
  display: none;
}
@media (max-width: 899px) {
  .ts-tabbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    height: calc(52px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--bg-raised);
    border-top: 1px solid var(--line);
    z-index: 50;
  }
}
.ts-tabbar__item,
.ts-tabbar__plus {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--mid);
  font-family: inherit;
  text-decoration: none;
  cursor: pointer;
}
.ts-tabbar__item svg,
.ts-tabbar__plus svg {
  flex-shrink: 0;
}
.ts-tabbar__item.active {
  color: var(--accent);
}
.ts-tabbar__plus {
  color: var(--bg);
  background: var(--accent);
}
.ts-tabbar__label {
  font-size: 10px;
  line-height: 1;
}
```

- [ ] **Step 4: Delete the drawer, mount the bar**

In `AppShell.tsx`: delete the burger `<button>`, the backdrop `<div>`, the
`sidebarOpen` state and the whole edge-swipe `useEffect` that drives it, and drop
`isOpen`/`onClose` from `<Sidebar>`. Render `<MobileTabBar onPlus={open} />` after
`<main>`, wiring `open` from `useCommandPalette()`.

In `Sidebar.tsx`: drop the now-unused `isOpen`/`onClose` props and the `is-open` class.

In `globals.css`: delete `.ts-shell__burger`, `.ts-shell__backdrop` and the
`@media (max-width: 1023px)` block that positions `.ts-side` as a drawer.

`tsc` is the gate — it fails on any surviving reference to a deleted prop.

- [ ] **Step 5: Make the shell single-column below 900px**

Replace the remaining `@media (max-width: 1023px)` shell block with one at 899px that
hides the sidebar entirely and leaves room for the bar:

```css
@media (max-width: 899px) {
  .ts-shell {
    display: block;
    height: auto;
  }
  .ts-side {
    display: none;
  }
  .ts-shell__main {
    border-left: 0;
    padding: 16px 16px calc(64px + env(safe-area-inset-bottom));
  }
}
```

- [ ] **Step 6: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 7: Verify at 375px**

Devtools at 375px: the bar is fixed to the bottom, five cells, the active tab is
accent, `+` opens the palette, nothing is hidden behind the bar at the bottom of a
long list, and no horizontal scrollbar appears.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/layout frontend/src/styles/globals.css frontend/tailwind.config.js
git commit -m "feat(mobile): MobileTabBar replaces the burger drawer"
```

---

### Task 6: The 900px pass

Plan 2 collapsed 98 breakpoint prefixes to their wide arm. This task puts the narrow
arm back — once, under the `narrow:` name from Task 5.

**Files:**
- Modify: `frontend/src/pages/TodayPage.tsx`
- Modify: `frontend/src/pages/HabitsPage.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/pages/CalendarPage.tsx`
- Modify: `frontend/src/components/calendar/MonthView.tsx`
- Modify: `frontend/src/components/calendar/WeekView.tsx`
- Modify: `frontend/src/components/calendar/DayView.tsx`
- Modify: `frontend/src/components/stats/StatsWeekView.tsx`
- Modify: `frontend/src/components/stats/StatsPeriodView.tsx`
- Modify: `frontend/src/components/tasks/TaskModal.tsx`
- Modify: `frontend/src/components/ui/Modal.tsx`

**Interfaces:**
- Consumes: the `narrow` screen from Task 5 Step 1.
- Produces: nothing importable.

- [ ] **Step 1: Restore the narrow arms**

Each of these was a `base narrow-arm` pair before plan 2 collapsed it. Restore the
narrow arm as a `narrow:` utility, leaving the wide arm unprefixed:

| File | Wide (now) | Add |
|---|---|---|
| `TodayPage.tsx` | `grid-cols-[1fr_220px]` | `narrow:grid-cols-1` |
| `HabitsPage.tsx` | `h-[calc(100vh-9rem)]` | `narrow:h-auto` |
| `HabitsPage.tsx` | `grid-cols-[minmax(0,240px)_minmax(0,1fr)]` | `narrow:grid-cols-1` |
| `HabitsPage.tsx` | `grid-cols-4` (stat cards) | `narrow:grid-cols-2` |
| `HabitsPage.tsx` | `grid-cols-2` (charts) | `narrow:grid-cols-1` |
| `StatsWeekView.tsx` | `grid-cols-4`, `grid-cols-3` | `narrow:grid-cols-2`, `narrow:grid-cols-1` |
| `StatsPeriodView.tsx` | `grid-cols-4`, `grid-cols-2` | `narrow:grid-cols-2`, `narrow:grid-cols-1` |
| `TaskModal.tsx` | `grid-cols-2` | `narrow:grid-cols-1` |
| `CalendarPage.tsx` | `flex-row items-center justify-between` | `narrow:flex-col narrow:items-stretch` |
| `MonthView.tsx` | `min-h-[100px] p-1.5` | `narrow:min-h-[56px] narrow:p-1` |
| `MonthView.tsx` | short weekday `<span className="hidden">` | swap: full name `narrow:hidden`, short `hidden narrow:inline` |
| `WeekView.tsx` / `DayView.tsx` | `w-14` / `w-16` gutter | `narrow:w-10` |
| `AdminPage.tsx` | `flex-row items-end` | `narrow:flex-col narrow:items-stretch` |
| `AdminPage.tsx` | Created column `table-cell` | `narrow:hidden` |
| `Modal.tsx` | `p-4 py-6`, `px-6 py-5` | `narrow:p-3 narrow:py-4`, `narrow:px-4 narrow:py-4` |

- [ ] **Step 2: Give rows their tap target**

`--row-h` is already 44px below 900px, so anything using it is fine. Audit for
hardcoded heights that are not: `grep -rn 'h-\[3[0-9]px\]\|h-8\|h-9' frontend/src`.
Anything interactive that lands under 44px at narrow width gets `narrow:h-11`.

- [ ] **Step 3: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

`legacy-classes.test.ts` must stay green — if it reports a `breakpoint`, an `sm:`/`md:`
prefix slipped back in instead of `narrow:`.

- [ ] **Step 4: Verify every screen at 375px**

Devtools at 375px, both themes, each of Today, Tasks, the list view, Calendar
(day/week/month), Habits, Stats, Notifications, Admin, Login:

- no horizontal scrollbar on any screen
- every tap target ≥44px
- metadata wraps to a second line rather than truncating away
- nothing sits under the tab bar

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(mobile): restore the narrow arm under one 900px breakpoint"
```

---

### Task 7: Close the spec

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-08-24-terminal-redesign-design.md`

- [ ] **Step 1: Walk the spec's full QA checklist**

Every box, not just this plan's:

- [ ] Both themes: no element renders unstyled or with a leftover radius/shadow
- [ ] No essential text (dates, counters, errors) rendered at `--dim` or below
- [ ] Cyrillic keyboard layout: `Ctrl+K` still opens the palette
- [ ] Palette: navigate, search, and create a task via free text
- [ ] Offline (devtools → Network → Offline, reload): JetBrains Mono still renders
- [ ] 375px: no horizontal scroll on any screen; every tap target ≥44px
- [ ] DnD on Today and Tasks: drop lands where released, no ghost frame
- [ ] `/budget` returns 404 in the SPA router; `GET /api/budget/*` still answers
- [ ] Weekly report renders with no section colour themes

- [ ] **Step 2: Settle the DnD workarounds**

Plan 2 deliberately left `TodayPage`'s `translateZ(0)` / `contain: paint` /
`backfaceVisibility` block in place, because the spec forbids removing it without
watching a real drag. With the checklist's drag in front of you, remove it and drag
again. Keep it only if something visibly regresses, and if it stays, replace its
comment — it currently blames shadows that no longer exist.

- [ ] **Step 3: Update CLAUDE.md**

Add the palette (`Ctrl+K`, bound to `event.code`) and `MobileTabBar` to the frontend
section, and record the single `narrow` breakpoint in place of the old `sm:`/`md:`/`lg:`
mixture.

- [ ] **Step 4: Mark the spec's inherited list cleared**

All eight items are done as of plan 2; note it in the spec so the next reader does not
re-derive them.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs
git commit -m "docs: close the terminal redesign spec"
```
