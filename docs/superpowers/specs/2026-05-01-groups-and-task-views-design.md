# Sidebar groups and merged task view — design

Date: 2026-05-01
Branch: `feature/backend-nestjs-port` (or a follow-up branch off this)

## Goal

Bring TimeScheduler's navigation closer to the Microsoft To-Do model:

1. Eliminate the separate `/projects` grid page. Boards (henceforth «списки») live directly in the sidebar.
2. Allow the user to organize lists into **groups** (one level of grouping; no nested groups).
3. Replace the «Запланированно»/«Задачи»-style filter pair with a single new top-level entry **«Задачи»** showing every non-archived, non-done task across every list, grouped by date (Просрочено / Сегодня / Завтра / Через N дней / Позднее / Отложенное).
4. Keep «Мой день» as today's curated entry (no behavioural change).
5. Keep all tracking features (Привычки / Статистика / Бюджет) at top-level visibility — non-negotiable.

## Non-goals

- Nested groups (group inside a group). Single level only.
- Dragging tasks across lists from the sidebar. The sidebar is for list/group navigation; task DnD across lists is out of scope.
- A «Важно» (starred) view. The user explicitly opted not to add it.
- Multi-user / sharing. App stays single-user.
- Mobile-specific gestures beyond what dnd-kit gives us.
- Migrating existing data (the user only has 3 boards; they all stay top-level on day one).

## UX summary

### Sidebar (final layout)

```
[user/avatar]                              # unchanged

ЗАДАЧИ
  ☀️ Мой день           N
  📋 Задачи             N

СПИСКИ
  📁 <top-level list>   N
  ▼ <group name>
      📁 <list>         N
      📁 <list>         N
  ▶ <collapsed group>
  + Список   + Группа

ПЛАНИРОВАНИЕ
  📆 Календарь

ТРЕКИНГ
  ✓ Привычки
  📊 Статистика
  💰 Бюджет

АРХИВ
  🔔 История
  ⚙️ Админ            # admin only

[search]                                   # unchanged, stays at bottom
[theme] [logout]                           # unchanged
```

Counts next to each entry are **open task counts** (`done = false`, `is_archived = false`), computed on the frontend from the existing `/api/tasks` payload. No new count endpoints. Per-entry count formula:

- **Мой день**: `tasks where my_day=true OR scheduled_start in today OR deadline in today`.
- **Задачи**: total open tasks.
- **<list>**: open tasks with `board_id = <list.id>`.
- Group headers themselves: no count (sum is implied by the lists below).

### Pages

| Path | What it shows | Notes |
|---|---|---|
| `/today` | Today's tasks (scheduled today + deadline today + my_day) + habits + pet + quick-add | The bottom date-sections that exist today are **moved** to `/tasks`. The «Просрочено» tab is also moved to `/tasks` (where it becomes the first section). |
| `/tasks` | All open tasks grouped by date with sections: Просрочено / Сегодня / Завтра / Через N / Позднее / Отложенное | New page. Reuses date-section logic via a shared hook. |
| `/list/:id` | Tasks of one list. (Renamed from `/project/:id`; component `TodoListPage` unchanged.) | Legacy `/project/:id` redirects here. |
| `/calendar/*`, `/habits`, `/stats`, `/budget`, `/notifications`, `/admin` | Unchanged. | |
| ~~`/projects`~~ | **Removed.** Redirects to `/today`. | `BoardsPage.tsx` is deleted. |
| ~~`/project`, `/project/:id`~~ | Redirected to `/tasks` and `/list/:id` respectively. | The «Входящие» pseudo-list goes away — tasks without a list are visible in `/tasks` like any other. |

### Sidebar interactions

| Action | UX |
|---|---|
| Click list/group entry | Navigate. Entry highlighted. |
| Expand/collapse group | Click group header. State persisted in localStorage per group id. |
| `+ Список` | Modal: name + optional group selector. |
| `+ Группа` | Inline input appears in place of the «+ Группа» button. Esc cancels, Enter saves. Empty name rejected. |
| Rename list/group | Double-click name OR `…`-menu → «Переименовать» → inline input. Esc cancels, Enter saves. |
| Delete list | `…`-menu → «Удалить» → confirm modal. Tasks become `board_id = null` (visible in `/tasks`). |
| Delete group | `…`-menu → «Удалить» → modal with radio: (a) «Перенести списки наверх» (default) — `ON DELETE SET NULL` does the work, (b) «Удалить вместе со списками» — backend `DELETE /api/board-groups/:id?cascade=true`. |
| Drag list inside its group | Reorder. Bulk PATCH `/api/boards/reorder`. |
| Drag list to another group | Single PATCH `/api/boards/:id { group_id, sort_order }`. |
| Drag list out (drop in top-level zone) | PATCH `/api/boards/:id { group_id: null, sort_order }`. |
| Drag group | Reorder. Bulk PATCH `/api/board-groups/reorder`. |

DnD lib: existing `@dnd-kit/core` (already a dependency for the kanban code in `KanbanPage.tsx` / `TodoListPage.tsx`).

## Data model

### New table

```prisma
model BoardGroup {
  id         Int      @id @default(autoincrement())
  user_id    Int
  name       String   @db.VarChar(100)
  sort_order Int      @default(0)
  created_at DateTime @default(now()) @db.Timestamptz(6)
  updated_at DateTime @default(now()) @db.Timestamptz(6)
  users      User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  boards     Board[]

  @@index([user_id, sort_order], map: "ix_board_groups_user_order")
  @@map("board_groups")
}
```

Note the use of `@default(now())` rather than the frozen `dbgenerated("'2026-...'")` literals seen on legacy tables. The frozen-literal convention is documented in `CLAUDE.md` as zero-drift mirroring of legacy SQLAlchemy `server_default="now()"` output for tables that *already exist in the live DB*. New tables don't need to mirror anything, so `now()` is the correct, future-proof choice.

### `Board` changes

Add two columns:

```prisma
model Board {
  // ...existing fields...
  group_id   Int?
  sort_order Int         @default(0)
  group      BoardGroup? @relation(fields: [group_id], references: [id], onDelete: SetNull)
  // ...
  @@index([user_id, group_id, sort_order], map: "ix_boards_user_group_order")
}
```

`onDelete: SetNull` is what powers the «Перенести списки наверх» path of group deletion — no manual SQL needed.

### `User` change

Append the back-relation:

```prisma
board_groups BoardGroup[]
```

### Migration

Single migration: `npx prisma migrate dev --name add_board_groups`.

- New table `board_groups`.
- Two new columns on `boards` (`group_id`, `sort_order`) with defaults that cover existing rows (NULL and 0). Zero-data backfill.
- One new compound index on `boards`.

Rollback path: down-migration drops the table, drops the columns. Old client never read those fields, so no breaking change for rollback either.

## API

New module under `backend-node/src/board-groups/`:

| Method | Path | Body / query | Notes |
|---|---|---|---|
| `GET` | `/api/board-groups` | — | Returns `BoardGroupResponseDto[]`, sorted by `sort_order ASC, id ASC`. |
| `POST` | `/api/board-groups` | `{name}` | Validates name (1–100 chars). |
| `PATCH` | `/api/board-groups/:id` | `{name?}` | Rename. Cross-user → 404. |
| `DELETE` | `/api/board-groups/:id` | `?cascade=false` (default) | `cascade=false`: rely on FK SET NULL on Board.group_id. `cascade=true`: explicit `prisma.board.deleteMany({ where: { group_id } })` first (cascades to tasks), then `prisma.boardGroup.delete`. Both wrapped in `prisma.$transaction`. |
| `PATCH` | `/api/board-groups/reorder` | `{ordered_ids: number[]}` | Bulk update of `sort_order` for the user's groups. Validates that every id belongs to the current user. |

Modified `boards`:

- `BoardResponseDto` += `group_id: number \| null`, `sort_order: number`.
- `BoardCreateDto` += optional `group_id`.
- `BoardUpdateDto` += optional `group_id`, `sort_order`.
- New endpoint `PATCH /api/boards/reorder` body `{ group_id: number | null, ordered_ids: number[] }`. Bulk reorder within a single (group | top-level) context.

All endpoints under `JwtAuthGuard`. Errors thrown via `HttpException` subclasses so `AllExceptionsFilter` returns the canonical `{detail: string}` shape — see CLAUDE.md «AllExceptionsFilter» note. Cross-user reads return 404 (not 403), matching the existing `BoardsService` pattern.

DTOs validated by `class-validator` per existing project convention (`@IsString`, `@MinLength`, `@MaxLength`, `@IsInt`, `@IsArray`).

## Frontend

### New files

- `frontend/src/types/boardGroup.ts` — types: `BoardGroup`, `BoardGroupCreate`, `BoardGroupUpdate`.
- `frontend/src/api/boardGroups.ts` — axios client. List / create / update / delete / reorder.
- `frontend/src/hooks/useBoardGroups.ts` — TanStack Query hooks: `useBoardGroups`, `useCreateGroup`, `useRenameGroup`, `useDeleteGroup`, `useReorderGroups`.
- `frontend/src/hooks/useTaskDateSections.ts` — extracted helper from `TodayPage`. Pure: `(tasks, todayStr) => { overdue, sections }`. Consumed by both `TodayPage` (today-row computation, since the existing logic feeds it) and `TasksPage`.
- `frontend/src/pages/TasksPage.tsx` — new merged view. Header «Задачи», quick-add at top, then sections.
- `frontend/src/components/tasks/BacklogTaskRow.tsx` — extracted from `TodayPage.tsx:240`. The function is currently local; `TasksPage` needs it too. Move into a shared component, re-import in `TodayPage`.
- `frontend/src/components/layout/SidebarBoardTree.tsx` — encapsulated subtree renderer: groups + lists, drag-and-drop, inline rename, context menu, expand/collapse with localStorage persistence.

### Changed files

- `frontend/src/components/layout/Sidebar.tsx` — section structure rewritten. Static "Задачи / Списки / Планирование / Трекинг / Архив" headings. The Списки section delegates to `<SidebarBoardTree/>`. The current «Поиск» block at the bottom stays.
- `frontend/src/pages/TodayPage.tsx` — bottom date-section block is removed (moved to `TasksPage`). The «Сегодня / Просрочено» tabs are also removed (overdue is the first section in `/tasks` now). Quick-add, today's tasks, habits, pet — unchanged.
- `frontend/src/App.tsx` — add `<Route path="/tasks" element={<TasksPage />}/>` and `<Route path="/list/:boardId" element={<TodoListPage />}/>`. Adjust the existing redirects so `/projects` → `/today` and `/project/:boardId` → `/list/:boardId`. Drop the import of `BoardsPage`.

### Deleted files

- `frontend/src/pages/BoardsPage.tsx`.
- `frontend/src/pages/KanbanPage.tsx` — already orphaned (not routed). Cleanup is in scope because we touch the projects/boards UX.

### Sidebar component shape

```
<Sidebar>
  ├─ <UserPanel/>
  ├─ <Section title="Задачи">
  │     ├─ <NavItem to="/today" icon="☀️" label="Мой день" count={…}/>
  │     └─ <NavItem to="/tasks" icon="📋" label="Задачи" count={…}/>
  ├─ <Section title="Списки">
  │     └─ <SidebarBoardTree/>          ← all the new logic
  ├─ <Section title="Планирование">
  │     └─ <NavItem to="/calendar/day" icon="📆" label="Календарь"/>
  ├─ <Section title="Трекинг">…</Section>
  ├─ <Section title="Архив">…</Section>
  └─ <SidebarFooter>                    ← search + theme + logout, unchanged
</Sidebar>
```

### `SidebarBoardTree` internals

Source of truth in cache: `useBoards()` and `useBoardGroups()`.

Render tree:

1. Top-level (no group): boards with `group_id = null`, ordered by `sort_order, id`.
2. Each group ordered by `sort_order, id`. Inside: boards with that `group_id`, ordered by `sort_order, id`.
3. «+ Список» and «+ Группа» actions at the bottom of the section.

DnD:

- One `DndContext` for the whole tree.
- Outer `SortableContext`: items are `{type: 'group' | 'top-level-board', id}`.
- Inner per-group `SortableContext`: items are board ids inside that group.
- `onDragEnd` reads `over.data.current` to know whether the drop target is in another group's container. Three scenarios:
  - Reorder within current container → `PATCH /api/boards/reorder` (or `/api/board-groups/reorder`).
  - Move list to a different group → `PATCH /api/boards/:id { group_id, sort_order }`.
  - Drop on a `dropZone` element placed at top of «Списки» → `PATCH /api/boards/:id { group_id: null, sort_order }`.
- Optimistic update: pre-compute new order in cache via `queryClient.setQueryData`. Roll back on error and toast «Не удалось переместить».
- Debounce: 200 ms — multiple quick drags collapse to one network call.

Inline rename / context menu:

- Right-click and three-dot button on hover both open the same popover (`rename`, `delete`).
- Rename swaps the row content with a controlled `<input>`. Submit on Enter or blur. Cancel on Escape.
- Delete fires the appropriate confirm modal (list vs group; group has the radio-choice version).

LocalStorage:

- Key `sidebar:group:<id>:open` = `'1' | '0'`. Default open. Removed entries are GC'd by reading + cleaning on `useBoardGroups` query success.

### `/tasks` page

Layout:

```
[H1: Задачи]
[Quick-add input — same component as TodayPage]
[Section: Просрочено (N)]
  …rows…
[Section: Сегодня (N)]
  …rows…
[Section: Завтра (N)]
  …rows…
[Section: Через N (N)]
  …rows…
[Section: Позднее]
  …rows…
[Section: Отложенное]
  …rows…
```

Each task row reuses the extracted `BacklogTaskRow` (see "New files" — moved out of `TodayPage` into `frontend/src/components/tasks/`). The component already supports «Add to my day» / open edit modal / toggle done. Quick-add is the existing `parseTaskInput` flow lifted from `TodayPage`. The row gets a small badge showing the list name (or «без списка»).

The list-name badge is a small extension to `BacklogTaskRow`: a new optional prop `listLabel?: string`. `TasksPage` passes the resolved list name; `TodayPage` doesn't pass it, so its rendering is unchanged.

## Drag-and-drop details

### Sensors

- `PointerSensor` with activation distance of 6 px (so a small misclick doesn't start drag).
- `KeyboardSensor` (a11y).
- `touch-action: none` only on the active drag handle, not the whole row, so vertical scroll on mobile keeps working.

### Optimistic update

```
onMutate: (variables) => {
  await queryClient.cancelQueries(['boards'])
  const previous = queryClient.getQueryData(['boards'])
  queryClient.setQueryData(['boards'], applyOrderLocally(previous, variables))
  return { previous }
},
onError: (_err, _vars, ctx) => queryClient.setQueryData(['boards'], ctx.previous) + toast,
onSettled: () => queryClient.invalidateQueries(['boards']),
```

Same pattern is used today for kanban reorder — no new infra.

## Testing

### Backend (NestJS, Jest)

- `board-groups.service.spec.ts` — unit:
  - create / list / rename / delete (cascade=false → boards survive with group_id=null) / delete (cascade=true → boards and tasks gone).
  - reorder applies sort_order in the order given.
  - cross-user access returns 404 on rename/delete/reorder.
- `boards.service.spec.ts` — extend:
  - Create with `group_id` succeeds; with foreign-user `group_id` fails 404.
  - Update sets `group_id` and `sort_order`.
  - `reorder` endpoint validates that all ids belong to (user, group_id) tuple before assigning order.
- `test/board-groups.e2e-spec.ts` — happy path: create group → create list in group → drag list to top-level (PATCH) → delete group with cascade=false → list survives at top-level.

### Frontend

The frontend has no test runner installed (no `vitest`, `jest`, or `@testing-library/*` in `frontend/package.json` as of this spec). Adding one for this slice would be scope creep. We rely on:

- **Type safety** (`tsc -b` runs in `npm run build`) — catches DTO/contract drift between the new API and the new hooks.
- **Manual QA** per the checklist below.

If we want a frontend test runner later, that's a separate, well-scoped initiative (add `vitest` + `@testing-library/react` + initial smoke tests).

### Manual QA checklist (post-implementation)

- Create a group, create two lists in it, drag one list out to top-level. Verify after refresh.
- Drag a list from one group to another. Verify after refresh.
- Reorder groups. Verify after refresh.
- Delete a group with «Перенести наверх». Verify lists survive.
- Delete a group with «Удалить вместе». Verify lists and their tasks are gone.
- Open `/tasks`, ensure overdue → today → tomorrow ordering is correct, list-name badges accurate.
- Open `/today`, ensure no date-sections at the bottom anymore (just today + habits + pet).
- Mobile: open sidebar via burger, expand/collapse a group, navigate to a list. Verify search dropdown still works.

## Risks and open questions

1. **dnd-kit nested SortableContexts.** The library supports them, but cross-context drops require careful `over.data.current` handling. If implementation reveals this is too fiddly, fallback is a flat-tree DnD with a virtual «group separator» item — slightly clunkier UX but simpler. Decision can be made during implementation.
2. **«Сегодня/Просрочено» tab removal from `/today`.** A regression from the user's perspective if they grew used to it. Mitigation: `/tasks` shows overdue as its first prominent section; the entry point is one click in the sidebar.
3. **Counts performance.** With «Задачи» showing every task, the `/api/tasks` payload size grows linearly with task count. For this single-user app's scale (<10⁴ tasks expected), this is fine. If it ever becomes an issue, paginate by date range.
4. **Inbox affordance.** Removing the «Входящие» pseudo-list means new users won't immediately see a place where their no-list tasks live. The «Задачи» entry covers the same ground but its label is more abstract. Acceptable — single user knows the app.

## Out-of-scope follow-ups

- Drag a task onto a list (sidebar) to assign it. Likely valuable but a separate cross-cutting DnD piece.
- Group icons / colours.
- Smart lists (tagged, filtered, saved searches) — would slot next to «Мой день» / «Задачи».
- Sharing / multi-user.
