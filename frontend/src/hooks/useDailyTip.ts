import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { reportsApi, type DailyTipPersona } from '@/api/reports'

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

  const [tip, setTip] = useState<DailyTip | null>(() => {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    try {
      return JSON.parse(raw) as DailyTip
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (tip) return
    setIsLoading(true)
    reportsApi
      .getDailyTip()
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
  }, [cacheKey, tip])

  return { tip, isLoading }
}
