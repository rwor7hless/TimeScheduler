import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import type { DailyTipPersona } from '@/api/reports'

/**
 * AsciiPet — адаптивный ASCII-кот.
 *
 * Оси адаптации:
 *   1. Время суток        — sleeping / sleepy / day
 *   2. Дневной прогресс   — bored → content → happy → proud
 *   3. Событие-done       — celebrateKey → вспышка + искры
 *   4. Взаимодействие     — клик по коту = «погладить»: мурчит, прикрывает
 *                           глаза, сердечки; работает и для спящего (тихое)
 *   5. Часовой пересчёт   — каждый час и на смену стейта кот подбирает
 *                           свежую контекстную фразу (из локального пула;
 *                           если родитель передал tip — используется он)
 */

type Mood =
  | 'sleeping'
  | 'sleepy'
  | 'bored'
  | 'content'
  | 'happy'
  | 'proud'
  | 'celebrate'
  | 'petted'

interface Face {
  eyeL: string
  eyeR: string
  mouth: string
  ears: string
  tint: string
  label: string
}

const MOODS: Record<Mood, Face> = {
  sleeping:   { eyeL: '-', eyeR: '-', mouth: '> ~ <', ears: '/\\_/\\', tint: 'var(--color-muted)',         label: 'спит'   },
  sleepy:     { eyeL: '~', eyeR: '~', mouth: '> _ <', ears: '/\\_/\\', tint: 'var(--color-text-secondary)', label: 'сонный' },
  bored:      { eyeL: '·', eyeR: '·', mouth: '> _ <', ears: '/\\_/\\', tint: 'var(--color-text-secondary)', label: 'скучает'},
  content:    { eyeL: 'o', eyeR: 'o', mouth: '> ^ <', ears: '/\\_/\\', tint: 'var(--color-text)',          label: 'наблюдает' },
  happy:      { eyeL: '^', eyeR: '^', mouth: '> w <', ears: '/\\_/\\', tint: 'var(--color-accent)',        label: 'рад'     },
  proud:      { eyeL: '★', eyeR: '★', mouth: '> ᵕ <', ears: '/\\_/\\', tint: 'var(--color-accent)',        label: 'горд'    },
  celebrate:  { eyeL: '*', eyeR: '*', mouth: '> ◡ <', ears: '/\\_/\\', tint: 'var(--color-accent-light)',  label: 'ура!'    },
  petted:     { eyeL: 'u', eyeR: 'u', mouth: '> ◡ <', ears: '/\\_/\\', tint: 'var(--color-accent)',        label: 'мрррр'   },
}

const BLINK: Partial<Face> = { eyeL: '-', eyeR: '-' }
const WINK:  Partial<Face> = { eyeL: 'o', eyeR: '-' }

function resolveBaseMood(hour: number, progress: number): Mood {
  if (hour >= 22 || hour < 5) return 'sleeping'
  if (hour >= 5 && hour < 8)  return progress > 0.3 ? 'happy' : 'sleepy'
  if (progress >= 0.95)       return 'proud'
  if (progress >= 0.6)        return 'happy'
  if (progress >= 0.25)       return 'content'
  return 'bored'
}

// ── Контекстные фразы ────────────────────────────────────────────────────
// Простой локальный пул. Раз в час кот подбирает новую реплику по бакету.
// Никаких LLM вызовов — быстро, офлайн, предсказуемо.

type Bucket =
  | 'morning-empty'
  | 'morning-warm'
  | 'day-bored'
  | 'day-working'
  | 'day-streak'
  | 'day-almost'
  | 'day-done'
  | 'evening-bored'
  | 'evening-warm'
  | 'night'
  | 'petted'
  | 'just-done'

const PHRASES: Record<Bucket, string[]> = {
  'morning-empty':  ['Утро. Чайку?',          'Что планируем?',      'С чего начнём?',         'Ещё потянемся — и вперёд'],
  'morning-warm':   ['Бодрое утро, я смотрю', 'Так держать с утра',  'Ты сегодня ранняя пташка'],
  'day-bored':      ['Ну что, приступим?',    'Хоть одну закроешь?', 'Скучновато тут...',      'Даже одна задача — уже движение'],
  'day-working':    ['Идёт работа',           'Хороший темп',        'Потихоньку, потихоньку', 'Видно, что стараешься'],
  'day-streak':     ['Ого, на волне!',        'Огонь сегодня',       'Ты прям включился',      'Не сбавляй'],
  'day-almost':     ['Чуть-чуть осталось',    'Финишная прямая',     'Ещё немного — и всё'],
  'day-done':       ['Всё закрыто! Кайф',     'Ты сегодня герой',    'Можно и поспать',        'Мрр, какая продуктивность'],
  'evening-bored':  ['День почти прошёл...',  'Может ещё одну?',     'Не обязательно сегодня'],
  'evening-warm':   ['Достойный день',        'Хорошо поработали',   'Можно выдохнуть'],
  'night':          ['Зззз...',               'Тссс, я сплю',        'Уже ночь',               '*сопит*'],
  'petted':         ['Мрррр',                 'Ещё, ещё...',         '♡ ♡ ♡',                  'Ты лучший'],
  'just-done':      ['Отлично!',              'Есть ещё одна!',      'Так держать',            'Мурр!'],
}

function pickBucket(
  hour: number,
  progress: number,
  sinceLastDoneMs: number | null,
): Bucket {
  // Ночь
  if (hour >= 22 || hour < 5) return 'night'

  // Недавно что-то закрыл (< 90 сек) — свежая реакция
  if (sinceLastDoneMs !== null && sinceLastDoneMs < 90_000) return 'just-done'

  const morning = hour >= 5 && hour < 11
  const evening = hour >= 19 && hour < 22

  if (morning) return progress >= 0.25 ? 'morning-warm' : 'morning-empty'
  if (evening) return progress >= 0.5  ? 'evening-warm' : 'evening-bored'

  // День
  if (progress >= 0.95) return 'day-done'
  if (progress >= 0.75) return 'day-almost'
  if (progress >= 0.5)  return 'day-streak'
  if (progress >= 0.2)  return 'day-working'
  return 'day-bored'
}

function pickFrom<T>(pool: T[], seed: number): T {
  return pool[((seed % pool.length) + pool.length) % pool.length]
}

interface Props {
  short: string | null
  long: string | null
  persona: DailyTipPersona | null
  isLoading: boolean
  /** 0..1 — доля выполненных задач/привычек за сегодня */
  progress?: number
  /** Инкрементируется вызывающим при каждом успешном переходе в done. */
  celebrateKey?: number
  /**
   * horizontal — кот слева, бабл справа (комикс-стиль, занимает ширину).
   * vertical   — кот сверху, бабл снизу (узкие сайдбары).
   */
  layout?: 'horizontal' | 'vertical'
}

export default function AsciiPet({
  short,
  long,
  persona,
  isLoading,
  progress = 0,
  celebrateKey = 0,
  layout = 'vertical',
}: Props) {
  const hour = new Date().getHours()

  // ── Базовое настроение ────────────────────────────────────────────────
  const baseMood = useMemo<Mood>(
    () => resolveBaseMood(hour, progress),
    [hour, progress],
  )

  // ── Celebrate ─────────────────────────────────────────────────────────
  const [celebrating, setCelebrating] = useState(false)
  const [sparkleBurst, setSparkleBurst] = useState(0)
  const firstRunRef = useRef(true)
  const lastDoneRef = useRef<number | null>(null)
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return }
    lastDoneRef.current = Date.now()
    if (baseMood === 'sleeping') return
    setCelebrating(true)
    setSparkleBurst((k) => k + 1)
    const t = setTimeout(() => setCelebrating(false), 1400)
    return () => clearTimeout(t)
  }, [celebrateKey, baseMood])

  // ── Petting (клик по коту) ───────────────────────────────────────────
  const [petting, setPetting] = useState(false)
  const [heartBurst, setHeartBurst] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const handlePet = useCallback(() => {
    setPetting(true)
    setHeartBurst((k) => k + 1)
    const t = setTimeout(() => setPetting(false), 1600)
    return () => clearTimeout(t)
  }, [])

  // ── Моргание/wink поверх базового mood ───────────────────────────────
  const [overlay, setOverlay] = useState<'none' | 'blink' | 'wink'>('none')
  useEffect(() => {
    if (baseMood === 'sleeping' || petting) return
    let live = true
    let t: ReturnType<typeof setTimeout>
    const schedule = () => {
      // Реже: 7-14с между морганиями
      const delay = 7000 + Math.random() * 7000
      t = setTimeout(() => {
        if (!live) return
        const pick = Math.random() < 0.12 ? 'wink' : 'blink'
        setOverlay(pick)
        setTimeout(() => {
          if (!live) return
          setOverlay('none')
          schedule()
        }, pick === 'wink' ? 260 : 140)
      }, delay)
    }
    schedule()
    return () => { live = false; clearTimeout(t) }
  }, [baseMood, petting])

  // ── Итоговый mood / лицо ─────────────────────────────────────────────
  const mood: Mood = petting
    ? 'petted'
    : celebrating
    ? 'celebrate'
    : baseMood
  // Персона перекрывает глаза ТОЛЬКО в базовом content-mood.
  // Другие (sleeping, celebrate, petted, proud, …) логически важнее персоны.
  const base: Face = mood === 'content' && persona
    ? { ...MOODS.content, eyeL: persona.eyes_l, eyeR: persona.eyes_r }
    : MOODS[mood]
  const face: Face = {
    ...base,
    ...(overlay === 'blink' && !petting ? BLINK : overlay === 'wink' && !petting ? WINK : {}),
  }
  const asciiArt = `${face.ears}\n(${face.eyeL}.${face.eyeR})\n${face.mouth}`

  // ── Контекстная фраза. Пересчитывается раз в час (или на смену стейта).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const contextualPhrase = useMemo(() => {
    // Petting показывает свой пул сразу
    if (petting) return pickFrom(PHRASES.petted, heartBurst)
    const sinceDone = lastDoneRef.current ? Date.now() - lastDoneRef.current : null
    const bucket = pickBucket(hour, progress, sinceDone)
    const pool = PHRASES[bucket]
    // Меняем по: tick (час), celebrateKey (событие), bucket-строка (переход)
    const seed = tick * 7 + celebrateKey * 13 + bucket.length
    return pickFrom(pool, seed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, celebrateKey, hour, progress, petting, heartBurst])

  const isNight = mood === 'sleeping'
  const progressPct = Math.round(progress * 100)

  // Персона от родителя (short/long) имеет приоритет над контекстом;
  // petting всегда показывает свою фразу.
  const bubbleText: string | null = petting
    ? contextualPhrase
    : isLoading
    ? null
    : (expanded && long) || short || contextualPhrase
  // «ещё» показываем только когда есть РАЗНЫЕ short и long от родителя.
  const canExpand = !petting && !!short && !!long && long !== short

  // ── Сам кот (без бабла и без лейбла) ─────────────────────────────────
  const petCore = (
    <div className="relative w-[120px] h-[70px] flex items-center justify-center flex-shrink-0">
        {/* Ореол */}
        <div
          aria-hidden
          className="absolute inset-0 flex justify-center items-center pointer-events-none"
        >
          <div
            className="w-24 h-24 rounded-full blur-2xl opacity-60 transition-colors duration-700"
            style={{
              background:
                mood === 'proud' || mood === 'celebrate' || mood === 'petted'
                  ? 'radial-gradient(circle, rgba(217,119,6,0.28), transparent 70%)'
                  : mood === 'happy'
                  ? 'radial-gradient(circle, rgba(217,119,6,0.14), transparent 70%)'
                  : isNight
                  ? 'radial-gradient(circle, rgba(148,163,184,0.10), transparent 70%)'
                  : 'radial-gradient(circle, rgba(217,119,6,0.06), transparent 70%)',
            }}
          />
        </div>

        {/* Кот — кликабелен, центрирован */}
        <motion.button
          type="button"
          onClick={handlePet}
          aria-label="погладить"
          className="relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
          style={{ padding: 4 }}
          whileHover={!isNight ? { scale: 1.04 } : undefined}
          whileTap={{ scale: 0.94 }}
        >
          <motion.pre
            className="font-mono pointer-events-none m-0 text-center"
            style={{
              fontSize: '15px',
              lineHeight: '1.2',
              fontWeight: 600,
              color: face.tint,
              // моноширинная табуляция, чтобы ★ / ◡ / ᵕ не дёргали ширину строки
              fontVariantNumeric: 'tabular-nums',
              minWidth: '6ch',
              textShadow:
                mood === 'celebrate'
                  ? '0 0 8px rgba(245,158,11,0.4)'
                  : mood === 'petted'
                  ? '0 0 6px rgba(217,119,6,0.25)'
                  : 'none',
              willChange: 'transform',
            }}
            animate={
              isNight
                ? { y: [0, -1, 0], opacity: [0.75, 0.9, 0.75] }
                : mood === 'celebrate'
                ? { y: [0, -3, 0, -3, 0] }
                : mood === 'petted'
                ? { y: [0, -1, 0] }
                : { y: [0, -1.2, 0] }
            }
            transition={
              isNight
                ? { duration: 5.4, repeat: Infinity, ease: 'easeInOut' }
                : mood === 'celebrate'
                ? { duration: 1.0, ease: 'easeInOut' }
                : mood === 'petted'
                ? { duration: 0.9, repeat: 1, ease: 'easeInOut' }
                : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            {asciiArt}
          </motion.pre>
        </motion.button>

        {/* Z Z Z спящему */}
        {isNight && !petting && (
          <div
            aria-hidden
            className="absolute -top-1 right-1 font-display text-[13px] text-gray-400 dark:text-gray-600"
          >
            <motion.span
              className="inline-block"
              animate={{ y: [0, -6, -12], opacity: [0, 1, 0], scale: [0.8, 1, 1.1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
            >
              z
            </motion.span>
          </div>
        )}

        {/* Искры на celebrate */}
        <AnimatePresence>
          {celebrating && (
            <motion.div
              key={`spark-${sparkleBurst}`}
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[
                { x: -22, y: -14, d: 0 },
                { x:  24, y: -10, d: 0.12 },
                { x: -18, y:  14, d: 0.22 },
                { x:  20, y:  16, d: 0.32 },
                { x:   0, y: -22, d: 0.08 },
              ].map((s, i) => (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 text-amber-500 dark:text-amber-400 text-xs"
                  initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.7], x: s.x, y: s.y }}
                  transition={{ duration: 1.0, delay: s.d, ease: 'easeOut' }}
                >
                  ✦
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Сердечки на petting */}
        <AnimatePresence>
          {petting && (
            <motion.div
              key={`heart-${heartBurst}`}
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[
                { x: -14, d: 0,    delay: 0 },
                { x:  12, d: 0.15, delay: 0.1 },
                { x:  -2, d: 0.1,  delay: 0.25 },
              ].map((h, i) => (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 text-rose-400 dark:text-rose-300 text-xs"
                  initial={{ opacity: 0, scale: 0.6, x: h.x, y: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 0.8], y: -28 }}
                  transition={{ duration: 1.1, delay: h.delay, ease: 'easeOut' }}
                >
                  ♡
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  )

  // ── Лейбл настроения + прогресс ──────────────────────────────────────
  const moodBar = (
    <div className="h-4 flex items-center justify-center gap-1.5">
      <span
        className="font-display text-[11px] tracking-wide transition-colors duration-500"
        style={{ color: face.tint, fontVariationSettings: '"SOFT" 50, "opsz" 14', fontWeight: 500 }}
      >
        {face.label}
      </span>
      <span className="text-gray-300 dark:text-gray-600 text-[10px]">·</span>
      <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
        {progressPct}%
      </span>
    </div>
  )

  // ── Бабл (два варианта «хвостика»: сверху для vertical, слева для horizontal)
  const bubble = (isLoading || !!bubbleText) ? (
    <motion.div
      initial={{ opacity: 0, y: layout === 'vertical' ? -4 : 0, x: layout === 'horizontal' ? -4 : 0 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.35 }}
      className={layout === 'vertical' ? 'w-full max-w-[220px] mx-auto' : 'flex-1 min-w-0'}
    >
      {/* Хвостик — сверху для vertical */}
      {layout === 'vertical' && (
        <div className="flex justify-center -mb-px">
          <div className="w-2 h-2 bg-white dark:bg-[var(--color-surface)] border-l border-t border-gray-200 dark:border-[var(--color-border)] rotate-45" />
        </div>
      )}
      <div
        className={clsx(
          'relative bg-white dark:bg-[var(--color-surface)] border border-gray-200 dark:border-[var(--color-border)] rounded-2xl px-3.5 py-2.5 shadow-paper',
          canExpand && 'pb-7',
        )}
      >
        {/* Хвостик — слева для horizontal */}
        {layout === 'horizontal' && (
          <>
            <div
              aria-hidden
              className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-2 h-2 bg-white dark:bg-[var(--color-surface)] border-l border-b border-gray-200 dark:border-[var(--color-border)] rotate-45"
            />
          </>
        )}
        {isLoading ? (
          <div className="flex gap-1 py-1 justify-center min-h-[20px] items-center">
            {[0, 130, 260].map(d => (
              <span
                key={d}
                className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={bubbleText}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className={clsx(
                  'font-display text-[12.5px] leading-[1.45] text-gray-700 dark:text-gray-200',
                  !expanded && canExpand && 'line-clamp-3',
                )}
                style={{ fontVariationSettings: '"SOFT" 60, "opsz" 14', fontWeight: 450 }}
              >
                {bubbleText}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
        {persona && !petting && !isLoading && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            — {persona.name}
          </div>
        )}
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="absolute bottom-1.5 right-2.5 text-[10.5px] font-medium text-amber-600 dark:text-amber-400 hover:underline focus:outline-none"
          >
            {expanded ? 'свернуть' : 'ещё'}
          </button>
        )}
      </div>
    </motion.div>
  ) : null

  // ── Раскладка ────────────────────────────────────────────────────────
  if (layout === 'horizontal') {
    return (
      <div
        className="select-none flex items-center gap-3"
        aria-label={`питомец: ${face.label}`}
      >
        <div className="flex flex-col items-center flex-shrink-0">
          {petCore}
          <div className="mt-1">{moodBar}</div>
        </div>
        {bubble}
      </div>
    )
  }

  return (
    <div className="select-none flex flex-col items-center" aria-label={`питомец: ${face.label}`}>
      {petCore}
      <div className="mt-2">{moodBar}</div>
      {bubble && <div className="mt-3 w-full">{bubble}</div>}
    </div>
  )
}
