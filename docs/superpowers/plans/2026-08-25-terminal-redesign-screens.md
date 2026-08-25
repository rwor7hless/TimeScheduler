# Terminal Redesign — Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every screen off the Tailwind default palette and onto the terminal tokens, so the app is visually finished at desktop width.

**Architecture:** Plan 1 already mapped the tokens into `tailwind.config.js` (`bg-bg-cell`, `text-fg-mid`, `border-line`, …) and disabled `borderRadius`/`boxShadow` as core plugins. So this plan is not a design exercise — it is a mechanical substitution, screen by screen, driven by a guard test that records which files are still dirty and fails when that list is wrong in **either** direction. Every task deletes its files from the baseline, watches the test go red, restyles, and watches it go green. That is what makes «done» checkable instead of a matter of opinion.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-terminal-redesign-design.md` — this plan implements its step 3 and clears the «Inherited by plan 2» list.

## Scope

This is **plan 2 of 3**. Plan 1 (`2026-08-24-terminal-redesign-foundation.md`) is complete. Plan 3 covers the command palette and the mobile pass — everything in this plan is desktop-width (≥900px) only. Do not restyle for 375px here; the spec deliberately puts that in one sweep after the screens exist.

## Global Constraints

- Branch: `feature/backend-nestjs-port`. Do not merge to `main` until plan 3 completes.
- `--radius: 0` everywhere. No `box-shadow`, no `backdrop-filter`, anywhere, ever.
- No network font loading. No CDN calls of any kind — the Android APK runs offline.
- Readable tokens (`fg`, `fgBody`, `mid`, `accent`, `red`, `green`) must clear **4.5:1** against their theme's `bg`. Enforced by test, not by eye.
- Decorative tokens (`dim`, `muted`, `faint`) are deliberately **below 4.5:1**. No date, counter, or error message may be rendered only at those tiers.
- Two themes only: `dark` (default) and `light`. Never write a `dark:` variant again — the tokens already switch. A `dark:` class in a finished file is a bug.
- Font stack everywhere: `'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace`.
- The NestJS `budget` module and its 9 Prisma models are **not touched**. Frontend only, except Task 13's one dead-DI line.
- Run `npm test && npm run build` from `frontend/` at the end of every task. Build is `tsc -b && vite build`.
- Colour never goes in an inline `style` when a class exists. `src/styles/inline-styles.test.ts` and `src/styles/css-vars.test.ts` both police this and both must stay green.

### The substitution table

Copied from the measured class census of the pre-plan-2 tree (1 483 legacy class
usages across 44 files). Left column is what is in the code today, usually as a
`X dark:X'` pair; right column is the single class that replaces the whole pair.

| Today | Replace with | Notes |
|---|---|---|
| `text-gray-900 dark:text-gray-100` | `text-fg` | headings, primary text |
| `text-gray-700 dark:text-gray-300` | `text-fg-body` | body copy, labels |
| `text-gray-500 dark:text-gray-400` | `text-fg-mid` | metadata that must stay readable |
| `text-gray-400 dark:text-gray-500` | `text-fg-mid` | **not** `-dim`: dates and counters live here |
| `text-white` on an accent surface | `text-bg` | ink-on-accent; `--bg` is dark in dark theme, light in light |
| `bg-white dark:bg-gray-800` | `bg-bg-cell` | cards, rows, panels |
| `bg-gray-50 dark:bg-gray-900` | `bg-bg-raised` | |
| `bg-gray-100 dark:bg-gray-700` | `bg-bg-hover` | hover/pressed fills |
| `border-gray-200 dark:border-gray-700` | `border-line` | |
| `border-gray-100` | `border-line-soft` | hairlines inside a panel |
| `text-amber-*`, `border-amber-*` | `text-accent`, `border-accent` | |
| `bg-amber-50 dark:bg-amber-900` | `bg-bg-sel` | selected/active row |
| `text-red-*` | `text-danger` | |
| `text-green-*`, `text-emerald-*` | `text-success` | |
| `rounded`, `rounded-*` | *delete the class* | inert core plugin; leaving it reads as intent |
| `shadow`, `shadow-*` | *delete the class* | same |
| `sm:` `md:` `lg:` `xl:` | see Task 12 | collapse to the single 900px rule |

Anything not on this table: pick the nearest token by **role**, not by hue, and say
which in the commit message. If no token fits, that is a spec gap — stop and raise it
rather than inventing a colour.

---

### Task 1: The guard test, and Login as its first red

The plan needs a machine-checkable definition of «this screen is done». `inline-styles.test.ts` already established the pattern in plan 1: a recorded baseline that fails in both directions, so a stale entry is as loud as a new violation.

Login goes first, out of the spec's order, because it is the smallest dirty file left (one `rounded-2xl`) and so it gives the new test a genuine red to go green from inside a single task.

**Files:**
- Create: `frontend/src/styles/legacy-classes.test.ts`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/tailwind.config.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `legacy-classes.test.ts` exporting nothing; every later task edits its `BASELINE` constant.
  - `tailwind.config.js` gains `bg.hover`, `bg.sel`, `fg.muted`, `fg.faint` colour keys, which every later task's substitutions depend on.

- [ ] **Step 1: Add the four missing colour keys to Tailwind**

The substitution table needs `bg-bg-hover`, `bg-bg-sel`, `text-fg-muted` and `text-fg-faint`; `tailwind.config.js` currently maps only `bg`/`raised`/`cell` and `fg`/`body`/`mid`/`dim`. In `frontend/tailwind.config.js` replace the `bg` and `fg` entries under `theme.extend.colors`:

```js
        bg:      {
          DEFAULT: 'var(--bg)',
          raised:  'var(--bg-raised)',
          cell:    'var(--bg-cell)',
          hover:   'var(--bg-hover)',
          sel:     'var(--bg-sel)',
        },
        fg:      {
          DEFAULT: 'var(--fg)',
          body:    'var(--fg-body)',
          mid:     'var(--mid)',
          dim:     'var(--dim)',
          muted:   'var(--muted)',
          faint:   'var(--faint)',
        },
```

- [ ] **Step 2: Write the guard test, with Login already absent from the baseline**

Create `frontend/src/styles/legacy-classes.test.ts`. Note `LoginPage.tsx` is deliberately **not** in `BASELINE` even though it still has `rounded-2xl` — that is the failure this task fixes.

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const SRC = resolve(process.cwd(), 'src')

const PALETTE =
  /\b(?:bg|text|border|from|to|via|fill|stroke|divide)-(?:gray|slate|zinc|neutral|stone|white|black|amber|blue|green|red|orange|purple|pink|indigo|emerald|yellow|violet|rose|teal|cyan|sky|lime|fuchsia)(?:-\d{2,3})?\b/
const RADIUS = /\brounded(?:-[a-z0-9[\]]+)?\b/
const SHADOW = /\bshadow(?:-[a-z0-9[\]]+)?\b/
// Двоеточие вплотную к классу: `md: string` — это аннотация типа у параметра
// с именем md, а не вариант Tailwind.
const BREAKPOINT = /\b(?:sm|md|lg|xl|2xl):(?=[a-z[-])/

const CATEGORIES = [
  ['palette', PALETTE],
  ['radius', RADIUS],
  ['shadow', SHADOW],
  ['breakpoint', BREAKPOINT],
] as const

/**
 * Файлы, ещё не перенесённые на терминальные токены.
 *
 * Это долг, а не разрешение. Каждая задача плана 2 удаляет отсюда свои
 * файлы ПЕРЕД тем, как их править, — тест краснеет, правка делает его
 * зелёным. К концу плана здесь должно остаться `{}`.
 *
 * Тест падает в обе стороны: и на новом нарушении в чистом файле, и на
 * записи, которая устарела после того, как файл починили.
 */
const BASELINE: Record<string, readonly string[]> = {
  'components/calendar/DayView.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'components/calendar/MonthView.tsx': ['breakpoint', 'palette', 'radius'],
  'components/calendar/WeekView.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'components/layout/AppShell.tsx': ['breakpoint'],
  'components/layout/SidebarBoardTree.tsx': ['palette', 'radius'],
  'components/layout/TelegramSettingsModal.tsx': ['palette', 'radius'],
  'components/reports/ReportAccordion.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'components/reports/ReportContent.tsx': ['breakpoint'],
  'components/reports/ReportStatusBadge.tsx': ['palette', 'radius'],
  'components/reports/ThinkingIndicator.tsx': ['palette'],
  'components/stats/DailyBarsMicro.tsx': ['palette', 'radius', 'shadow'],
  'components/stats/HabitsWeekGrid.tsx': ['palette', 'radius', 'shadow'],
  'components/stats/KpiCard.tsx': ['palette', 'radius', 'shadow'],
  'components/stats/PeakHoursStrip.tsx': ['palette', 'radius'],
  'components/stats/StatsPeriodView.tsx': ['breakpoint', 'palette', 'radius'],
  'components/stats/StatsWeekView.tsx': ['breakpoint', 'palette', 'radius'],
  'components/stats/WeekNavigator.tsx': ['breakpoint', 'palette', 'radius'],
  'components/stats/WeekReportBody.tsx': ['palette', 'radius'],
  'components/tasks/BacklogTaskRow.tsx': ['palette', 'radius'],
  'components/tasks/ProjectChip.tsx': ['palette', 'radius'],
  'components/tasks/TagBadge.tsx': ['palette', 'radius'],
  'components/tasks/TagBadgeGroup.tsx': ['palette', 'radius'],
  'components/tasks/TaskCard.tsx': ['palette', 'radius', 'shadow'],
  'components/tasks/TaskModal.tsx': ['breakpoint', 'palette', 'radius'],
  'components/today/QuickAddIcons.tsx': ['palette', 'radius'],
  'components/ui/ConfirmModal.tsx': ['palette'],
  'components/ui/DurationClock.tsx': ['palette', 'radius', 'shadow'],
  'components/ui/ErrorBoundary.tsx': ['palette', 'radius'],
  'components/ui/Modal.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'components/ui/RowMenu.tsx': ['palette', 'radius'],
  'components/ui/Spinner.tsx': ['palette', 'radius'],
  'components/ui/ThemePicker.tsx': ['shadow'],
  'components/ui/TimeField.tsx': ['palette', 'radius', 'shadow'],
  'components/ui/TimePicker.tsx': ['palette', 'radius'],
  'components/ui/TimeRangeInput.tsx': ['palette'],
  'pages/AdminPage.tsx': ['breakpoint', 'palette', 'radius'],
  'pages/CalendarPage.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'pages/ExportPage.tsx': ['breakpoint', 'palette', 'radius'],
  'pages/HabitsPage.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'pages/NotificationsPage.tsx': ['palette'],
  'pages/TasksPage.tsx': ['palette'],
  'pages/TodayPage.tsx': ['breakpoint', 'palette', 'radius'],
  'pages/TodoListPage.tsx': ['palette', 'radius', 'shadow'],
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (/\.test\.tsx?$/.test(full)) return []
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

/**
 * Комментарии не разметка: строка «box-shadow глушится спеком» — это проза
 * о запрете, а не нарушение. Сканируем только код.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function offendersByFile(): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const file of sourceFiles(SRC)) {
    const source = stripComments(readFileSync(file, 'utf8'))
    const hits = CATEGORIES.filter(([, re]) => re.test(source)).map(([name]) => name)
    if (hits.length) found[relative(SRC, file)] = hits.slice().sort()
  }
  return found
}

describe('legacy tailwind classes', () => {
  it('matches the recorded baseline exactly, in both directions', () => {
    expect(offendersByFile()).toEqual(BASELINE)
  })

  it('no dark: variant survives in a file already migrated', () => {
    const migrated = sourceFiles(SRC).filter((f) => !(relative(SRC, f) in BASELINE))
    const withDark = migrated
      .filter((f) => /\bdark:/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
    expect(withDark).toEqual([])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL on the first assertion — the received object carries an extra
`'pages/LoginPage.tsx': ['radius']` that `BASELINE` does not.

- [ ] **Step 4: Clean LoginPage**

In `frontend/src/pages/LoginPage.tsx`, the logo wrapper is the only offender. Drop `rounded-2xl` from its `className`, and while the file is open drop the two constructs the spec bans outright — the `boxShadow` and the hardcoded smoke-glass `#eaffb0` in the gradient:

```tsx
          <div
            className="inline-flex items-center justify-center w-16 h-16 mb-4"
            style={{ background: 'var(--accent)' }}
          >
```

- [ ] **Step 5: Shrink the inline-styles baseline to match**

`pages/LoginPage.tsx` no longer has a `boxShadow`, so `src/styles/inline-styles.test.ts` now has a stale entry and fails in the other direction. Delete this line from its `BASELINE`:

```ts
  'pages/LoginPage.tsx': ['boxShadow'],
```

- [ ] **Step 6: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

Expected: all suites pass, `vite build` succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles/legacy-classes.test.ts frontend/src/pages/LoginPage.tsx \
        frontend/src/styles/inline-styles.test.ts frontend/tailwind.config.js
git commit -m "test: record the legacy-class debt, and clear Login off it"
```

---

### Task 2: Shared UI primitives

Every screen renders these, so they migrate before any screen does — otherwise each screen task would keep re-reporting the same dirty modal and the baseline could never shrink cleanly.

**Files:**
- Modify: `frontend/src/components/ui/Modal.tsx`
- Modify: `frontend/src/components/ui/ConfirmModal.tsx`
- Modify: `frontend/src/components/ui/RowMenu.tsx`
- Modify: `frontend/src/components/ui/Spinner.tsx`
- Modify: `frontend/src/components/ui/ErrorBoundary.tsx`
- Modify: `frontend/src/components/ui/TimeField.tsx`
- Modify: `frontend/src/components/ui/TimePicker.tsx`
- Modify: `frontend/src/components/ui/TimeRangeInput.tsx`
- Modify: `frontend/src/components/ui/DurationClock.tsx`
- Modify: `frontend/src/components/layout/TelegramSettingsModal.tsx`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: the Tailwind colour keys added in Task 1.
- Produces: nothing new. Component props and exports are unchanged — this task must not alter a single signature.

- [ ] **Step 1: Delete the ten files from the baseline**

In `src/styles/legacy-classes.test.ts`, remove these entries from `BASELINE`:

```ts
  'components/layout/TelegramSettingsModal.tsx': ['palette', 'radius'],
  'components/ui/ConfirmModal.tsx': ['palette'],
  'components/ui/DurationClock.tsx': ['palette', 'radius', 'shadow'],
  'components/ui/ErrorBoundary.tsx': ['palette', 'radius'],
  'components/ui/Modal.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'components/ui/RowMenu.tsx': ['palette', 'radius'],
  'components/ui/Spinner.tsx': ['palette', 'radius'],
  'components/ui/TimeField.tsx': ['palette', 'radius', 'shadow'],
  'components/ui/TimePicker.tsx': ['palette', 'radius'],
  'components/ui/TimeRangeInput.tsx': ['palette'],
```

Leave `components/ui/ThemePicker.tsx` in place — Task 13 decides whether that file lives at all, and restyling a file that may be deleted is waste.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL, received carries ten entries `BASELINE` no longer has.

- [ ] **Step 3: Apply the substitution table to all ten files**

Work file by file against the table in Global Constraints. Rules that decide the cases the table does not spell out:

- `Modal.tsx`'s `sm:` prefixes are width constraints on the dialog panel. Replace `sm:max-w-lg` and friends with an unprefixed `max-w-lg`; the mobile pass in plan 3 owns the small-screen behaviour and will add the one 900px rule.
- `Spinner.tsx`'s `rounded-full` is load-bearing — it draws a circle, not a rounded box. Replace the class with `style={{ borderRadius: '50%' }}` and add `components/ui/Spinner.tsx: ['borderRadius']` to `inline-styles.test.ts`'s `BASELINE`. A circle is the one shape `--radius: 0` is not talking about.
- `DurationClock.tsx` and `TimePicker.tsx` render arcs and dials from inline SVG. `fill-*`/`stroke-*` palette classes there become `fill="var(--accent)"` / `stroke="var(--line)"` attributes — SVG presentation attributes, not Tailwind.
- `ErrorBoundary.tsx` prints an error message: `text-danger`, never a decorative tier.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

Expected: all suites pass. If `inline-styles.test.ts` fails on `Spinner.tsx`, the baseline line from Step 3 is missing.

- [ ] **Step 5: Verify both themes by eye**

```bash
cd frontend && npm run dev
```

Open a task modal, a confirm dialog, a row context menu and the Telegram settings modal in dark, then toggle to light from the sidebar. Nothing may render unstyled, and no panel may keep a visible corner radius.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui frontend/src/components/layout/TelegramSettingsModal.tsx \
        frontend/src/styles/legacy-classes.test.ts frontend/src/styles/inline-styles.test.ts
git commit -m "style(ui): move shared primitives onto terminal tokens"
```

---

### Task 3: Today

The spec's step 3 starts here. Today owns the largest single page file (103 palette
usages) and shares its row furniture with Tasks, so the shared `components/tasks/*`
row parts migrate with it.

**Files:**
- Modify: `frontend/src/pages/TodayPage.tsx`
- Modify: `frontend/src/components/today/QuickAddIcons.tsx`
- Modify: `frontend/src/components/tasks/TaskCard.tsx`
- Modify: `frontend/src/components/tasks/BacklogTaskRow.tsx`
- Modify: `frontend/src/components/tasks/ProjectChip.tsx`
- Modify: `frontend/src/components/tasks/TagBadge.tsx`
- Modify: `frontend/src/components/tasks/TagBadgeGroup.tsx`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: the migrated primitives from Task 2.
- Produces: nothing new. No prop or export changes.

- [ ] **Step 1: Delete the seven files from the baseline**

```ts
  'components/tasks/BacklogTaskRow.tsx': ['palette', 'radius'],
  'components/tasks/ProjectChip.tsx': ['palette', 'radius'],
  'components/tasks/TagBadge.tsx': ['palette', 'radius'],
  'components/tasks/TagBadgeGroup.tsx': ['palette', 'radius'],
  'components/tasks/TaskCard.tsx': ['palette', 'radius', 'shadow'],
  'components/today/QuickAddIcons.tsx': ['palette', 'radius'],
  'pages/TodayPage.tsx': ['breakpoint', 'palette', 'radius'],
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL with seven extra entries.

- [ ] **Step 3: Apply the substitution table**

Screen-specific decisions:

- Rows use the existing `.row` class from `globals.css` and are `--row-h` (28px) tall. Where `TaskCard`/`BacklogTaskRow` set their own padding to fake a row height, delete it and let `.row` own the metric.
- `TagBadge` and `ProjectChip` carry **user-chosen** colours from the database (`tag.color`, `board.color`). Those stay as inline `backgroundColor` — they are data, not design. Only the surrounding chrome (`rounded-full`, `shadow`, gray borders) is migrated.
- Task titles truncate at 50 characters (commit `14c5821`). JetBrains Mono is wider than Inter, so verify at 1440px that the truncation point still fits its column; if it overflows, lower the constant rather than shrinking the font.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 5: Verify drag-and-drop still lands correctly**

The spec calls this out: the branch carries ~15 `fix(dnd)` commits that exist only because `backdrop-filter` created a containing block. With blur gone, try removing the workarounds in this page's DnD path — the `DragOverlay` body portal, the stable-position/GPU-layer hack, the `opacity: 0` sibling mask — then drag a task between sections at 1440px. Keep a workaround **only** if dropping it visibly regresses. Removing them blind is as wrong as keeping them blind.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TodayPage.tsx frontend/src/components/today \
        frontend/src/components/tasks frontend/src/styles/legacy-classes.test.ts
git commit -m "style(today): move Today and shared task rows onto terminal tokens"
```

---

### Task 4: Tasks

**Files:**
- Modify: `frontend/src/pages/TasksPage.tsx`
- Modify: `frontend/src/pages/TodoListPage.tsx`
- Modify: `frontend/src/components/tasks/TaskModal.tsx`
- Modify: `frontend/src/components/layout/SidebarBoardTree.tsx`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: the migrated row furniture from Task 3.
- Produces: nothing new.

- [ ] **Step 1: Delete the four files from the baseline**

```ts
  'components/layout/SidebarBoardTree.tsx': ['palette', 'radius'],
  'components/tasks/TaskModal.tsx': ['breakpoint', 'palette', 'radius'],
  'pages/TasksPage.tsx': ['palette'],
  'pages/TodoListPage.tsx': ['palette', 'radius', 'shadow'],
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL with four extra entries.

- [ ] **Step 3: Apply the substitution table**

`TaskModal.tsx` is the single dirtiest file in the tree (165 palette usages, 18 radii). It is a form: labels are `text-fg-body`, help text `text-fg-mid`, validation errors `text-danger`, section separators `border-line-soft`. Its lone `sm:` prefix is a panel width — unprefix it, as in Task 2.

`TodoListPage.tsx` is the `/list/:boardId` view. It is a real, routed screen even though the spec's nine-screen list does not name it; it migrates here because it shares every row component with Tasks.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 5: Verify drag-and-drop on the board**

Same procedure as Task 3 Step 5, on the Tasks board: drop the blur-era workarounds, drag a card between columns at 1440px, keep only what a visible regression justifies.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TasksPage.tsx frontend/src/pages/TodoListPage.tsx \
        frontend/src/components/tasks/TaskModal.tsx \
        frontend/src/components/layout/SidebarBoardTree.tsx \
        frontend/src/styles/legacy-classes.test.ts
git commit -m "style(tasks): move Tasks, the list view and the task modal onto terminal tokens"
```

---

### Task 5: Habits

**Files:**
- Modify: `frontend/src/pages/HabitsPage.tsx`
- Modify: `frontend/src/components/stats/HabitsWeekGrid.tsx`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: the migrated primitives from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Delete the two files from the baseline**

```ts
  'components/stats/HabitsWeekGrid.tsx': ['palette', 'radius', 'shadow'],
  'pages/HabitsPage.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL with two extra entries.

- [ ] **Step 3: Apply the substitution table**

Habits renders recharts. recharts reads colour from JS props, where `var(--…)` does
not resolve inside SVG attributes — so axis, grid and tooltip colours must come from
`useTheme()`'s palette object, not from a CSS variable string. `ThemeContext` already
imports `DARK`/`LIGHT` from `tokens.ts` for exactly this reason; use those values.

The habit heat-grid cells at `HabitsPage.tsx:355` carry `rounded-[2px]`, which is inert
now that `borderRadius` is a disabled core plugin. Delete the class: the spec's
inherited item 3 records it as reading like intent when it does nothing.

Habit colours themselves are user data (`habit.color`) — leave them inline, as with tags.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 5: Verify both themes**

Toggle dark→light on the Habits screen. The recharts axes and tooltip must change with
it; if they stay dark in light theme, they are still reading a stale palette snapshot
rather than `useTheme()`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/HabitsPage.tsx frontend/src/components/stats/HabitsWeekGrid.tsx \
        frontend/src/styles/legacy-classes.test.ts
git commit -m "style(habits): move Habits onto terminal tokens, drop the inert radius"
```

---

### Task 6: Calendar

**Files:**
- Modify: `frontend/src/pages/CalendarPage.tsx`
- Modify: `frontend/src/components/calendar/DayView.tsx`
- Modify: `frontend/src/components/calendar/WeekView.tsx`
- Modify: `frontend/src/components/calendar/MonthView.tsx`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: the migrated primitives from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Delete the four files from the baseline**

```ts
  'components/calendar/DayView.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'components/calendar/MonthView.tsx': ['breakpoint', 'palette', 'radius'],
  'components/calendar/WeekView.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'pages/CalendarPage.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL with four extra entries.

- [ ] **Step 3: Apply the substitution table**

Calendar carries 26 of the tree's breakpoint prefixes — the most of any screen. They
are column-count switches on the week and month grids. Collapse each to the desktop
arm now (the `md:`/`lg:` value, not the base one) and leave a single unprefixed rule;
plan 3 adds the one 900px media query that restores the narrow arm.

Grid cell separation uses lumen's pattern from the spec: `display: grid` with
`border-right: 1px solid var(--line)` per cell and `:last-child { border-right: 0 }`.
Do not draw cell borders on all four sides — doubled 1px lines read as 2px and are the
main way a terminal grid looks wrong.

Today's date marker must not rely on a decorative tier: `text-accent`, or an inverted
`bg-accent text-bg` cell.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 5: Verify all three views**

Day, week and month at 1440px in both themes. Check that the current-time line in
`DayView` is still visible against the new background, and that month cells with many
tasks still clip rather than overflow their row.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/CalendarPage.tsx frontend/src/components/calendar \
        frontend/src/styles/legacy-classes.test.ts
git commit -m "style(calendar): move day/week/month onto terminal tokens and the grid-line pattern"
```

---

### Task 7: Stats

**Files:**
- Modify: `frontend/src/components/stats/StatsPeriodView.tsx`
- Modify: `frontend/src/components/stats/StatsWeekView.tsx`
- Modify: `frontend/src/components/stats/WeekNavigator.tsx`
- Modify: `frontend/src/components/stats/WeekReportBody.tsx`
- Modify: `frontend/src/components/stats/KpiCard.tsx`
- Modify: `frontend/src/components/stats/DailyBarsMicro.tsx`
- Modify: `frontend/src/components/stats/PeakHoursStrip.tsx`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: the migrated primitives from Task 2; the recharts-reads-JS-colour rule established in Task 5.
- Produces: nothing new.

- [ ] **Step 1: Delete the seven files from the baseline**

```ts
  'components/stats/DailyBarsMicro.tsx': ['palette', 'radius', 'shadow'],
  'components/stats/KpiCard.tsx': ['palette', 'radius', 'shadow'],
  'components/stats/PeakHoursStrip.tsx': ['palette', 'radius'],
  'components/stats/StatsPeriodView.tsx': ['breakpoint', 'palette', 'radius'],
  'components/stats/StatsWeekView.tsx': ['breakpoint', 'palette', 'radius'],
  'components/stats/WeekNavigator.tsx': ['breakpoint', 'palette', 'radius'],
  'components/stats/WeekReportBody.tsx': ['palette', 'radius'],
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL with seven extra entries.

- [ ] **Step 3: Apply the substitution table**

`StatsPeriodView.tsx` holds 107 palette usages, second only to `TaskModal`. Its KPI
row is the spec's multi-column `stat-row`: `display: grid`, `border-right` per cell,
`:last-child { border-right: 0 }` — the `.stat-row`/`.stat-cell` classes already exist
in `globals.css`, so use them instead of re-deriving the layout in Tailwind.

Numbers in a KPI tile are the whole point of the screen and may never sit at `--dim`
or below. Labels under them may.

Two files here are in `inline-styles.test.ts`'s baseline for `boxShadow`
(`HabitsWeekGrid` — already handled in Task 5 — and `WeekReportBody`) and one for
`borderRadius` (`StatsPeriodView`, a recharts tooltip). Clear all three inline
violations as you go and delete their lines from that baseline too; the spec's
inherited item 2 requires that file to reach `{}`.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/stats frontend/src/styles/legacy-classes.test.ts \
        frontend/src/styles/inline-styles.test.ts
git commit -m "style(stats): move the stats screens onto terminal tokens and the grid-cell pattern"
```

---

### Task 8: Notifications and the weekly report

**Files:**
- Modify: `frontend/src/pages/NotificationsPage.tsx`
- Modify: `frontend/src/components/reports/ReportAccordion.tsx`
- Modify: `frontend/src/components/reports/ReportContent.tsx`
- Modify: `frontend/src/components/reports/ReportStatusBadge.tsx`
- Modify: `frontend/src/components/reports/ThinkingIndicator.tsx`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: the migrated primitives from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Delete the five files from the baseline**

```ts
  'components/reports/ReportAccordion.tsx': ['breakpoint', 'palette', 'radius', 'shadow'],
  'components/reports/ReportContent.tsx': ['breakpoint'],
  'components/reports/ReportStatusBadge.tsx': ['palette', 'radius'],
  'components/reports/ThinkingIndicator.tsx': ['palette'],
  'pages/NotificationsPage.tsx': ['palette'],
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL with five extra entries.

- [ ] **Step 3: Apply the substitution table**

`ReportStatusBadge` maps the `pending`/`in_progress`/`done`/`error` FSM to colour. Use
`text-fg-mid` / `text-accent` / `text-success` / `text-danger` in that order — all four
are readable tiers, which matters because the badge is the only place the status is
stated.

Commit `bbf6d08` already stripped the decorative chrome from the weekly summary, so
`ReportContent.tsx` is down to two breakpoint prefixes. Collapse them to the desktop arm.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 5: Verify a report renders**

Open Notifications and expand a generated weekly report. The markdown body uses
`.markdown-preview` from `globals.css`, which plan 1 already migrated — confirm the
accordion chrome around it now matches rather than fighting it.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/NotificationsPage.tsx frontend/src/components/reports \
        frontend/src/styles/legacy-classes.test.ts
git commit -m "style(reports): move Notifications and the weekly report onto terminal tokens"
```

---

### Task 9: Admin

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: the migrated primitives from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Delete the file from the baseline**

```ts
  'pages/AdminPage.tsx': ['breakpoint', 'palette', 'radius'],
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL with one extra entry.

- [ ] **Step 3: Apply the substitution table**

Admin carries 19 breakpoint prefixes on a user table. Collapse to the desktop arm: a
`display: grid` with `border-right` cells, per the spec's multi-column pattern. Plan 3
turns it into stacked cards below 900px.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AdminPage.tsx frontend/src/styles/legacy-classes.test.ts
git commit -m "style(admin): move the admin table onto terminal tokens"
```

---

### Task 10: Decide Export, and ThemePicker

The spec's inherited items 4, 5 and 6: two files with no way in, and two routes with
no file behind them. `ExportPage.tsx` has no
route in `App.tsx`; `ThemePicker.tsx` has no call site because `Sidebar` calls
`useTheme().toggle()` directly. The spec is explicit that three plans of drift is how
orphans become permanent, so this task ends with each one either reachable or gone.

**Files:**
- Modify: `frontend/src/App.tsx` *(only if Export is kept)*
- Delete or Modify: `frontend/src/pages/ExportPage.tsx`
- Delete or Modify: `frontend/src/components/ui/ThemePicker.tsx`
- Modify: `CLAUDE.md`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: either an `/export` route in `App.tsx`, or the absence of both files. Later tasks assume neither exists unless this one wired them.

- [ ] **Step 1: Decide, and record the decision**

The backend keeps `GET /api/export/tasks` and `GET /api/export/stats`, so the feature
works — only the screen is unreachable. Default to **deleting both files**: an unrouted
page and an uncalled component are dead weight, and the export endpoints stay callable.
Keep `ExportPage` only if the human partner says Export is a feature they want back, in
which case add `<Route path="/export" element={<ExportPage />} />` to `App.tsx` and
restyle it under the substitution table like any other screen.

Whichever way it goes, `CLAUDE.md` currently documents both as orphans — update that
paragraph to match reality.

- [ ] **Step 2: Decide the two legacy redirects**

Inherited item 6: `App.tsx:56` redirects `/boards` → `/today` and `App.tsx:60`
redirects `/kanban` → `/tasks`, with no page component behind either. `App.tsx:61`
also maps `/kanban/:boardId` through `ListPageRedirect` to the list view.

Redirects are cheap and they keep old bookmarks and any Telegram deep links working,
so the default here is the opposite of Step 1's: **keep them**, and add a one-line
comment saying they are compatibility shims with no page behind them, so the next
reader does not go looking for `BoardsPage.tsx`. Delete them only if the human partner
confirms no external link points at either path.

- [ ] **Step 3: Delete the baseline entries for whatever you deleted**

If both files are deleted, remove:

```ts
  'components/ui/ThemePicker.tsx': ['shadow'],
  'pages/ExportPage.tsx': ['breakpoint', 'palette', 'radius'],
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL — if you deleted the files, the baseline still names files that no
longer exist; if you kept them, they still carry legacy classes.

- [ ] **Step 5: Carry out the decision, then verify green**

```bash
cd frontend && npm test && npm run build
```

`tsc` is the gate for deletion: it fails on any surviving import of a deleted module.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: resolve the ExportPage and ThemePicker orphans"
```

---

### Task 11: AppShell and the desktop layout

The last file in the baseline, and the one that makes the screens sit correctly next to
each other.

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/styles/globals.css`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: every migrated screen.
- Produces: `.ts-shell__main` as a flat `--bg` surface with `border-left: 1px solid var(--line)`, which plan 3's mobile pass overrides at 900px.

- [ ] **Step 1: Delete the last entry from the baseline**

```ts
  'components/layout/AppShell.tsx': ['breakpoint'],
```

`BASELINE` is now `{}`. Leave the constant in place — an empty baseline that fails in
both directions is exactly the regression guard the rest of the app needs.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL with one extra entry.

- [ ] **Step 3: Flatten the main surface**

In `globals.css`, `.ts-shell__main` becomes a flat `--bg` surface with
`border-left: 1px solid var(--line)`. `AppShell.tsx`'s two breakpoint prefixes collapse
to the desktop arm.

- [ ] **Step 4: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

Expected: `legacy-classes.test.ts` passes with an empty baseline. Every screen is now
on the tokens.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/AppShell.tsx frontend/src/styles/globals.css \
        frontend/src/styles/legacy-classes.test.ts
git commit -m "style(shell): flatten the main surface, empty the legacy-class baseline"
```

---

### Task 12: Focus rings

The spec's inherited item 1, and the reason it was deferred rather than deleted:
Tailwind's `ringWidth`/`ringColor` core plugins emit `box-shadow`, which the spec bans
— but deleting the rings with nothing in their place is an accessibility regression,
not a cosmetic one. Now that every screen is migrated, they can be swapped in one pass.

**Files:**
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/tailwind.config.js`
- Modify: the eight component files that still carry `ring-*` / `focus:ring-*`
- Test: `frontend/src/styles/legacy-classes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a `:focus-visible` border-swap rule in `globals.css` that every focusable control inherits.

- [ ] **Step 1: Write the failing test**

Add to `src/styles/legacy-classes.test.ts`:

```ts
  it('no ring utility survives — they emit box-shadow', () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => /\b(?:focus:|focus-visible:|hover:)?ring(?:-[a-z0-9[\]/-]+)?\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
    expect(offenders).toEqual([])
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL listing the eight files that still use ring utilities.

- [ ] **Step 3: Add the border-swap focus rule**

In `globals.css`:

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}
```

`outline` is used rather than `border` so focus never changes an element's box size —
a border swap on a 28px row would shift every neighbour by a pixel.

- [ ] **Step 4: Strip the ring utilities and disable the core plugins**

Delete every `ring-*`, `focus:ring-*`, `ring-offset-*` class from the eight files. Then
in `tailwind.config.js` add to `corePlugins`, alongside the four already disabled:

```js
    ringWidth: false,
    ringColor: false,
    ringOffsetWidth: false,
    ringOffsetColor: false,
```

- [ ] **Step 5: Run the tests and the build to verify green**

```bash
cd frontend && npm test && npm run build
```

- [ ] **Step 6: Verify focus is visible by keyboard**

```bash
cd frontend && npm run dev
```

Tab through the login form, the sidebar nav and a task modal in both themes. Every stop
must show the accent outline. A control that takes focus invisibly is a failure of this
task, not a detail for later.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles/globals.css frontend/tailwind.config.js frontend/src \
        frontend/src/styles/legacy-classes.test.ts
git commit -m "a11y: swap tailwind focus rings for an outline, disable the ring plugins"
```

---

### Task 13: Clear the rest of the inherited list

The spec's inherited items 2, 7 and 8 — the cheap ones that were explicitly deferred to
«when the file is next open». Every file is now open.

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/styles/inline-styles.test.ts`
- Modify: `frontend/src/styles/legacy-classes.test.ts`
- Modify: `backend-node/src/reports/reports.service.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `inline-styles.test.ts`'s `BASELINE` is `{}` except for the deliberate `Spinner.tsx` circle from Task 2.

- [ ] **Step 1: Write the failing token test**

The spec's item 8: `tokens.test.ts` asserts colours come from `tokens.ts` by string
equality, which a hardcoded literal satisfies just as well. Add a scan that no source
file outside `tokens.ts` carries a raw hex colour. It goes in
`src/styles/legacy-classes.test.ts`, not `tokens.test.ts` — that is where the
`sourceFiles`/`SRC`/`relative` helpers this assertion needs already live:

```ts
  it('no hex literal outside the palette module', () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => !/styles\/tokens\.ts$/.test(f))
      .filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
    expect(offenders).toEqual([])
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/styles/legacy-classes.test.ts
```

Expected: FAIL, listing at least `App.tsx` — the toast config hardcodes `#1F2937` and
`#F9FAFB`.

- [ ] **Step 3: Fix the hex literals and the two indicator dots**

`App.tsx`'s toast options read their colours from `useTheme()`'s palette instead of hex
literals, and lose their `borderRadius`. `Sidebar.tsx`'s two 7px `'50%'` indicator dots
are circles — the same exemption `Spinner` got in Task 2: keep the inline
`borderRadius: '50%'` and record it in `inline-styles.test.ts`'s baseline rather than
squaring a dot.

Where a user-data colour (tag, board, habit) reaches a component as a hex string from
the API, that is data and not a literal — the test only scans source text, so no
exemption is needed.

- [ ] **Step 4: Shrink the inline-styles baseline**

`BASELINE` in `inline-styles.test.ts` should now be exactly the two deliberate circles:

```ts
const BASELINE: Record<string, readonly string[]> = {
  'components/layout/Sidebar.tsx': ['borderRadius'],
  'components/ui/Spinner.tsx': ['borderRadius'],
}
```

Update the comment above it: it currently says plan 2 must drive the list to `{}`, and
that is no longer the target — two circles are the permanent, justified remainder.

- [ ] **Step 5: Remove the dead backend DI**

The spec's item 7: `backend-node/src/reports/reports.service.ts:39` still injects
`ConfigService`, whose only consumer was the deleted `dailyTip()`. Drop the constructor
parameter and the import.

```bash
cd backend-node && npm test
```

Expected: PASS. If a spec file constructs `ReportsService` with a `ConfigService`
argument, trim that too — the spec says these tests are trimmed, never skipped.

- [ ] **Step 6: Run everything to verify green**

```bash
cd frontend && npm test && npm run build
cd ../backend-node && npm test
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src backend-node/src
git commit -m "chore: clear the deferred list — hex literals, dead DI, baseline down to two circles"
```

---

### Task 14: Desktop QA pass and CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: every preceding task.
- Produces: nothing. This is the gate before plan 3.

- [ ] **Step 1: Walk the spec's QA checklist at 1440px**

From the spec, the items this plan is responsible for:

- [ ] Both themes: no element renders unstyled or with a leftover radius/shadow
- [ ] No essential text (dates, counters, errors) rendered at `--dim` or below
- [ ] DnD on Today and Tasks: drop lands where released, no ghost frame
- [ ] `/budget` returns 404 in the SPA router; `GET /api/budget/*` still answers
- [ ] Weekly report renders with no section colour themes

The offline-font, `Ctrl+K`, palette and 375px items belong to plan 3 — do not check
them here.

- [ ] **Step 2: Update CLAUDE.md**

Correct anything this plan changed: the Pages paragraph if Export was deleted or routed,
and the theme description if `ThemePicker` is gone.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: sync CLAUDE.md with the screen pass"
```
