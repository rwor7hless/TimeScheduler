import { useEffect, useRef, useState } from 'react'

interface MenuItem {
  label: string
  onClick: () => void
  destructive?: boolean
}

export default function RowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Действия"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="px-1 opacity-30 hover:opacity-80"
      >
        ⋯
      </button>
      {open && (
        <div className="popover absolute right-0 z-50 mt-1 min-w-[140px] py-1 text-sm">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={
                'block w-full text-left px-3 py-1.5 hover:bg-bg-hover ' +
                (item.destructive ? 'text-danger' : '')
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
