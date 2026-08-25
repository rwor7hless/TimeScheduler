# Terminal redesign — design

Date: 2026-08-24
Branch: `feature/backend-nestjs-port`

## Goal

Replace the smoke-glass UI (spec `2026-04-22-smoke-glass-redesign-design.md`) with a
terminal aesthetic borrowed from the sibling project `lumen`
(`~/Documents/Github/time_manage`): monospace type, zero radii, hairline 1px grid,
no blur and no shadows.

Alongside the visual change, cut weight. TimeScheduler's frontend is 18 634 lines of
TS/TSX against lumen's 2 360 lines of JS. The target is «something between the two
projects» — the redesign is the occasion to delete what the app does not need.

Four decisions, taken with the user before this spec:

1. **Full replacement**, not an extra theme. Radii, shadows and `backdrop-filter` are
   baked into components; a theme cannot cancel them.
2. **Desktop-first with a real mobile mode.** An Android APK (Capacitor) is planned,
   so the mobile layout is the APK — not a degraded fallback.
3. **Cut the pet and the budget frontend.** Simplify the weekly summary screen.
4. **Take one interaction from lumen**: a `Ctrl+K` command palette. Nothing else.

This spec supersedes `2026-05-01-groups-and-task-views-design.md` on one point: that
spec called top-level visibility of «Привычки / Статистика / Бюджет» non-negotiable.
«Бюджет» is now removed from the frontend. «Привычки» and «Статистика» stay.

## Non-goals

- **Capacitor / APK packaging.** A follow-up project. This spec only avoids blocking
  it (local fonts, no CDN calls). No `capacitor.config.ts`, no Android project.
- **Dropping budget data.** The NestJS `budget` module (2 897 lines, 12 sub-dirs,
  2 cron jobs) and its 9 Prisma models stay untouched and reachable over the API.
  Only the frontend goes. The change is one revert away.
- **Copying lumen's storage model.** Postgres + Prisma stay; lumen's single JSON
  document is irrelevant here.
- **Copying lumen's terse quick-add syntax** (`!1 @завтра 18:00 #тег`). TimeScheduler's
  `src/utils/parseTask.ts` already parses natural Russian and is strictly richer.
- **Calendar mode reduction.** Day / week / month all survive.
- **Backend redesign.** Beyond removing the daily-tip endpoint, NestJS is untouched.

## Design tokens

Adapted from `time_manage/src/styles.css`. lumen ships dark only; light is derived.

> **Пересмотрено 2026-08-25.** Исходная гамма — почти чёрный фон с янтарным
> акцентом — читалась как чужой узнаваемый бренд, а не как инструмент. Оттенок
> сменён на угольно-фиолетовый с сиреневым акцентом; структура токенов, тиры и
> правило 4.5:1 не изменились. Значения ниже — действующие.

### Dark (default)
```
--bg          #131318
--bg-raised   #17171d
--bg-cell     #1b1b22
--bg-hover    #191920
--bg-sel      #232330
--line        #2a2a33
--line-soft   #1e1e26
--fg          #d8d6de
--fg-body     #b7b5c0
--mid         #8a8894
--dim         #6a6875
--muted       #4f4e59
--faint       #42414b
--accent      #a898e0
--red         #d0757e
--green       #7fb083
```

### Light (derived — inverted lightness, same hue family)
```
--bg          #f6f5f9
--bg-raised   #f1f0f6
--bg-cell     #eceaf3
--bg-hover    #ebe9f2
--bg-sel      #e0dcee
--line        #d5d2e0
--line-soft   #e6e3ee
--fg          #22212a
--fg-body     #3b3947
--mid         #66637a
--dim         #84819a
--muted       #a29fb4
--faint       #b8b5c6
--accent      #6247aa
--red         #a8434f
--green       #4a6f45
```

### Contrast

Measured against each theme's `--bg` (WCAG 2.1 relative luminance):

| token | dark | light |
|---|---|---|
| `--fg` | 12.87 | 14.67 |
| `--accent` | 7.26 | 6.45 |
| `--green` | 7.44 | 5.30 |
| `--mid` | 5.32 | 5.33 |
| `--red` | 5.76 | 5.40 |
| `--dim` | **3.39** | **3.46** |

Light `--accent` is deepened from `#a898e0` to `#6247aa`: the dark theme's lilac
measures 1.6:1 on paper.

`--dim`, `--muted` and `--faint` deliberately sit below 4.5:1 — the dim ladder is the
aesthetic. They are therefore
**decorative tiers**: no information may live *only* at that contrast. Concretely,
`.kicker` section headers are `--dim`, which is acceptable because they label a region
whose content is `--fg`; but a task's due date, a counter, or an error string must use
`--mid` or brighter. This is a review point for every screen in step 3.

### Structural tokens
```
--radius: 0
--row-h:  28px    /* desktop */  →  44px  /* <900px */
--fs:     13px    /* desktop */  →  14px  /* <900px */
--lh:     1.45
```

`box-shadow` and `backdrop-filter` are not used anywhere. Depth is expressed only by
`--bg-*` steps and 1px `--line` borders.

## Typography

**JetBrains Mono, bundled locally.** `frontend/src/styles/globals.css` line 1 is
currently `@import url('https://fonts.googleapis.com/css2?family=Inter...')`. That
request fails in an offline APK and the app falls back to a system font.

Copy `time_manage/src/fonts/JetBrainsMono-Variable.ttf` (300 KB, weights 100–800) to
`frontend/public/fonts/` and declare it with `@font-face` + `font-display: swap`.
Manrope and Fraunces are dropped from `tailwind.config.js`; `font-sans`, `font-display`
and `font-mono` all resolve to the same stack:

```
'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace
```

Section headers use lumen's `.kicker`: 11px, `letter-spacing: 0.1em`, uppercase,
`color: var(--dim)`, `border-bottom: 1px solid var(--line)`.

## Themes: 10 → 2

`frontend/src/context/ThemeContext.tsx` drops from 10 `ThemeMeta` entries to `dark`
and `light`. The **interface stays as-is** — `accent` / `accentLight` / `accentDark` /
`bg` / `surface` are read by recharts, where CSS custom properties do not resolve
inside SVG attributes.

`swatch` keeps its `[bg, surface, accent]` shape; `ThemePicker.tsx` becomes a two-way
toggle instead of a carousel.

`frontend/index.html` carries an inline pre-paint bootstrap with both theme lists
hardcoded (`VALID`, `DARK`). Both shrink to two and one entry respectively. Keep the
script inline and before `<body>` — it prevents a light flash on a dark-theme load.
`<meta name="theme-color">` changes from `#F8FAFC` to `#0b0c0c`.

## Deleted files

### Pet (~1 200 frontend + ~550 backend)
```
frontend/src/components/today/AsciiPet.tsx          911
frontend/src/components/today/PersonaPicker.tsx     142
frontend/src/data/personas.ts                        30
frontend/src/hooks/useDailyTip.ts                   145
backend-node/src/llm/prompts/pet-personas.prompt.ts      192
backend-node/src/llm/prompts/pet-personas.prompt.spec.ts  76
backend-node/src/llm/prompts/pet-tip.prompt.ts           161
backend-node/src/llm/prompts/pet-tip.prompt.spec.ts       54
```
Plus, by edit: `GET /reports/daily-tip` in `reports.controller.ts`; `dailyTip()`,
`DailyTipCacheEntry`, `dailyTipCache`, `clearDailyTipCache()`, `DailyTipResult` and
`DailyTipPersonaDto` in `reports.service.ts` (~150 lines); their cases in
`reports.controller.spec.ts` and `reports.service.spec.ts`; `getDailyTip` and
`DailyTipPersona` in `frontend/src/api/reports.ts`.

The `pet_tip_v2_*` and `pet_tip_override_v1_*` localStorage keys are orphaned. No
cleanup code — they expire by being unread, same as the `daily_tip_*` v1 keys already
left behind.

### Budget frontend (~3 600)
```
frontend/src/pages/BudgetPage.tsx                  1289
frontend/src/components/budget/                       9 files
frontend/src/hooks/useBudget.ts
frontend/src/hooks/useBudgetGoal.ts
frontend/src/api/budget.ts
frontend/src/types/budget.ts
frontend/src/utils/parseBudget.ts
```
Plus the `/budget` route in the router and its `Sidebar.tsx` nav entry.

### Weekly summary trim (~900)
```
frontend/src/components/stats/WeekHeroBand.tsx      170
frontend/src/components/stats/WeeklySpotlight.tsx   158
frontend/src/components/stats/WeekShareCard.tsx     275
frontend/src/components/stats/ShareWeekButton.tsx   169
frontend/src/components/stats/CompletionDonut.tsx    92
frontend/src/components/stats/AnimatedNumber.tsx     52
frontend/src/components/reports/sectionStyles.ts
frontend/src/components/reports/ReportIcons.tsx      91
```

`sectionStyles.ts` assigns each of the weekly report's 7 LLM sections its own colour
theme — gradient underline, round icon chip, coloured bold, tinted row background.
That is the single most anti-terminal artifact in the codebase. `ReportContent.tsx`
survives but renders sections as plain monospace under a `.kicker` header.

**Kept** on the week screen: `WeekNavigator`, `KpiCard` (reworked into lumen's
`stat-row` cells), `DailyBarsMicro`, `HabitsWeekGrid`, `PeakHoursStrip`,
`BreakdownBar` ×3, `WeekReportBody`, `ReportAccordion`, `ThinkingIndicator`,
`ReportStatusBadge`.

`recharts` stays a dependency — `StatsPeriodView.tsx` and `HabitsPage.tsx` still use it.

### Repo root
```
mockup.html         1051   smoke-glass reference, now false
mockup-server.js      23
image.png                  light-theme reference for smoke-glass
```
The user confirmed removal: they are recoverable from git history.

### CSS
`globals.css` is rewritten from scratch, so no section is "deleted" as such. Two die
outright and are worth naming:

- `GLASS UTILITIES` (lines 457–500) — the `.glass` / `.glass-2` / `.glass-3` ladder.
- `TAILWIND UTILITY REMAPPING` (lines 1085–1218) — ~130 lines of
  `:root:not(.dark) .text-amber-600 { color: #4a6a00 !important }`, an override layer
  that existed to bend legacy Tailwind classes onto smoke-glass tokens. Its existence
  is why the file reached 1 349 lines. Components using those classes are rewritten
  against tokens directly.

Expected: 1 349 → ~450 lines.

**Total: ≈ −6 000 frontend lines** (18 634 → ~12 500) and ≈ −550 backend lines.

## New files

```
frontend/public/fonts/JetBrainsMono-Variable.ttf
frontend/src/components/palette/CommandPalette.tsx
frontend/src/components/palette/commands.ts
frontend/src/hooks/useCommandPalette.ts
frontend/src/components/layout/MobileTabBar.tsx
```

## Command palette

One new interaction, mounted once in `AppShell.tsx`. A single input with three
behaviours off the same field:

| Input state | Behaviour |
|---|---|
| empty | command list: screen navigation, «Новая задача», «Сменить тему» |
| text typed | results from the existing `/api/search` router, merged with matching commands |
| free text + Enter, no result selected | create a task via the existing `parseTask.ts` |

Keys: `Ctrl+K` / `Cmd+K` to open, `↑` `↓` to move, `Enter` to run, `Esc` to close.
Bound to `event.code` (`KeyK`), not `event.key`, so it survives a Cyrillic layout —
lumen does the same, and it is the difference between the shortcut working and not.

`commands.ts` exports a flat `Command[]` (`id`, `label`, `hint`, `run`). Navigation
commands are generated from the same list `Sidebar.tsx` renders, so the two cannot
drift.

On mobile the palette has no keyboard trigger; a `+` button in `MobileTabBar` opens
the same component. One implementation covers both.

## Layout

Single breakpoint at **900px**, declared once and referenced everywhere. No
`sm:`/`md:`/`lg:` mixing — the current 98 Tailwind breakpoint usages collapse to this
one rule.

### ≥900px
`AppShell` keeps rail + sidebar + main, but `.glass` on `<main>` becomes a flat
`--bg` surface with `border-left: 1px solid var(--line)`. Rows are 28px. Multi-column
stat rows use lumen's pattern: `display: grid`, `border-right: 1px solid var(--line)`
on each cell, `:last-child { border-right: 0 }`.

### <900px
- Sidebar (currently `position: fixed` + burger + backdrop) is replaced by
  `MobileTabBar`: a bottom bar, 4 entries — Мой день / Задачи / Привычки / Статистика
  — plus the central `+`. The burger, drawer and backdrop are removed.
- One column. `stat-row` reflows from N columns to a 2-column grid.
- Rows grow to 44px, font to 14px. Metadata (priority, time, tags) moves to a second
  line inside the row rather than being truncated.
- `RowMenu` right-click menus get a long-press trigger.

`index.html` already has `viewport-fit=cover`, `manifest.json` and the PWA meta tags —
no change needed there beyond `theme-color`.

## Drag-and-drop

Worth calling out because it is where the current design leaks. The branch carries
~15 consecutive `fix(dnd)` commits — `portal DragOverlay to body — escape
backdrop-filter containing block`, `kill final 1-frame ghost text via stable position
+ GPU layer`, `mask sibling 'блик' via opacity:0 during transform-transition`. These
are not dnd-kit bugs; they are the cost of `backdrop-filter` creating a containing
block and forcing extra paint layers.

With blur gone, the workarounds should be removable. **They are not removed
preemptively.** During step 3, when a page with DnD is reworked, drop the workarounds,
verify the drag visually, and keep them only if something actually regresses.

## Implementation order

1. **Tokens and shell.** `globals.css` from scratch, `@font-face`, `ThemeContext`
   (10→2), `ThemePicker`, `index.html` bootstrap, `tailwind.config.js`, `AppShell`.
   *The app looks broken after this step.* Screens are fixed in step 3. This is
   expected and is the reason step 1 is not split further — a half-migrated token
   layer is worse than a fully migrated one.
2. **Deletions.** Everything under «Deleted files». `npm run build` is the gate: `tsc`
   catches every dangling import.
3. **Screens, one at a time**, desktop layout only:
   Today → Tasks → Habits → Calendar (day/week/month) → Stats → Notifications →
   Export → Admin → Login.
4. **Command palette.**
5. **Mobile pass** over every screen from step 3, plus `MobileTabBar`.

## Testing

- `npm run build` (`tsc && vite build`) after every step. This is the primary gate for
  steps 1–2: dead imports and dropped `ThemeId` members are compile errors.
- `cd backend-node && npm test` after the daily-tip removal — `reports.controller.spec.ts`
  and `reports.service.spec.ts` both cover it and must be trimmed, not skipped.
- Manual QA per screen at 1440px and 375px.

### Manual QA checklist (post-implementation)
- [ ] Both themes: no element renders unstyled or with a leftover radius/shadow
- [ ] No essential text (dates, counters, errors) rendered at `--dim` or below
- [ ] Cyrillic keyboard layout: `Ctrl+K` still opens the palette
- [ ] Palette: navigate, search, and create a task via free text
- [ ] Offline (devtools → Network → Offline, reload): JetBrains Mono still renders
- [ ] 375px: no horizontal scroll on any screen; every tap target ≥44px
- [ ] DnD on Today and Tasks: drop lands where released, no ghost frame
- [ ] `/budget` returns 404 in the SPA router; `GET /api/budget/*` still answers
- [ ] Weekly report renders with no section colour themes

## Risks and open questions

- **Step 1 leaves the app visibly broken.** Mitigated by keeping steps 1–3 on one
  branch and not merging mid-way. If this turns out to be intolerable in practice,
  the fallback is to keep the old `globals.css` alongside the new one under a root
  class and flip screens over one at a time — more work, so it is not the default.
- **Light terminal theme is invented, not borrowed.** lumen has no light mode. The
  values above are a first pass and may need tuning once real screens exist.
- **Monospace is wider than Inter.** Existing fixed-width columns and truncation
  points (e.g. the 50-char task title truncation on Today, commit `14c5821`) will
  overflow at the same character counts. Expect per-screen adjustment in step 3.
- **The mobile mode is the APK.** Anything skipped in step 5 ships as an APK defect
  later, not as a web-only nicety.

## Inherited by plan 2 (recorded at the end of plan 1)

> **Статус: закрыто.** Все восемь пунктов выполнены в плане 2
> (`docs/superpowers/plans/2026-08-25-terminal-redesign-screens.md`, задачи 5, 10,
> 12 и 13). Раздел оставлен как история решений, а не как список дел.

Plan 1's execution surfaced work that belongs to the screen pass. Listed here because
the execution ledger it was recorded in is scratch and does not survive.

**Required — plan 2 is not done until these are cleared:**

1. **Focus rings.** `ring-*` / `focus:ring-*` still emit `box-shadow` through Tailwind's
   `ringWidth`/`ringColor` core plugins, across 8 component files. They were kept
   deliberately: deleting them with nothing in their place is an accessibility
   regression, not a cosmetic one. As each screen is reworked, move focus to this
   spec's border-swap pattern; once the last one is migrated, disable both core
   plugins the way `boxShadow`, `backdropBlur`, `backdropFilter` and `borderRadius`
   already are.
2. **Shrink `inline-styles.test.ts`'s BASELINE to `{}`.** It records six files whose
   inline styles still break the radius/shadow ban: `App.tsx` (toast, also hardcodes
   `#1F2937`/`#F9FAFB` outside the token system), `components/layout/Sidebar.tsx` (two
   7px `'50%'` indicator dots), `components/stats/HabitsWeekGrid.tsx`,
   `components/stats/StatsPeriodView.tsx` (recharts tooltip),
   `components/stats/WeekReportBody.tsx`, `pages/LoginPage.tsx`. The test fails in both
   directions, so each fix must also shrink the baseline.
3. **`rounded-[2px]` at `pages/HabitsPage.tsx:355`** is inert now that `borderRadius` is
   a disabled core plugin, but the class name is still there and reads as intent.

**Decide and act:**

4. **`components/ui/ThemePicker.tsx` has zero call sites.** Rewritten for two themes in
   plan 1, reachable from nowhere — `Sidebar` calls `useTheme().toggle()` directly.
   Either wire it up or delete it; three plans of drift is how orphans become permanent.
5. **`pages/ExportPage.tsx` has no route.** `App.tsx` has no `/export` entry. Do not
   budget time restyling an unreachable page — decide whether Export is a feature.
6. **`/boards` and `/kanban` are redirects** to `/today` and `/tasks` with no page
   components behind them.

**Cheap, do when the file is next open:**

7. `backend-node/src/reports/reports.service.ts:39` still injects `ConfigService`, whose
   only consumer was the deleted `dailyTip()`. Dead DI wiring.
8. `frontend/src/styles/tokens.test.ts` asserts colours come from `tokens.ts` by string
   equality, which a hardcoded literal would also satisfy. A `grep -n '#'` over
   `ThemeContext.tsx` is what actually enforces it; consider adding that as a test.
9. Grep for `backdrop-filter` in built CSS must be colon-anchored — the bare string
   survives inside Tailwind's stock `transition-property` list and is inert there.

**Known-stale in `CLAUDE.md`, parked at the end of plan 1:**

10. The S3-backup variable list omits `S3_ACCESS_KEY` and `S3_SECRET_KEY`, both read by
    `backend-node/src/.../s3-backup.config.ts`.
11. It describes `CUTOVER.md` as a record of a completed rollout; that file is an
    unexecuted checklist with unchecked boxes, written in prospective voice.

## Out-of-scope follow-ups

- Capacitor project + APK build pipeline.
- Removing the budget backend module and its 9 Prisma models, should the frontend
  removal prove permanent.
- Porting lumen's evening-summary flow (`Ctrl+Shift+S`).
- Deleting `1.txt` and `cloud-ru-s3-backup-integration (2).md` from the repo root —
  unrelated to this redesign, flagged only because they were noticed.
