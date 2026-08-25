import { useMemo, useRef } from 'react'

/** Столько держать палец, чтобы это считалось долгим нажатием. */
const DELAY_MS = 500

/**
 * Насколько палец может сползти и всё ещё считаться неподвижным.
 *
 * Ноль не годится: палец всегда чуть дрожит, и жест не срабатывал бы никогда.
 * Верхняя граница задана не вкусом, а dnd-kit: его PointerSensor в дереве
 * проектов стартует перетаскивание после 6px. Допуск обязан быть СТРОГО меньше,
 * иначе движение на 6-10px и начнёт драг, и через полсекунды откроет меню.
 */
const MOVE_TOLERANCE_PX = 5

interface Options {
  onLongPress: () => void
  delay?: number
  tolerance?: number
}

/**
 * Состояние жеста, вынесенное из хука, чтобы его можно было проверить тестом
 * без DOM: у проекта нет jsdom, а таймеры и отмена по прокрутке — это ровно то,
 * что ломается молча.
 */
export class LongPressTracker {
  private timer: ReturnType<typeof setTimeout> | null = null
  /** Сработал ли жест только что — чтобы проглотить следующий click. */
  private fired = false
  private startX = 0
  private startY = 0
  private readonly delay: number
  private readonly tolerance: number
  private readonly onLongPress: () => void

  constructor({ onLongPress, delay = DELAY_MS, tolerance = MOVE_TOLERANCE_PX }: Options) {
    this.onLongPress = onLongPress
    this.delay = delay
    this.tolerance = tolerance
  }

  start(x: number, y: number): void {
    // Повторный start без end оставил бы висеть первый таймер — жест сработал бы дважды.
    this.cancel()
    this.startX = x
    this.startY = y
    this.fired = false
    this.timer = setTimeout(() => {
      this.timer = null
      this.fired = true
      this.onLongPress()
    }, this.delay)
  }

  move(x: number, y: number): void {
    if (this.timer === null) return
    if (Math.abs(x - this.startX) > this.tolerance || Math.abs(y - this.startY) > this.tolerance) {
      this.cancel()
    }
  }

  end(): void {
    this.cancel()
  }

  /** true ровно один раз после срабатывания: снимает флаг при чтении. */
  consumeFired(): boolean {
    const was = this.fired
    this.fired = false
    return was
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

/** Готовые обработчики касаний для строки. */
export function useLongPress(onLongPress: () => void) {
  const cb = useRef(onLongPress)
  cb.current = onLongPress

  const tracker = useMemo(
    () => new LongPressTracker({ onLongPress: () => cb.current() }),
    [],
  )

  return useMemo(
    () => ({
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches[0]
        if (t) tracker.start(t.clientX, t.clientY)
      },
      onTouchMove: (e: React.TouchEvent) => {
        const t = e.touches[0]
        if (t) tracker.move(t.clientX, t.clientY)
      },
      onTouchEnd: () => tracker.end(),
      onTouchCancel: () => tracker.end(),
      // После долгого нажатия браузер всё равно шлёт click — без этого строка
      // открыла бы меню и тут же ушла по ссылке.
      onClickCapture: (e: React.MouseEvent) => {
        if (tracker.consumeFired()) {
          e.preventDefault()
          e.stopPropagation()
        }
      },
    }),
    [tracker],
  )
}
