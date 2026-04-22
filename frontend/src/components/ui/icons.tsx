import type { SVGProps } from 'react'

/**
 * Тонкий stroke-based icon-комплект в стиле lucide: ViewBox 24×24,
 * currentColor, width/height наследуются от родительского font-size
 * через `size` prop (по умолчанию 20). Все иконки семантически
 * нейтральные — никаких эмодзи, читаемы в любой теме.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number | string
  title?: string
}

function IconBase({ size = 20, title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

/* ── Budget categories ──────────────────────────────────────────────────── */

export const IconFood = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 11h16" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M9 4c-.5 1 .5 2 0 3" />
    <path d="M12 3.5c-.5 1 .5 2 0 3" />
    <path d="M15 4c-.5 1 .5 2 0 3" />
  </IconBase>
)

export const IconCar = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M5 17H3v-4l2-6h14l2 6v4h-2" />
    <path d="M5 13h14" />
    <circle cx="7.5" cy="17" r="1.8" />
    <circle cx="16.5" cy="17" r="1.8" />
  </IconBase>
)

export const IconHouse = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </IconBase>
)

export const IconPill = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="9" width="18" height="6" rx="3" />
    <line x1="12" y1="9.5" x2="12" y2="14.5" />
  </IconBase>
)

export const IconGamepad = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="2" y="8" width="20" height="10" rx="3" />
    <path d="M6 13h3M7.5 11.5v3" />
    <circle cx="16.5" cy="11.8" r=".9" fill="currentColor" stroke="none" />
    <circle cx="18.2" cy="14.2" r=".9" fill="currentColor" stroke="none" />
    <circle cx="14.8" cy="14.2" r=".9" fill="currentColor" stroke="none" />
  </IconBase>
)

export const IconShirt = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M8 3L4 6v4h3v10h10V10h3V6l-4-3-2 2h-4L8 3z" />
  </IconBase>
)

export const IconLaptop = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="5" width="18" height="12" rx="1.5" />
    <path d="M2 20h20" />
  </IconBase>
)

export const IconBook = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 4h6a3 3 0 0 1 3 3v13" />
    <path d="M4 4v14h6a3 3 0 0 1 3 2" />
    <path d="M20 4h-6a3 3 0 0 0-3 3v13" />
    <path d="M20 4v14h-6a3 3 0 0 0-3 2" />
  </IconBase>
)

export const IconPlane = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M21 13v-2L10 3.5V7l-4 3H3l1 3.5L3 17h3l4 3v3.5L21 15v-2z" />
  </IconBase>
)

export const IconRepeat = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </IconBase>
)

export const IconBox = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.3 7L12 12l8.7-5" />
    <path d="M12 22V12" />
  </IconBase>
)

/* ── Utility icons ──────────────────────────────────────────────────────── */

export const IconFlame = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17h2a2.5 2.5 0 0 0 2.5-2.5c0-1-.5-2-1.5-3-1-1-3-2-3-4-.5-.5 0-3 0-3s-4 2-4 6c0 1.5 1 3 1.5 4z" />
  </IconBase>
)

export const IconTarget = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </IconBase>
)

export const IconTag = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M20.6 13.4l-7.2 7.2a1 1 0 0 1-1.4 0l-8.4-8.4a1 1 0 0 1-.3-.7V4a1 1 0 0 1 1-1h7.5a1 1 0 0 1 .7.3l8.1 8.1a1 1 0 0 1 0 1.4z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </IconBase>
)

export const IconInfo = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </IconBase>
)

/* ── Priority icons for TaskCard ────────────────────────────────────────── */

export const IconArrowDown = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 5v14" />
    <path d="M6 13l6 6 6-6" />
  </IconBase>
)

export const IconDash = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M5 12h14" />
  </IconBase>
)

export const IconArrowUp = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 19V5" />
    <path d="M6 11l6-6 6 6" />
  </IconBase>
)

export const IconZap = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
  </IconBase>
)

/* ── Dispatcher for budget categories ──────────────────────────────────── */

const BUDGET_CATEGORY_MAP: Record<string, React.ComponentType<IconProps>> = {
  food:          IconFood,
  transport:     IconCar,
  housing:       IconHouse,
  health:        IconPill,
  entertainment: IconGamepad,
  clothing:      IconShirt,
  tech:          IconLaptop,
  education:     IconBook,
  travel:        IconPlane,
  subscriptions: IconRepeat,
  other:         IconBox,
}

export function BudgetCategoryIcon({ id, ...rest }: { id: string } & IconProps) {
  const Cmp = BUDGET_CATEGORY_MAP[id] ?? IconBox
  return <Cmp {...rest} />
}
