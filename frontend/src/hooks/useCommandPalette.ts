import { useCallback, useEffect, useState } from 'react'

/**
 * Привязка к `event.code`, а не к `event.key`.
 *
 * На русской раскладке `event.key` для этой клавиши равен 'л', и проверка по
 * key молча перестала бы работать ровно у того пользователя, для которого это
 * приложение написано. `event.code` описывает физическую клавишу и от
 * раскладки не зависит.
 */
export function isPaletteShortcut(
  e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey'>,
): boolean {
  return e.code === 'KeyK' && (e.ctrlKey || e.metaKey)
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isPaletteShortcut(e)) return
      // Иначе браузер уведёт фокус в свой поиск по странице.
      e.preventDefault()
      setIsOpen((v) => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { isOpen, open, close }
}
