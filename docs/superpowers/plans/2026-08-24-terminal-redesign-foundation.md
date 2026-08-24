# Terminal Redesign — Foundation & Subtraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the smoke-glass design system with terminal tokens and delete ~6 000 lines of frontend the redesign does not carry forward.

**Architecture:** A single palette module (`src/styles/tokens.ts`) becomes the source of truth for colour. `globals.css` is rewritten by hand against those values, and a test asserts the two never drift — CSS stays static (no runtime injection, no pre-paint flash) while drift becomes a test failure. `ThemeContext` imports the same module instead of restating hex literals, because recharts reads colours from JS where `var(--…)` does not resolve inside SVG attributes. Deletions follow the tokens so that `tsc -b` catches every dangling import.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Vitest (added by this plan), NestJS + Jest (backend, existing).

**Spec:** `docs/superpowers/specs/2026-08-24-terminal-redesign-design.md`

## Scope

This is **plan 1 of 3** for the spec. The spec's five implementation steps split as:

| Plan | Spec steps | Deliverable |
|---|---|---|
| **1 — Foundation & subtraction** (this document) | 1, 2 | Token system in place, dead code gone, `tsc -b && vite build` green |
| 2 — Screens | 3 | Nine screens reworked, desktop layout |
| 3 — Palette & mobile | 4, 5 | `Ctrl+K` palette, `MobileTabBar`, 900px pass |

Plan 1 does not leave the app visually finished — the spec says so explicitly, and it is why plans 1–3 stay on one branch and are not merged mid-way. What plan 1 *does* leave is an app that compiles, boots, and has exactly one place where colour is defined.

## Global Constraints

- Branch: `feature/backend-nestjs-port`. Do not merge to `main` until plan 3 completes.
- `--radius: 0` everywhere. No `box-shadow`, no `backdrop-filter`, anywhere, ever.
- No network font loading. No CDN calls of any kind — the Android APK runs offline.
- Readable tokens (`fg`, `fgBody`, `mid`, `accent`, `red`, `green`) must clear **4.5:1** against their theme's `bg`. Enforced by test, not by eye.
- Decorative tokens (`dim`, `muted`, `faint`) are deliberately **below 4.5:1**. No date, counter, or error message may be rendered only at those tiers.
- Two themes only: `dark` (default) and `light`.
- Font stack everywhere: `'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace`.
- The NestJS `budget` module and its 8 Prisma models are **not touched**. Frontend only.
- Run `npm run build` from `frontend/` after every task. It is `tsc -b && vite build`.

---

### Task 1: Contrast helper + Vitest

The frontend has no test runner today; `tsc -b && vite build` is the only gate. The palette rules in the spec are mechanical, so they get a real test rather than a review checkbox. This task adds the runner and the pure helper the palette test will use.

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/styles/contrast.ts`
- Test: `frontend/src/styles/contrast.test.ts`
- Modify: `frontend/package.json` (devDependencies, scripts)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `relativeLuminance(hex: string): number` — WCAG 2.1 relative luminance, 0–1.
  - `contrastRatio(a: string, b: string): number` — WCAG 2.1 ratio, 1–21. Order-independent.

- [ ] **Step 1: Install Vitest and wire the script**

```bash
cd frontend
npm install -D vitest
```

Add to `package.json` `scripts` (keep the existing three):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Create the Vitest config**

A separate config file, not a `test` key inside `vite.config.ts` — the app build should not grow a test dependency. `environment: 'node'` keeps jsdom out of the tree; these are pure-function and file-reading tests.

`frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Write the failing test**

`frontend/src/styles/contrast.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { relativeLuminance, contrastRatio } from './contrast'

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })

  it('accepts a hex string without the leading hash', () => {
    expect(relativeLuminance('ffffff')).toBeCloseTo(1, 5)
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2)
  })

  it('is 1 for a colour against itself', () => {
    expect(contrastRatio('#0b0c0c', '#0b0c0c')).toBeCloseTo(1, 5)
  })

  it('does not depend on argument order', () => {
    expect(contrastRatio('#d8a657', '#0b0c0c')).toBeCloseTo(
      contrastRatio('#0b0c0c', '#d8a657'),
      5,
    )
  })

  it('matches the value the spec records for the dark accent', () => {
    expect(contrastRatio('#d8a657', '#0b0c0c')).toBeCloseTo(8.87, 2)
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL — `Failed to resolve import "./contrast"`.

- [ ] **Step 5: Implement the helper**

`frontend/src/styles/contrast.ts`:

```ts
/**
 * WCAG 2.1 контраст. Живёт отдельным модулем, потому что правило палитры
 * («смысловой текст ≥ 4.5:1, приглушённые уровни — намеренно ниже»)
 * проверяется тестом, а не на глаз.
 */

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Относительная яркость по WCAG 2.1, 0–1. Принимает '#rrggbb' или 'rrggbb'. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`ожидался шестизначный hex, получено: ${hex}`)
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Контраст двух цветов, 1–21. От порядка аргументов не зависит. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts \
        frontend/src/styles/contrast.ts frontend/src/styles/contrast.test.ts
git commit -m "test: add vitest and a WCAG contrast helper"
```

---

### Task 2: Palette module

The single source of truth for colour. Every hex in the app comes from here after this plan.

**Files:**
- Create: `frontend/src/styles/tokens.ts`
- Test: `frontend/src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: `contrastRatio` from Task 1.
- Produces:
  - `interface Palette` — 18 string fields, listed in the implementation below.
  - `DARK: Palette`, `LIGHT: Palette`
  - `READABLE_KEYS: readonly (keyof Palette)[]` — tiers that may carry meaning.
  - `DECORATIVE_KEYS: readonly (keyof Palette)[]` — tiers that may not.
  - `CSS_VAR: Record<keyof Palette, string>` — field name → CSS custom property name. Task 3's drift test reads this.

- [ ] **Step 1: Write the failing test**

`frontend/src/styles/tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { contrastRatio } from './contrast'
import {
  DARK,
  LIGHT,
  READABLE_KEYS,
  DECORATIVE_KEYS,
  CSS_VAR,
  type Palette,
} from './tokens'

const THEMES: Array<[string, Palette]> = [
  ['DARK', DARK],
  ['LIGHT', LIGHT],
]

describe.each(THEMES)('%s palette', (_name, palette) => {
  it.each(READABLE_KEYS)(
    'readable tier %s clears WCAG AA (4.5:1) against bg',
    (key) => {
      expect(contrastRatio(palette[key], palette.bg)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(DECORATIVE_KEYS)(
    'decorative tier %s stays below 4.5:1 — it must never carry meaning alone',
    (key) => {
      expect(contrastRatio(palette[key], palette.bg)).toBeLessThan(4.5)
    },
  )

  it('every field is a six-digit hex colour', () => {
    for (const value of Object.values(palette)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('palette shape', () => {
  it('DARK and LIGHT define exactly the same fields', () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort())
  })

  it('CSS_VAR names a custom property for every field', () => {
    expect(Object.keys(CSS_VAR).sort()).toEqual(Object.keys(DARK).sort())
    for (const name of Object.values(CSS_VAR)) {
      expect(name).toMatch(/^--[a-z0-9-]+$/)
    }
  })

  it('classifies every tier that renders text as readable or decorative', () => {
    const classified = [...READABLE_KEYS, ...DECORATIVE_KEYS]
    expect(new Set(classified).size).toBe(classified.length)
    // accentLight / accentDark are hover and press states, not text tiers,
    // so they are deliberately absent from both lists.
    expect(classified).not.toContain('accentLight')
    expect(classified).not.toContain('accentDark')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL — `Failed to resolve import "./tokens"`.

- [ ] **Step 3: Implement the palette**

`frontend/src/styles/tokens.ts`. Dark is lumen's palette (`time_manage/src/styles.css`); light is derived by inverting lightness within the same hue family. Every number below was measured, not guessed — see the spec's contrast table.

```ts
/**
 * Единственный источник правды для цвета.
 *
 * Отсюда читают двое:
 * - globals.css — руками, значения обязаны совпадать (проверяется тестом
 *   в globals.test.ts, иначе палитра разъезжается молча);
 * - ThemeContext — потому что recharts берёт цвета из JS: в SVG-атрибутах
 *   var(--…) не раскрывается.
 */

export interface Palette {
  bg: string
  bgRaised: string
  bgCell: string
  bgHover: string
  bgSel: string
  line: string
  lineSoft: string
  fg: string
  fgBody: string
  mid: string
  dim: string
  muted: string
  faint: string
  accent: string
  accentLight: string
  accentDark: string
  red: string
  green: string
}

export const DARK: Palette = {
  bg:          '#0b0c0c',
  bgRaised:    '#0e100f',
  bgCell:      '#121413',
  bgHover:     '#101211',
  bgSel:       '#141715',
  line:        '#1e211e',
  lineSoft:    '#131614',
  fg:          '#d6d8d3',
  fgBody:      '#b9bcb6',
  mid:         '#8a8d87',
  dim:         '#6b706b',
  muted:       '#4d514a',
  faint:       '#42463f',
  accent:      '#d8a657',
  accentLight: '#e8c187',
  accentDark:  '#8a6a34',
  red:         '#b4666a',
  green:       '#7c9a6d',
}

export const LIGHT: Palette = {
  bg:          '#f6f5f1',
  bgRaised:    '#f1f0ea',
  bgCell:      '#ecebe4',
  bgHover:     '#eceae2',
  bgSel:       '#e5e3d9',
  line:        '#d8d6cb',
  lineSoft:    '#e6e4da',
  fg:          '#23241f',
  fgBody:      '#3c3e37',
  mid:         '#6b6e64',
  dim:         '#85887c',
  muted:       '#a0a396',
  faint:       '#b6b8ac',
  // Затемнён с #d8a657: на светлом фоне исходный акцент даёт 1.9:1.
  accent:      '#96651a',
  accentLight: '#b07f2c',
  accentDark:  '#6f4a11',
  red:         '#a2454a',
  green:       '#4e6f41',
}

/**
 * Уровни, на которых разрешён смысловой текст. Каждый обязан давать
 * ≥4.5:1 к bg своей темы.
 */
export const READABLE_KEYS = [
  'fg',
  'fgBody',
  'mid',
  'accent',
  'red',
  'green',
] as const satisfies readonly (keyof Palette)[]

/**
 * Приглушённые уровни — намеренно ниже 4.5:1, это и есть терминальная
 * эстетика (у lumen тот же --dim: #6b706b, те же 3.88). Ими красятся
 * рамки, .kicker-заголовки над читаемым содержимым и прочий фон смысла.
 * Дата, счётчик или текст ошибки в них жить не может.
 */
export const DECORATIVE_KEYS = [
  'dim',
  'muted',
  'faint',
] as const satisfies readonly (keyof Palette)[]

/** Поле палитры → имя CSS-переменной в globals.css. */
export const CSS_VAR: Record<keyof Palette, string> = {
  bg:          '--bg',
  bgRaised:    '--bg-raised',
  bgCell:      '--bg-cell',
  bgHover:     '--bg-hover',
  bgSel:       '--bg-sel',
  line:        '--line',
  lineSoft:    '--line-soft',
  fg:          '--fg',
  fgBody:      '--fg-body',
  mid:         '--mid',
  dim:         '--dim',
  muted:       '--muted',
  faint:       '--faint',
  accent:      '--accent',
  accentLight: '--accent-light',
  accentDark:  '--accent-dark',
  red:         '--red',
  green:       '--green',
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS. 18 readable assertions, 6 decorative, plus the shape tests.

If a readable tier fails, **darken or lighten that token until it passes** — do not relax the threshold and do not move the token into `DECORATIVE_KEYS`. The threshold is the point of the test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/tokens.ts frontend/src/styles/tokens.test.ts
git commit -m "feat: terminal palette as a single typed source of truth"
```

---

### Task 3: Rewrite globals.css

1 349 lines become roughly 450. The old file's `TAILWIND UTILITY REMAPPING` section (~130 lines of `:root:not(.dark) .text-amber-600 { color: #4a6a00 !important }`) is what made it that long; components that relied on it get fixed in plan 2, and `tsc` will not catch that — it is a visual regression, expected, and the reason plan 1 is not merged alone.

The drift test in this task is the one that makes the tokens module worth having.

**Files:**
- Rewrite: `frontend/src/styles/globals.css`
- Test: `frontend/src/styles/globals.test.ts`

**Interfaces:**
- Consumes: `DARK`, `LIGHT`, `CSS_VAR` from Task 2.
- Produces: CSS custom properties on `:root` (dark) and `:root[data-theme="light"]`; utility classes `.kicker`, `.row`, `.cell`, `.stat-row`.

- [ ] **Step 1: Write the failing drift test**

`frontend/src/styles/globals.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DARK, LIGHT, CSS_VAR, type Palette } from './tokens'

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')

/** Вытаскивает тело первого блока с данным селектором. */
function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`не найден блок ${selector} в globals.css`)
  return match[1]
}

function declaredValue(body: string, prop: string): string | null {
  const match = body.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`))
  return match ? match[1].trim().toLowerCase() : null
}

const CASES: Array<[string, string, Palette]> = [
  ['dark', ':root', DARK],
  ['light', ':root[data-theme="light"]', LIGHT],
]

describe.each(CASES)('%s theme in globals.css', (_name, selector, palette) => {
  const body = block(selector)

  it.each(Object.keys(CSS_VAR) as (keyof Palette)[])(
    '%s matches tokens.ts',
    (key) => {
      expect(declaredValue(body, CSS_VAR[key])).toBe(palette[key])
    },
  )
})

describe('terminal invariants', () => {
  it('never uses backdrop-filter — it creates containing blocks and broke dnd', () => {
    expect(css).not.toMatch(/backdrop-filter/)
  })

  it('never uses a non-zero box-shadow', () => {
    const shadows = css.match(/box-shadow\s*:\s*([^;]+);/g) ?? []
    for (const decl of shadows) {
      expect(decl).toMatch(/box-shadow\s*:\s*none\s*;/)
    }
  })

  it('never uses a non-zero border-radius', () => {
    const radii = css.match(/border-radius\s*:\s*([^;]+);/g) ?? []
    for (const decl of radii) {
      expect(decl).toMatch(/border-radius\s*:\s*0(px)?\s*;/)
    }
  })

  it('loads no font over the network', () => {
    expect(css).not.toMatch(/@import\s+url\(/)
    expect(css).not.toMatch(/fonts\.googleapis\.com/)
    expect(css).not.toMatch(/https?:\/\//)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- globals`
Expected: FAIL on every token (the current file declares `--ink`, `--glass`, not `--bg`) **and** on all four invariants — the current file has `backdrop-filter`, shadows, radii, and a Google Fonts `@import` on line 1.

- [ ] **Step 3: Rewrite the stylesheet**

Replace `frontend/src/styles/globals.css` entirely. Structure:

```css
/* ============================================================================
   TERMINAL DESIGN TOKENS
   Значения обязаны совпадать с src/styles/tokens.ts — это проверяет
   globals.test.ts. Правится всегда в паре.
   ============================================================================ */

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Variable.ttf') format('truetype-variations');
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;

  --bg: #0b0c0c;
  --bg-raised: #0e100f;
  --bg-cell: #121413;
  --bg-hover: #101211;
  --bg-sel: #141715;
  --line: #1e211e;
  --line-soft: #131614;
  --fg: #d6d8d3;
  --fg-body: #b9bcb6;
  --mid: #8a8d87;
  --dim: #6b706b;
  --muted: #4d514a;
  --faint: #42463f;
  --accent: #d8a657;
  --accent-light: #e8c187;
  --accent-dark: #8a6a34;
  --red: #b4666a;
  --green: #7c9a6d;

  --radius: 0;
  --row-h: 28px;
  --fs: 13px;
  --lh: 1.45;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
}

:root[data-theme="light"] {
  color-scheme: light;

  --bg: #f6f5f1;
  --bg-raised: #f1f0ea;
  --bg-cell: #ecebe4;
  --bg-hover: #eceae2;
  --bg-sel: #e5e3d9;
  --line: #d8d6cb;
  --line-soft: #e6e4da;
  --fg: #23241f;
  --fg-body: #3c3e37;
  --mid: #6b6e64;
  --dim: #85887c;
  --muted: #a0a396;
  --faint: #b6b8ac;
  --accent: #96651a;
  --accent-light: #b07f2c;
  --accent-dark: #6f4a11;
  --red: #a2454a;
  --green: #4e6f41;
}

@media (max-width: 899px) {
  :root {
    --row-h: 44px;
    --fs: 14px;
  }
}
```

Then, in order, these sections. Each replaces the identically-named section of the old file; the old `GLASS UTILITIES` and `TAILWIND UTILITY REMAPPING` sections have no replacement and simply disappear.

- **BASE** — `html, body { margin: 0; background: var(--bg); height: 100% }`,
  `body { color: var(--fg); font: var(--fs)/var(--lh) var(--font-mono) }`.
  No radial gradients, no SVG noise overlay, no `--noise-alpha`.
- **SCROLLBARS** — `scrollbar-width: thin; scrollbar-color: var(--line) transparent`.
- **SHELL LAYOUT** — rail + sidebar + main, flat. `main` gets
  `border-left: 1px solid var(--line)` in place of `.glass`.
- **KICKER** — lumen's section header: `padding: 8px 12px; color: var(--dim);
  font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  border-bottom: 1px solid var(--line)`.
- **GRID** — `.stat-row { display: grid; border-bottom: 1px solid var(--line) }`,
  `.stat-cell { padding: 10px 12px; border-right: 1px solid var(--line) }`,
  `.stat-cell:last-child { border-right: 0 }`.
- **ROWS** — `.row { height: var(--row-h); display: flex; align-items: center;
  border-bottom: 1px solid var(--line-soft) }`, `.row:hover { background: var(--bg-hover) }`,
  `.row[aria-selected="true"] { background: var(--bg-sel) }`.
- **BUTTONS / CHIPS** — flat, `border: 1px solid var(--line)`, `background: var(--bg-cell)`,
  `border-radius: 0`. Primary uses `var(--accent)` for text, never as a fill behind
  small text.
- **FORMS** — inputs inherit the mono font; `background: var(--bg-cell)`;
  `border: 1px solid var(--line)`; focus swaps the border to `var(--accent)` with
  no glow and no ring.
- **MODAL** — `background: var(--bg-raised)`, `border: 1px solid var(--line)`,
  backdrop is flat `rgba(0,0,0,.6)` with no blur.
- **ANIMATIONS** — keep the existing keyframes; they do not conflict.
- **MARKDOWN PREVIEW** — keep, re-pointed at the new tokens.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- globals`
Expected: PASS — 36 token assertions plus 4 invariants.

- [ ] **Step 5: Verify the build still compiles**

Run: `cd frontend && npm run build`
Expected: exit 0. The app will look wrong; it must still build.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/styles/globals.css frontend/src/styles/globals.test.ts
git commit -m "feat: rewrite globals.css against terminal tokens"
```

---

### Task 4: Bundle JetBrains Mono

Task 3 already wrote the `@font-face` pointing at `/fonts/JetBrainsMono-Variable.ttf`; this task puts the file there. Between the two commits the rule resolves to a 404 and text falls back to the system monospace — harmless, and the reason these two tasks are adjacent and neither is worth reordering.

**Files:**
- Create: `frontend/public/fonts/JetBrainsMono-Variable.ttf` (copied, 300 KB)
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: Copy the font from the sibling project**

```bash
mkdir -p frontend/public/fonts
cp ~/Documents/Github/time_manage/src/fonts/JetBrainsMono-Variable.ttf \
   frontend/public/fonts/JetBrainsMono-Variable.ttf
```

Verify: `ls -l frontend/public/fonts/` shows ~300 KB.

- [ ] **Step 2: Point every Tailwind font family at the mono stack**

In `frontend/tailwind.config.js`, replace the `fontFamily` block. Manrope and Fraunces are gone; `font-sans` and `font-display` still resolve so existing class names keep compiling.

```js
fontFamily: {
  sans: ['"JetBrains Mono"', 'ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
  display: ['"JetBrains Mono"', 'ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
  mono: ['"JetBrains Mono"', 'ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
},
```

- [ ] **Step 3: Strip the smoke-glass leftovers from the same file**

In the same `theme.extend`, delete the `sand` colour scale (`50`/`100`/`200`) and both `boxShadow` entries (`paper`, `paper-lg`) — shadows are banned by the global constraints. Rewrite the semantic colours to the new variables:

```js
colors: {
  bg:      { DEFAULT: 'var(--bg)', raised: 'var(--bg-raised)', cell: 'var(--bg-cell)' },
  fg:      { DEFAULT: 'var(--fg)', body: 'var(--fg-body)', mid: 'var(--mid)', dim: 'var(--dim)' },
  line:    { DEFAULT: 'var(--line)', soft: 'var(--line-soft)' },
  accent:  { DEFAULT: 'var(--accent)', light: 'var(--accent-light)', dark: 'var(--accent-dark)' },
  red:     'var(--red)',
  green:   'var(--green)',
},
borderRadius: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '0' },
```

Flattening `borderRadius` is deliberate: it neutralises every `rounded-*` class still sitting in the 9 screens plan 2 has not reached yet, so the app is never half-rounded.

- [ ] **Step 4: Verify the font actually loads offline**

Run: `cd frontend && npm run build && npm run preview`
Open the preview URL, then DevTools → Network → check **Offline** → reload.
Expected: text still renders in JetBrains Mono; no failed font request.

- [ ] **Step 5: Verify the build**

Run: `cd frontend && npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/public/fonts/JetBrainsMono-Variable.ttf frontend/tailwind.config.js
git commit -m "feat: bundle JetBrains Mono locally, drop shadows and radii from tailwind"
```

---

### Task 5: ThemeContext — 10 themes to 2

`ThemeContext.tsx` currently restates every colour as a hex literal. After this task it imports them.

**Files:**
- Modify: `frontend/src/context/ThemeContext.tsx`
- Modify: `frontend/src/components/ui/ThemePicker.tsx`
- Test: `frontend/src/context/themes.test.ts`

**Interfaces:**
- Consumes: `DARK`, `LIGHT`, `Palette` from Task 2.
- Produces:
  - `type ThemeId = 'dark' | 'light'`
  - `THEMES: readonly ThemeMeta[]` — length 2.
  - `ThemeMeta` keeps `id`, `label`, `isDark`, `swatch`, `accent`, `accentLight`, `accentDark`, `bg`, `surface`. **The shape does not change** — recharts call sites read `meta.accent` and would break otherwise.
  - `useTheme()` unchanged.

- [ ] **Step 1: Write the failing test**

`frontend/src/context/themes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { THEMES } from './ThemeContext'
import { DARK, LIGHT } from '@/styles/tokens'

describe('THEMES', () => {
  it('has exactly two entries', () => {
    expect(THEMES).toHaveLength(2)
  })

  it('is dark-first — dark is the default theme', () => {
    expect(THEMES[0].id).toBe('dark')
    expect(THEMES[1].id).toBe('light')
  })

  it('takes its colours from tokens.ts rather than restating them', () => {
    const dark = THEMES.find((t) => t.id === 'dark')!
    expect(dark.accent).toBe(DARK.accent)
    expect(dark.bg).toBe(DARK.bg)
    expect(dark.surface).toBe(DARK.bgCell)

    const light = THEMES.find((t) => t.id === 'light')!
    expect(light.accent).toBe(LIGHT.accent)
    expect(light.bg).toBe(LIGHT.bg)
    expect(light.surface).toBe(LIGHT.bgCell)
  })

  it('marks exactly one theme as dark', () => {
    expect(THEMES.filter((t) => t.isDark)).toHaveLength(1)
  })

  it('keeps the fields recharts reads from JS', () => {
    for (const theme of THEMES) {
      for (const key of ['accent', 'accentLight', 'accentDark', 'bg', 'surface'] as const) {
        expect(theme[key]).toMatch(/^#[0-9a-f]{6}$/)
      }
      expect(theme.swatch).toHaveLength(3)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- themes`
Expected: FAIL — `expected length 10 to be 2`.

- [ ] **Step 3: Rewrite the theme table**

In `frontend/src/context/ThemeContext.tsx`, replace the `ThemeId` union and the whole `THEMES` array. Leave `ThemeMeta`, `normalizeTheme`, `findMeta`, the provider and `useTheme` alone.

```ts
import { DARK, LIGHT } from '@/styles/tokens'

export type ThemeId = 'dark' | 'light'

export const THEMES: readonly ThemeMeta[] = [
  {
    id: 'dark', label: 'Тёмная', isDark: true,
    swatch: [DARK.bg, DARK.bgCell, DARK.accent],
    accent: DARK.accent, accentLight: DARK.accentLight, accentDark: DARK.accentDark,
    bg: DARK.bg, surface: DARK.bgCell,
  },
  {
    id: 'light', label: 'Светлая', isDark: false,
    swatch: [LIGHT.bg, LIGHT.bgCell, LIGHT.accent],
    accent: LIGHT.accent, accentLight: LIGHT.accentLight, accentDark: LIGHT.accentDark,
    bg: LIGHT.bg, surface: LIGHT.bgCell,
  },
] as const
```

Change the default on the next line:

```ts
const DEFAULT_THEME: ThemeId = 'dark'
```

- [ ] **Step 4: Turn ThemePicker into a toggle**

`ThemePicker.tsx` renders a carousel over `THEMES`. With two entries a carousel is silly. Replace its body with a two-button group that maps over `THEMES` and marks the active one with `aria-pressed`. Keep the component's exported name and props so its call sites do not change.

Drop the `keydown` arrow-key handling it used for carousel navigation — two buttons do not need it.

- [ ] **Step 5: Run the tests and the build**

Run: `cd frontend && npm test && npm run build`
Expected: both exit 0. `tsc` is the real check here: any file still naming `'gruvbox'`, `'midnight'`, `'sky'`, `'blossom'`, `'lavender'`, `'purple'`, `'rose'` or `'pink'` as a `ThemeId` is now a type error. Fix each by deleting the branch — do not re-add the theme.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/context/ThemeContext.tsx frontend/src/context/themes.test.ts \
        frontend/src/components/ui/ThemePicker.tsx
git commit -m "feat: reduce themes to dark and light, sourced from tokens"
```

---

### Task 6: index.html pre-paint bootstrap

`frontend/index.html` runs an inline script before `<body>` that reads `localStorage` and stamps the theme, so a dark-theme load does not flash light. It hardcodes both theme lists.

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Replace the bootstrap script**

The existing script lists ten themes in `VALID` and six in `DARK`. Replace the whole `<script>` with:

```html
<script>
  (function () {
    var VALID = ['dark', 'light'];
    var stored = localStorage.getItem('theme');
    var t = VALID.indexOf(stored) !== -1 ? stored : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dark') document.documentElement.classList.add('dark');
  })();
</script>
```

Two things must stay true, and both are easy to break: the script stays **inline** (an external file loads too late to prevent the flash), and it stays **before `<body>`**. The `.dark` class is still added because `tailwind.config.js` sets `darkMode: 'class'` and any surviving `dark:` variant depends on it.

Note the default flipped to `'dark'` — it must match `DEFAULT_THEME` in Task 5.

- [ ] **Step 2: Update the status bar colour**

```html
<meta name="theme-color" content="#0b0c0c" />
```

- [ ] **Step 3: Verify no flash**

Run: `cd frontend && npm run dev`
In DevTools → Application → Local Storage, delete the `theme` key, then hard-reload.
Expected: the page paints dark immediately. No white frame.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html
git commit -m "feat: bootstrap the two-theme system dark-first"
```

---

### Task 7: Deglass the shell

`AppShell.tsx` is small (`ts-shell`, `ts-shell__main glass`, burger, backdrop) but it is the frame every screen sits in, so it goes before the deletions.

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Remove the glass class from main**

In `AppShell.tsx`, `<main className="ts-shell__main glass">` becomes `<main className="ts-shell__main">`. The `.glass` class no longer exists after Task 3; leaving it is a silent no-op that misleads the next reader.

- [ ] **Step 2: Leave the mobile drawer alone**

The burger button, the backdrop and the `lg:hidden` conditionals stay for now. `MobileTabBar` replaces them in **plan 3**. Do not delete them here — that would leave the app with no mobile navigation at all for the length of plan 2.

- [ ] **Step 3: Restyle sidebar nav rows**

In `Sidebar.tsx`, nav entries become flat rows: `height: var(--row-h)`, no radius, no pill background. Active entry gets `background: var(--bg-sel)` and `color: var(--accent)`; inactive is `var(--fg-body)`. Hover is `var(--bg-hover)`.

The count badges currently render at `--dim`-equivalent greys. Counts are information, so under the global constraints they move to `var(--mid)` or brighter.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "refactor: flatten the app shell and sidebar"
```

---

### Task 8: Delete the pet — frontend

**Files:**
- Delete: `frontend/src/components/today/AsciiPet.tsx` (911)
- Delete: `frontend/src/components/today/PersonaPicker.tsx` (142)
- Delete: `frontend/src/data/personas.ts` (30)
- Delete: `frontend/src/hooks/useDailyTip.ts` (145)
- Modify: `frontend/src/pages/TodayPage.tsx`
- Modify: `frontend/src/api/reports.ts`

- [ ] **Step 1: Delete the four files**

```bash
git rm frontend/src/components/today/AsciiPet.tsx \
       frontend/src/components/today/PersonaPicker.tsx \
       frontend/src/data/personas.ts \
       frontend/src/hooks/useDailyTip.ts
```

- [ ] **Step 2: Let the compiler find the call sites**

Run: `cd frontend && npm run build`
Expected: FAIL, with errors in `TodayPage.tsx` (imports `AsciiPet`, `PersonaPicker`, `useDailyTip`) and `api/reports.ts`.

- [ ] **Step 3: Cut the pet out of TodayPage**

Remove the imports, the `useDailyTip()` call, and the JSX block that renders `AsciiPet` and `PersonaPicker`. Delete any state that existed only to drive them (persona override, tip expand/collapse). Leave the rest of the page alone — its layout is plan 2's job.

- [ ] **Step 4: Cut the API surface**

In `frontend/src/api/reports.ts` delete `getDailyTip`, the `DailyTipPersona` interface and the `DailyTipResponse` interface. Leave every weekly-report export untouched.

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: both exit 0.

Then confirm nothing survives:

```bash
grep -rn "AsciiPet\|PersonaPicker\|useDailyTip\|personas\|daily-tip" frontend/src
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "refactor: remove the ascii pet from the frontend"
```

---

### Task 9: Delete the pet — backend

The backend has Jest and real coverage of this endpoint, so this task is test-first in the ordinary sense: delete the tests that assert behaviour that is going away, watch the suite go red on the leftovers, then remove the implementation.

**Files:**
- Delete: `backend-node/src/llm/prompts/pet-personas.prompt.ts` (192)
- Delete: `backend-node/src/llm/prompts/pet-personas.prompt.spec.ts` (76)
- Delete: `backend-node/src/llm/prompts/pet-tip.prompt.ts` (161)
- Delete: `backend-node/src/llm/prompts/pet-tip.prompt.spec.ts` (54)
- Modify: `backend-node/src/reports/reports.controller.ts`
- Modify: `backend-node/src/reports/reports.service.ts`
- Modify: `backend-node/src/reports/reports.controller.spec.ts`
- Modify: `backend-node/src/reports/reports.service.spec.ts`

- [ ] **Step 1: Confirm the suite is green before touching anything**

Run: `cd backend-node && npm test`
Expected: PASS. If it is already red, stop and report — do not delete code on top of a broken suite.

- [ ] **Step 2: Remove the daily-tip cases from the two spec files**

In `reports.controller.spec.ts` and `reports.service.spec.ts`, delete every `describe`/`it` covering `dailyTip`, persona selection, or the tip cache. Keep everything about weekly report generation, status transitions and `request-summary`.

- [ ] **Step 3: Delete the four prompt files**

```bash
git rm backend-node/src/llm/prompts/pet-personas.prompt.ts \
       backend-node/src/llm/prompts/pet-personas.prompt.spec.ts \
       backend-node/src/llm/prompts/pet-tip.prompt.ts \
       backend-node/src/llm/prompts/pet-tip.prompt.spec.ts
```

- [ ] **Step 4: Run the suite to see what still references them**

Run: `cd backend-node && npm test`
Expected: FAIL — compile errors from `reports.service.ts`, which imports `buildPetPrompt` and the persona helpers.

- [ ] **Step 5: Remove the implementation**

In `reports.service.ts` delete: the imports from both prompt files; `DailyTipPersonaDto`; `DailyTipResult`; `DailyTipCacheEntry`; the `dailyTipCache` field; `dailyTip()`; and `clearDailyTipCache()`. That is roughly 150 lines. Everything else in the service stays.

In `reports.controller.ts` delete the `@Get('daily-tip')` handler and its method.

Check whether `llm.service.ts` still needs anything the prompt files provided — it appears in the reference grep. If its only tie was re-exporting a prompt builder, remove that too; if it is generic LLM plumbing shared with the weekly report, leave it.

- [ ] **Step 6: Run the suite to verify it passes**

Run: `cd backend-node && npm test`
Expected: PASS, with the daily-tip cases gone and every weekly-report case still present.

- [ ] **Step 7: Confirm nothing survives**

```bash
grep -rn "dailyTip\|daily-tip\|PetPersona\|buildPetPrompt" backend-node/src
```
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add -A backend-node/src
git commit -m "refactor: remove the daily-tip endpoint and pet prompts"
```

---

### Task 10: Delete the budget frontend

The NestJS module, its cron jobs and its 8 Prisma models stay. This is frontend only, and it is one revert away.

**Files:**
- Delete: `frontend/src/pages/BudgetPage.tsx` (1 289)
- Delete: `frontend/src/components/budget/` (9 files)
- Delete: `frontend/src/hooks/useBudget.ts`, `frontend/src/hooks/useBudgetGoal.ts`
- Delete: `frontend/src/api/budget.ts`, `frontend/src/types/budget.ts`, `frontend/src/utils/parseBudget.ts`
- Modify: `frontend/src/App.tsx` (route)
- Modify: `frontend/src/components/layout/Sidebar.tsx` (nav entry)

- [ ] **Step 1: Delete the tree**

```bash
git rm -r frontend/src/components/budget
git rm frontend/src/pages/BudgetPage.tsx \
       frontend/src/hooks/useBudget.ts \
       frontend/src/hooks/useBudgetGoal.ts \
       frontend/src/api/budget.ts \
       frontend/src/types/budget.ts \
       frontend/src/utils/parseBudget.ts
```

- [ ] **Step 2: Let the compiler find the rest**

Run: `cd frontend && npm run build`
Expected: FAIL in `App.tsx` and `Sidebar.tsx`.

- [ ] **Step 3: Remove the route and the nav entry**

In `App.tsx`, delete the `/budget` route and the `BudgetPage` import. An unknown path already falls through to the app's existing not-found handling — do not add a redirect.

In `Sidebar.tsx`, delete the `{ to: '/budget', label: 'Бюджет', icon: <BudgetIcon /> }` entry at line 183 **and** the `function BudgetIcon()` declaration at line 58 — the icon is defined locally in this file, not in `ui/icons.tsx`, and nothing else references it.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 5: Confirm the backend is untouched**

```bash
git status --short backend-node
```
Expected: no output — this task must not have modified the backend.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "refactor: remove the budget frontend, backend module untouched"
```

---

### Task 11: Trim the weekly summary

Removes the decorative half of the week screen. `sectionStyles.ts` is the key one: it assigns each of the report's 7 LLM sections a gradient underline, a round icon chip, a coloured bold and a tinted row background.

**Files:**
- Delete: `frontend/src/components/stats/WeekHeroBand.tsx` (170)
- Delete: `frontend/src/components/stats/WeeklySpotlight.tsx` (158)
- Delete: `frontend/src/components/stats/WeekShareCard.tsx` (275)
- Delete: `frontend/src/components/stats/ShareWeekButton.tsx` (169)
- Delete: `frontend/src/components/stats/CompletionDonut.tsx` (92)
- Delete: `frontend/src/components/stats/AnimatedNumber.tsx` (52)
- Delete: `frontend/src/components/reports/sectionStyles.ts`
- Delete: `frontend/src/components/reports/ReportIcons.tsx` (91)
- Modify: `frontend/src/components/stats/StatsWeekView.tsx`
- Modify: `frontend/src/components/reports/ReportContent.tsx`

`ReportAccordion.tsx` is **not** in this list on purpose: it imports `ReportStatusBadge`, `ThinkingIndicator` and `ReportContent`, none of which are deleted. Leave it alone.

- [ ] **Step 1: Delete the eight files**

```bash
git rm frontend/src/components/stats/WeekHeroBand.tsx \
       frontend/src/components/stats/WeeklySpotlight.tsx \
       frontend/src/components/stats/WeekShareCard.tsx \
       frontend/src/components/stats/ShareWeekButton.tsx \
       frontend/src/components/stats/CompletionDonut.tsx \
       frontend/src/components/stats/AnimatedNumber.tsx \
       frontend/src/components/reports/sectionStyles.ts \
       frontend/src/components/reports/ReportIcons.tsx
```

- [ ] **Step 2: Let the compiler find the call sites**

Run: `cd frontend && npm run build`
Expected: FAIL in `StatsWeekView.tsx` and `ReportContent.tsx` only. `AnimatedNumber` and `CompletionDonut` are consumed exclusively by files this task also deletes (`WeekHeroBand`, `WeeklySpotlight`), so they produce no external breakage.

- [ ] **Step 3: Rebuild StatsWeekView's composition**

Delete the `WeekHeroBand`, `WeeklySpotlight` and `ShareWeekButton` JSX. Keep, in this order: `WeekNavigator`, the four `KpiCard`s, `DailyBarsMicro`, `WeekReportBody`, `HabitsWeekGrid`, `PeakHoursStrip`, the three `BreakdownBar`s, and the `Link` at the bottom.

`KpiCard` needs no change here — it imports `clsx` and `framer-motion`, not `AnimatedNumber`. Its rework into a `.stat-cell` is plan 2's job.

- [ ] **Step 4: Strip section theming from the report renderer**

In `ReportContent.tsx`, remove the `sectionStyles` import, the `SectionTheme` lookup, and every `cardClass` / `iconChipClass` / `titleClass` / `underlineClass` / `boldClass` / `h3BorderClass` / `codeClass` / `bulletClass` / `quoteBorderClass` / `listRowBgClass` application. Each section becomes a `.kicker` header followed by its markdown body at `var(--fg-body)`.

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: both exit 0.

```bash
grep -rn "sectionStyles\|ReportIcons\|AnimatedNumber\|WeekShareCard\|html-to-image" frontend/src
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "refactor: strip decorative chrome from the weekly summary"
```

---

### Task 12: Drop dead dependencies and stale root files

Three packages are dead. `react-force-graph-2d` and `react-activity-calendar` have **zero occurrences** anywhere in `src`, `index.html` or `vite.config.ts` — verified before this plan was written. `html-to-image` had exactly two consumers and Task 11 deleted both. (Note: `CLAUDE.md` lists `react-activity-calendar` as a stats visualisation library; that claim is already stale and Task 12 makes it plainly wrong, so the file is corrected here too.)

**Files:**
- Modify: `frontend/package.json`
- Delete: `mockup.html`, `mockup-server.js`, `image.png` (repo root)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Re-confirm the three packages are unused**

```bash
grep -rniE "force-graph|forcegraph|activity-calendar|activitycalendar|html-to-image" \
     frontend/src frontend/index.html frontend/vite.config.ts
```
Expected: no output. **If anything prints, stop** and remove only the packages that are genuinely unreferenced.

- [ ] **Step 2: Uninstall**

```bash
cd frontend
npm uninstall react-force-graph-2d react-activity-calendar html-to-image
```

- [ ] **Step 3: Delete the smoke-glass reference files**

These were the visual source for the design being replaced, so they now describe something that no longer exists. The user confirmed removal — they stay recoverable from git history.

```bash
git rm mockup.html mockup-server.js image.png
```

- [ ] **Step 4: Correct CLAUDE.md**

Three statements in the frontend section are now false. Fix each:

- `recharts` + `react-activity-calendar` for stats visualisations → `recharts` only.
- The Pages list still names Budget → remove it, and note the API remains.
- The Theme section describes ten themes → two, `dark` default.

Leave the backend sections alone; this plan does not change them beyond the daily-tip endpoint, which is worth one line under the reports router.

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json CLAUDE.md
git add -A
git commit -m "chore: drop dead deps, stale mockups, and correct CLAUDE.md"
```

---

## Done criteria for plan 1

- [ ] `cd frontend && npm run build` exits 0
- [ ] `cd frontend && npm test` exits 0 — contrast, palette, globals drift, themes
- [ ] `cd backend-node && npm test` exits 0
- [ ] `grep -rn "backdrop-filter\|box-shadow\|rounded-" frontend/src/styles/globals.css` prints nothing
- [ ] `grep -rn "AsciiPet\|useDailyTip\|BudgetPage\|sectionStyles" frontend/src` prints nothing
- [ ] `git status --short backend-node/prisma` prints nothing — no model was touched
- [ ] The app boots at `npm run dev` and every route renders without a console error
- [ ] `GET /api/budget/summary` still answers through the running backend

Screens will look unfinished. That is plan 2.

## What plan 1 deliberately does not do

- Rework any of the nine screens (plan 2).
- Add the `Ctrl+K` palette (plan 3) — including the `event.code === 'KeyK'` binding the spec calls for, which matters because `event.key` breaks under a Cyrillic layout.
- Add `MobileTabBar` or touch the 900px breakpoint (plan 3). The burger drawer stays working throughout.
- Remove the dnd `backdrop-filter` workarounds. The spec is explicit: they come out per-screen in plan 2, verified by dragging, not preemptively.
- Initialise Capacitor. Its three packages are already in `dependencies`, but there is no `android/` directory and no `capacitor.config.ts`; that remains a follow-up after plan 3.
