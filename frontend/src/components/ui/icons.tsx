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

/* ── Utility icons ──────────────────────────────────────────────────────── */

export const IconFlame = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17h2a2.5 2.5 0 0 0 2.5-2.5c0-1-.5-2-1.5-3-1-1-3-2-3-4-.5-.5 0-3 0-3s-4 2-4 6c0 1.5 1 3 1.5 4z" />
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

