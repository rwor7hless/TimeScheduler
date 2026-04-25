import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { reportsApi, type DailyTipPersona } from '@/api/reports'
import { getPersonaInfo } from '@/data/personas'

function getUsernameFromToken(): string {
  try {
    const token = localStorage.getItem('token')
    if (!token) return 'anon'
    const payload = JSON.parse(atob(token.split('.')[1]))
    return String(payload.sub ?? 'anon')
  } catch {
    return 'anon'
  }
}

export interface DailyTip {
  persona: DailyTipPersona
  short: string
  long: string
}

export function useDailyTip() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const username = getUsernameFromToken()
  // v2 — старый ключ `daily_tip_*` остаётся висеть, но не читается.
  const cacheKey = `pet_tip_v2_${today}_${username}`
  // Override живёт между днями: если пользователь выбрал «Лазер», он хочет
  // его и завтра, без повторного клика. Очищается только при выборе «авто».
  const overrideKey = `pet_tip_override_v1_${username}`

  const [tip, setTip] = useState<DailyTip | null>(() => {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    try {
      return JSON.parse(raw) as DailyTip
    } catch {
      return null
    }
  })
  const [overrideId, setOverrideIdState] = useState<string | null>(() => {
    return localStorage.getItem(overrideKey) || null
  })
  const [isLoading, setIsLoading] = useState(false)

  // Изначальный фетч: если в кеше нет тип-а — тянем с учётом текущего override.
  // Бэк кеширует per-(user, persona), так что повторный override-фетч дешёвый.
  useEffect(() => {
    if (tip || isLoading) return
    setIsLoading(true)
    reportsApi
      .getDailyTip(overrideId ?? undefined)
      .then((data) => {
        if (data.disabled || !data.persona || !data.short || !data.long) return
        const next: DailyTip = {
          persona: data.persona,
          short: data.short,
          long: data.long,
        }
        setTip(next)
        localStorage.setItem(cacheKey, JSON.stringify(next))
      })
      .catch(() => {
        // LLM недоступен — питомец молчит, фронт покажет fallback.
      })
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip, overrideId, cacheKey])

  /**
   * Зафиксировать конкретного кота. `null` — сбросить override на детерминированный
   * выбор. На бэке override доступен любому пользователю; на каждый уникальный
   * (user, persona) делается ровно один LLM-вызов в сутки.
   *
   * Оптимистично: сначала переключаем persona (глаза/имя — UI меняется
   * мгновенно), и только потом дожидаемся короткого/длинного текста от LLM.
   */
  const forcePersona = useCallback(
    (id: string | null) => {
      // Не дёргаем сеть, если выбрали то же, что уже стоит.
      if (id === overrideId) return

      // 1) Сохраняем выбор. Override живёт в localStorage между сессиями
      //    под отдельным ключом — переживает любые перезаходы.
      if (id === null) {
        localStorage.removeItem(overrideKey)
        localStorage.removeItem(cacheKey)
        setOverrideIdState(null)
      } else {
        localStorage.setItem(overrideKey, id)
        setOverrideIdState(id)
      }

      // 2) Оптимистичный UI — котик меняется СРАЗУ, до сетевого ответа.
      //    Для конкретного кота берём его глаза/имя из локального справочника.
      //    Для «авто» оставляем текущую персону: фактическая определится
      //    после ответа сервера, и моргать в дефолт по дороге не нужно.
      if (id === null) {
        setTip((cur) => (cur ? { ...cur, short: '', long: '' } : null))
      } else {
        const optimistic = getPersonaInfo(id)
        if (optimistic) {
          setTip({
            persona: {
              id: optimistic.id,
              name: optimistic.name,
              eyes_l: optimistic.eyes_l,
              eyes_r: optimistic.eyes_r,
            },
            short: '',
            long: '',
          })
        }
      }

      // 3) Сеть — короткий/длинный текст. Когда придёт, поверх optimistic
      //    положим реальный ответ; cacheKey за сегодня перепишется.
      setIsLoading(true)
      reportsApi
        .getDailyTip(id ?? undefined)
        .then((data) => {
          if (data.disabled || !data.persona || !data.short || !data.long) return
          const next: DailyTip = {
            persona: data.persona,
            short: data.short,
            long: data.long,
          }
          setTip(next)
          localStorage.setItem(cacheKey, JSON.stringify(next))
        })
        .catch(() => {})
        .finally(() => setIsLoading(false))
    },
    [cacheKey, overrideKey, overrideId],
  )

  /**
   * Принудительно перегенерировать совет (с тем же котом, если выбран
   * override). На бэке этот запрос обходит кеш и тянет свежий ответ от LLM,
   * результат пишется в кеш на остаток дня.
   */
  const refresh = useCallback(() => {
    if (isLoading) return
    setIsLoading(true)
    reportsApi
      .getDailyTip(overrideId ?? undefined, true)
      .then((data) => {
        if (data.disabled || !data.persona || !data.short || !data.long) return
        const next: DailyTip = {
          persona: data.persona,
          short: data.short,
          long: data.long,
        }
        setTip(next)
        localStorage.setItem(cacheKey, JSON.stringify(next))
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [cacheKey, overrideId, isLoading])

  return { tip, isLoading, forcePersona, overrideId, refresh }
}
