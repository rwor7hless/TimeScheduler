import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PERSONAS } from '@/data/personas'

/**
 * Карусель выбора кота: ←  Имя  →. Анимированная — на стрелочку имя
 * уезжает в одну сторону, новое приезжает с другой. Сохраняется через
 * `useDailyTip().overrideId` в localStorage (per-user); persona-выбор
 * переживает перезаход в приложение.
 */

const ITEMS: { id: string | null; name: string; eyes: string }[] = [
  { id: null, name: 'авто', eyes: '~~' },
  ...PERSONAS.map((p) => ({ id: p.id, name: p.name, eyes: `${p.eyes_l}${p.eyes_r}` })),
]

function findIdx(id: string | null): number {
  const i = ITEMS.findIndex((x) => x.id === id)
  return i >= 0 ? i : 0
}

interface Props {
  /** id выбранного кота. null — режим «авто» (детерминированный). */
  selectedId: string | null
  /** null — сбросить override; иначе — форс-выбор. */
  onPick: (id: string | null) => void
  disabled?: boolean
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: -dir * 28, opacity: 0 }),
}

export default function PersonaPicker({ selectedId, onPick, disabled }: Props) {
  const [idx, setIdx] = useState(() => findIdx(selectedId))
  // Направление прокрутки: 1 — вправо, -1 — влево. Управляет тем, с какой
  // стороны въезжает новая карточка и куда улетает старая.
  const [direction, setDirection] = useState<1 | -1>(1)

  // Ref-зеркало текущего idx: защищает от потери клика при быстрых
  // последовательных нажатиях, когда замыкание handler-а ещё не обновилось.
  const idxRef = useRef(idx)
  idxRef.current = idx

  // Внешний `selectedId` синхронизируется обратно: после фетча parent
  // отдаёт новый override, и карусель встаёт на нужного кота.
  useEffect(() => {
    const target = findIdx(selectedId)
    if (target !== idxRef.current) {
      // Определяем направление кратчайшего пути по кругу.
      const len = ITEMS.length
      const forward = (target - idxRef.current + len) % len
      const backward = (idxRef.current - target + len) % len
      setDirection(forward <= backward ? 1 : -1)
      idxRef.current = target
      setIdx(target)
    }
  }, [selectedId])

  const cycle = (delta: 1 | -1) => {
    if (disabled) return
    const next = ((idxRef.current + delta) % ITEMS.length + ITEMS.length) % ITEMS.length
    idxRef.current = next
    setDirection(delta)
    setIdx(next)
    onPick(ITEMS[next].id)
  }

  const cur = ITEMS[idx]

  return (
    <div className="flex items-center justify-center gap-1 select-none">
      <button
        type="button"
        onClick={() => cycle(-1)}
        disabled={disabled}
        aria-label="предыдущий кот"
        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Окно карусели — фиксированный размер, overflow:hidden, чтобы
          уезжающая и приезжающая карточки не растягивали соседей. */}
      <div className="relative w-[96px] h-[30px] overflow-hidden">
        <AnimatePresence custom={direction} initial={false} mode="popLayout">
          <motion.div
            key={idx}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0.34, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <span className="text-[12px] font-medium text-gray-700 dark:text-gray-200 leading-none">
              {cur.name}
            </span>
            <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">
              {cur.eyes}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => cycle(1)}
        disabled={disabled}
        aria-label="следующий кот"
        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  )
}
