import { useCallback, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { toPng } from 'html-to-image'
import type { Stats } from '@/types/stats'
import Button from '@/components/ui/Button'
import { WeekShareCard } from './WeekShareCard'

interface Props {
  weekStart: string
  stats: Stats
  /** Markdown of the AI report (done only), used to lift top-3 advice. */
  reportMarkdown: string | null
}

function extractTopAdvice(md: string | null, n: number = 3): string[] {
  if (!md) return []
  const lines = md.split('\n')
  let inAdvice = false
  const items: string[] = []
  let current = ''
  for (const raw of lines) {
    const line = raw.trim()
    if (/^##\s+.*совет/i.test(line)) {
      inAdvice = true
      continue
    }
    if (inAdvice && /^##\s+/.test(line)) break
    if (!inAdvice) continue
    const m = line.match(/^\d+\.\s+(.*)$/)
    if (m) {
      if (current) items.push(current)
      current = m[1]
    } else if (line && current) {
      current += ' ' + line
    }
  }
  if (current) items.push(current)
  return items
    .map((s) => s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim())
    .slice(0, n)
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

/**
 * Reliable cross-browser download: create anchor, attach to DOM, click, remove.
 * Some Firefox/Safari versions silently ignore anchors that aren't in the document.
 */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return await res.blob()
}

export function ShareWeekButton({ weekStart, stats, reportMarkdown }: Props) {
  const shareRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const advice = extractTopAdvice(reportMarkdown)

  const handleShare = useCallback(async () => {
    if (!shareRef.current) return
    setBusy(true)
    try {
      // Ensure web fonts are resolved — otherwise Inter swaps mid-rasterize
      // and the layout looks broken or the whole capture is blank.
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        try {
          await document.fonts.ready
        } catch {
          /* ignore — proceed with system fallback fonts */
        }
      }
      // Two animation frames: first to flush any pending state/layout,
      // second to ensure the browser has fully painted the card.
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))

      const dataUrl = await toPng(shareRef.current, {
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#0F172A',
        width: 1080,
        height: 1920,
      })
      const fileName = `timescheduler-week-${weekStart}.png`
      const blob = await dataUrlToBlob(dataUrl)

      // Try native share only on touch devices (mobile). On desktop Chrome/Edge
      // `navigator.canShare({files})` can return true but opens the Windows
      // Share panel, which is not what users expect when they click "save".
      if (isTouchDevice() && typeof navigator !== 'undefined') {
        const maybeShare = navigator as Navigator & {
          share?: (data: ShareData) => Promise<void>
          canShare?: (data: ShareData) => boolean
        }
        if (maybeShare.share && maybeShare.canShare) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' })
            if (maybeShare.canShare({ files: [file] })) {
              await maybeShare.share({
                files: [file],
                title: 'Моя неделя в TimeScheduler',
              })
              return
            }
          } catch {
            // User cancelled share sheet or share rejected — fall through to download.
          }
        }
      }

      downloadBlob(blob, fileName)
      toast.success('Картинка сохранена')
    } catch (err) {
      console.error('Share failed:', err)
      toast.error('Не удалось создать картинку')
    } finally {
      setBusy(false)
    }
  }, [weekStart])

  return (
    <>
      <Button type="button" onClick={handleShare} disabled={busy} variant="secondary">
        {busy ? 'Готовлю…' : 'Сохранить неделю картинкой'}
      </Button>
      {/* Always-mounted, zero-footprint clip so the 1080×1920 card is laid out
          and painted (html-to-image captures via cloneNode + getComputedStyle,
          which needs the child to be in the render tree), but doesn't occupy
          screen space. We intentionally avoid opacity:0 because some browsers
          skip child paints under a fully transparent parent. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <WeekShareCard ref={shareRef} weekStart={weekStart} stats={stats} advice={advice} />
      </div>
    </>
  )
}
