import type { IconName } from './sectionStyles'

interface Props {
  name: IconName
  className?: string
}

/** Иконка для заголовка секции. Все — 20×20, currentColor, line-art. */
export function SectionIcon({ name, className }: Props) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }

  switch (name) {
    case 'intro':
      // Волна: мягкое вступление.
      return (
        <svg {...common}>
          <path d="M3 12c2 0 2-4 4.5-4S9 16 11.5 16 13 8 15.5 8 17 12 19 12" />
        </svg>
      )
    case 'rating':
      // Спидометр/полукруг: оценка недели.
      return (
        <svg {...common}>
          <path d="M4 15a8 8 0 0 1 16 0" />
          <path d="M12 15l3-5" />
          <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'projects':
      // Стопка слоёв: разбор по проектам.
      return (
        <svg {...common}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
          <path d="M3 17l9 5 9-5" />
        </svg>
      )
    case 'done':
      // Круг с галочкой: выполненные задачи.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l3 3 5-6" />
        </svg>
      )
    case 'fails':
      // Треугольник «!»: провалы недели.
      return (
        <svg {...common}>
          <path d="M12 3L2.5 20h19L12 3z" />
          <path d="M12 10v5" />
          <circle cx="12" cy="17.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'advice':
      // Лампочка: советы.
      return (
        <svg {...common}>
          <path d="M9 18h6" />
          <path d="M10 21h4" />
          <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.2V17h6v-1.3c0-.9.4-1.6 1-2.2A6 6 0 0 0 12 3z" />
        </svg>
      )
    case 'summary':
      // Флажок: итог.
      return (
        <svg {...common}>
          <path d="M5 21V4" />
          <path d="M5 4h11l-2 3.5L16 11H5" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}
