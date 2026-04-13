import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { reportsApi } from '@/api/reports'

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

export function useDailyTip() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const username = getUsernameFromToken()
  const cacheKey = `daily_tip_${today}_${username}`

  const [tip, setTip] = useState<string | null>(() => localStorage.getItem(cacheKey))
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (tip) return
    setIsLoading(true)
    reportsApi
      .getDailyTip()
      .then((data) => {
        setTip(data.tip)
        localStorage.setItem(cacheKey, data.tip)
      })
      .catch(() => {
        // GigaChat недоступен — питомец просто молчит
      })
      .finally(() => setIsLoading(false))
  }, [cacheKey, tip])

  return { tip, isLoading }
}
