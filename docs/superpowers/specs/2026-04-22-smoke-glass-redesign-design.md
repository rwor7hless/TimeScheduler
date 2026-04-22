# Smoke-Glass Redesign — Design Spec

Date: 2026-04-22
Author: Roman

## Goal

Replace the current amber/flat Tailwind UI with the smoke-glass aesthetic prototyped in `mockup.html`. Single pass, all pages, both light and dark themes.

## Design source

- `mockup.html` at repo root — the authoritative visual & structural reference (dark theme).
- `image.png` at repo root — light-theme reference: warm off-white noisy background, frosted white glass panels, dark neutral text, minimal accent.

## Palette / Tokens

Smoke-dominant. Lime (`#dfff7a`) is an accent used sparingly for: primary button, streak chips, selected-row highlight, active check ticks, chart "hot" fills. Everything else is warm neutral grays.

### Dark (default, from mockup)
```
--ink:        #f5f4f1   /* primary text */
--ink-2:      #d2d0cb   /* secondary text */
--ink-3:      #9f9d98   /* tertiary / muted */
--line:       rgba(255,255,255,.12)
--line-strong:rgba(255,255,255,.22)
--glass:      rgba(255,255,255,.07)
--glass-2:    rgba(255,255,255,.11)
--glass-3:    rgba(255,255,255,.16)
--accent:     #dfff7a   /* lime — sparse */
--blue:       #b6c3ff
--pink:       #ffb8d8
--orange:     #ffd099
--danger:     #ff786e
```

Body background: radial-gradient tints (lime top-right, blue top-left, pink bottom) over `linear-gradient(#2a2b2f → #16171a)` + SVG noise overlay.

### Light (derived from image.png)
```
--ink:        #1d1d1b
--ink-2:      #4b4a47
--ink-3:      #82807b
--line:       rgba(20,20,20,.08)
--line-strong:rgba(20,20,20,.16)
--glass:      rgba(255,255,255,.55)
--glass-2:    rgba(255,255,255,.72)
--glass-3:    rgba(255,255,255,.85)
--accent:     #7aa60a   /* darkened lime for contrast on white */
--blue:       #5b6ed4
--pink:       #c85a92
--orange:     #b8761e
--danger:     #c83d32
```

Body background: radial-gradient tints (soft lime, soft blue, soft pink) over `linear-gradient(#e8e7e2 → #d6d5d0)` + same SVG noise overlay. Accent color is darkened so the lime reads against white glass without neon glare.

## Architecture

Single source of truth: `frontend/src/styles/globals.css`. All tokens, glass utilities, and page-level helpers live here. Components consume them via Tailwind className + custom utility classes (`.glass`, `.chip`, `.pill`, `.icon-btn`, `.primary-btn`, etc.).

Theme toggle: existing `ThemeContext` already flips `.dark` on `<html>`. We keep this as-is; `:root` holds light tokens, `.dark` overrides with dark tokens. Remove the existing `.dark .bg-gray-X` override block — no longer needed once everything reads from tokens.

### Shell

`AppShell.tsx` becomes a 3-column grid on a padded, radial-gradient body:
```
68px rail | 300px sidebar | 1fr main
```
All three are `.glass` panels with rounded-24px corners. On screens < 1100px, sidebar collapses to drawer; on < 768px, rail collapses to bottom bar. (Responsive scope: keep today's behavior roughly — improve if easy, don't refactor mobile from scratch.)

### Key page structures

- **Today**: 3 stat cards (featured + 2), tabs, search, task rows, then split (habits list + mini-cal schedule).
- **Calendar**: week-grid with sticky time column; events as colored ribbons with left border in category color.
- **Boards**: grid of board-cards with emoji, title, progress bar, task count.
- **Kanban (`/project/:id`)**: 4-column kanban in glass; cards use `.kc` style with priority bar, progress, footer meta.
- **Tasks (`/project`)**: smart-chip filter row, then `.tasks-split` — list on left, sticky detail panel on right.
- **Habits**: grid of habit-cards with heat-map grid at the bottom.
- **Stats**: bars + donut + legend, inside glass panels.
- **Budget**: `budget-grid` — transactions list left, side-panel right.
- **Reports/Notifications**: `.report` cards.

### Modals

`Modal.tsx` base: glass-2 background with stronger backdrop-filter; existing `.modal-glass` gets rewritten to use tokens.

### Scope out of bounds

- No routing changes. No feature additions. No refactor of data layer.
- No bundle-size optimizations. No font swaps beyond the existing Inter.
- Component internal logic stays intact — only className/markup changes.

## Delivery

Single branch, single conversation. Rough order so the PR reviewer (me) can sanity-check incrementally:
1. Tokens + globals.css rewrite + body background + scrollbars.
2. Shell (AppShell, Sidebar, Header/rail).
3. Shared UI primitives (Button, Input, Select, Modal).
4. Pages: Today → Calendar → Boards → Kanban → Tasks → Habits → Stats → Budget → Notifications → Admin/Login.
5. Light-theme QA pass.

## Accept criteria

- Dark theme matches `mockup.html` for every page that has a mockup equivalent.
- Light theme matches `image.png` aesthetic — off-white noisy body, white-ish frosted glass, legible dark text, restrained accent.
- Theme toggle in the UI flips correctly between both.
- No visual regressions in modals, forms, or tooltips.
- `npm run build` passes.
