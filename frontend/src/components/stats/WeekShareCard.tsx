import { forwardRef } from 'react'
import { addDays, format, getISOWeek, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Stats } from '@/types/stats'

interface Props {
  weekStart: string
  stats: Stats
  /** Top-3 advice strings lifted from the AI report (optional). */
  advice?: string[]
}

/**
 * 1080x1920 stories-format card rendered off-screen then rasterized by
 * html-to-image. Design rules forced on us by the renderer:
 *   • No multi-layer background-image gradients (html-to-image drops them).
 *   • No `-webkit-background-clip: text` (dropped too — renders blank).
 *   • All sizes explicit in px, no `flex: 1` magic (SVG foreignObject is
 *     flaky on intrinsic flex sizing).
 *   • Plain hex colors only — no CSS vars, no Tailwind classes.
 *
 * The card lives always-mounted in a 0x0 overflow:hidden wrapper so the
 * browser keeps it laid out and painted; we never toggle visibility.
 */
export const WeekShareCard = forwardRef<HTMLDivElement, Props>(
  ({ weekStart, stats, advice }, ref) => {
    const monday = parseISO(weekStart)
    const sunday = addDays(monday, 6)
    const weekNumber = getISOWeek(monday)
    const sameMonth = monday.getMonth() === sunday.getMonth()
    const range = sameMonth
      ? `${format(monday, 'd', { locale: ru })}–${format(sunday, 'd MMMM yyyy', { locale: ru })}`
      : `${format(monday, 'd MMM', { locale: ru })} — ${format(sunday, 'd MMM yyyy', { locale: ru })}`

    const activeDays = stats.daily_completions.filter((d) => d.count > 0).length
    const productivity = stats.productivity_percent

    return (
      <div ref={ref} style={styles.card}>
        {/* Header */}
        <div style={styles.headerBar}>
          <div style={styles.eyebrow}>TimeScheduler · Неделя {weekNumber}</div>
          <div style={styles.dateRange}>{range}</div>
        </div>

        {/* Hero 3 metrics */}
        <div style={styles.heroRow}>
          <HeroCell label="Выполнено" value={String(stats.completed_last_month)} />
          <HeroCell
            label="Продуктивность"
            value={productivity != null ? `${Math.round(productivity)}%` : '—'}
          />
          <HeroCell label="Активных дней" value={`${activeDays}/7`} />
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Daily bars */}
        <div style={styles.sectionBlock}>
          <div style={styles.sectionEyebrow}>По дням недели</div>
          <DailyBarsBig weekStart={weekStart} dailyCompletions={stats.daily_completions} />
        </div>

        {/* Top advice */}
        {advice && advice.length > 0 && (
          <div style={styles.sectionBlock}>
            <div style={styles.sectionEyebrow}>Советы на следующую неделю</div>
            <div style={styles.adviceList}>
              {advice.slice(0, 3).map((a, i) => (
                <div key={i} style={styles.adviceRow}>
                  <div style={styles.adviceBadge}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={styles.adviceText}>{a}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerLabel}>Моя неделя в TimeScheduler</div>
          <div style={styles.footerBrand}>timescheduler</div>
        </div>
      </div>
    )
  },
)
WeekShareCard.displayName = 'WeekShareCard'

function HeroCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.heroCell}>
      <div style={styles.heroValue}>{value}</div>
      <div style={styles.heroLabel}>{label}</div>
    </div>
  )
}

function DailyBarsBig({
  weekStart,
  dailyCompletions,
}: {
  weekStart: string
  dailyCompletions: { date: string; count: number }[]
}) {
  const monday = parseISO(weekStart)
  const countByDate = new Map(dailyCompletions.map((d) => [d.date, d.count]))
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      label: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i],
      count: countByDate.get(iso) ?? 0,
    }
  })
  const max = Math.max(1, ...days.map((d) => d.count))
  const columnWidth = Math.floor((1080 - 144 /* padding */ - 6 * 18 /* gaps */) / 7)

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', height: 280 }}>
      {days.map((d) => {
        const h = d.count === 0 ? 10 : Math.max(10, Math.round((d.count / max) * 260))
        return (
          <div
            key={d.label}
            style={{
              width: columnWidth,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: columnWidth,
                height: h,
                marginBottom: 16,
                borderRadius: '12px 12px 4px 4px',
                backgroundColor: d.count === 0 ? '#334155' : '#F59E0B',
                boxShadow: d.count === 0 ? 'none' : '0 0 24px rgba(245,158,11,0.35)',
              }}
            />
            <div style={{ fontSize: 22, color: '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>
              {d.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#E2E8F0' }}>{d.count}</div>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    width: 1080,
    height: 1920,
    backgroundColor: '#0F172A',
    padding: 72,
    fontFamily: "Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    color: '#F1F5F9',
    boxSizing: 'border-box',
  },
  headerBar: {
    marginBottom: 48,
  },
  eyebrow: {
    fontSize: 24,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#D97706',
    fontWeight: 700,
    marginBottom: 14,
  },
  dateRange: {
    fontSize: 56,
    fontWeight: 700,
    letterSpacing: -1,
    color: '#F1F5F9',
  },
  heroRow: {
    display: 'flex',
    gap: 20,
    marginBottom: 56,
  },
  heroCell: {
    width: 296,
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    borderRadius: 28,
    padding: '30px 24px',
    boxSizing: 'border-box',
  },
  heroValue: {
    fontSize: 88,
    fontWeight: 800,
    letterSpacing: -2,
    lineHeight: 1,
    color: '#F59E0B',
  },
  heroLabel: {
    marginTop: 14,
    fontSize: 20,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  divider: {
    height: 3,
    width: 180,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
    marginBottom: 56,
  },
  sectionBlock: {
    marginBottom: 64,
  },
  sectionEyebrow: {
    fontSize: 22,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#94A3B8',
    marginBottom: 22,
  },
  adviceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  adviceRow: {
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    borderRadius: 20,
    padding: '22px 26px',
  },
  adviceBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    color: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 800,
    flexShrink: 0,
  },
  adviceText: {
    fontSize: 26,
    lineHeight: 1.35,
    color: '#E2E8F0',
    marginTop: 8,
  },
  footer: {
    marginTop: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 20,
    color: '#64748B',
  },
  footerLabel: {
    color: '#64748B',
  },
  footerBrand: {
    fontWeight: 700,
    color: '#F59E0B',
    letterSpacing: 1,
  },
}
