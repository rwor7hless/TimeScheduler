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
  | 'dizzy'

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
  dizzy:      { eyeL: '@', eyeR: '@', mouth: '~ . ~', ears: '/\\_/\\', tint: 'var(--color-accent)',        label: 'кружит' },
}

const BLINK:    Partial<Face> = { eyeL: '-', eyeR: '-' }
const WINK:     Partial<Face> = { eyeL: 'o', eyeR: '-' }
const GLANCE_L: Partial<Face> = { eyeL: '<', eyeR: '<' }
const GLANCE_R: Partial<Face> = { eyeL: '>', eyeR: '>' }
const YAWN:     Partial<Face> = { eyeL: '~', eyeR: '~', mouth: '> O <' }

/** Кадры глаз для анимации головокружения — кот «вращает» зрачки 10 секунд. */
const DIZZY_EYE_FRAMES = ['@', '⊗', '✱', '◉', '✺', '◎']
const DIZZY_DURATION_MS = 10_000

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
  | 'petted-extra'
  | 'petted-too-much'
  | 'just-done'

const PHRASES: Record<Bucket, string[]> = {
  'morning-empty': [
    'Утро. Чайку?',
    'Что планируем?',
    'С чего начнём?',
    'Ещё потянемся — и вперёд',
    'Утро ленивое. Окей.',
    'Сначала чай. Потом тоже чай.',
    'Чистый лист — и хорошо.',
    'Так-так. День начинается.',
  ],
  'morning-warm': [
    'Бодрое утро, я смотрю',
    'Так держать с утра',
    'Ты сегодня ранняя пташка',
    'Уже что-то закрыл? Уважаю.',
    'Утром — самое то.',
    'Хороший разгон.',
    'Завожу мотор вместе с тобой.',
  ],
  'day-bored': [
    'Ну что, приступим?',
    'Хоть одну закроешь?',
    'Скучновато тут...',
    'Даже одна задача — уже движение',
    'Список не двигается, и я тоже.',
    'Если бы я мог жать чекбоксы — я бы помог.',
    'Полудрёма продуктивности.',
    'Можно одну. Маленькую.',
  ],
  'day-working': [
    'Идёт работа',
    'Хороший темп',
    'Потихоньку, потихоньку',
    'Видно, что стараешься',
    'Ровно идём',
    'Не суетись, и так норма.',
    'Шум стоит — рабочий шум.',
  ],
  'day-streak': [
    'Ого, на волне!',
    'Огонь сегодня',
    'Ты прям включился',
    'Не сбавляй',
    'Я даже зажмурился. Серьёзно.',
    'Темп держится — и хорошо.',
    'Так-так. Серия.',
    'Ты сегодня поезд.',
  ],
  'day-almost': [
    'Чуть-чуть осталось',
    'Финишная прямая',
    'Ещё немного — и всё',
    'Видно дно списка.',
    'Финал близко.',
    'Совсем рядом, ага.',
  ],
  'day-done': [
    'Всё закрыто! Кайф',
    'Ты сегодня герой',
    'Можно и поспать',
    'Мрр, какая продуктивность',
    'Список пуст. Тишина.',
    'Я бы и сам так не смог.',
    'Это была охота. И ты выиграл.',
  ],
  'evening-bored': [
    'День почти прошёл...',
    'Может ещё одну?',
    'Не обязательно сегодня',
    'Если устал — это тоже окей.',
    'Завтра тоже день.',
    'Перенос — это тоже решение.',
  ],
  'evening-warm': [
    'Достойный день',
    'Хорошо поработали',
    'Можно выдохнуть',
    'Закат над списком — самое то.',
    'Сегодня было.',
    'Свет на половине, дела на половине. Норма.',
  ],
  'night': [
    'Зззз...',
    'Тссс, я сплю',
    'Уже ночь',
    '*сопит*',
    'Лапы в калачик.',
    'Луна. Тихо.',
    'Завтра разбудишь.',
  ],
  'petted': [
    'Мрррр',
    'Ещё, ещё...',
    '♡ ♡ ♡',
    'Ты лучший',
    'Хорошо так.',
    'Тёплая рука.',
    'Уши тоже учитываются.',
  ],
  'petted-extra': [
    'О, ещё ласки?',
    'Так и баловать можно.',
    'Мрр-мрр-мрр.',
    'Серьёзная порция любви.',
    'Так и привыкнуть недолго.',
  ],
  'petted-too-much': [
    'Ой-ой, голова кружится',
    'Хватит, хватит, мрр...',
    'Передоз ласки!',
    'Дай отдышаться',
    '*шатается*',
  ],
  'just-done': [
    'Отлично!',
    'Есть ещё одна!',
    'Так держать',
    'Мурр!',
    'Минус одна — приятно.',
    'Закрыто. Дальше.',
    'Один шаг — и хороший шаг.',
  ],
}

/**
 * Перекрытия фраз под персону: кот говорит в своём голосе.
 * Если бакета нет — fallback на общий PHRASES.
 * Достаточно покрыть «интерактивные» бакеты (petted/just-done) — остальные
 * могут оставаться общими, чтобы не утомлять однотипностью.
 */
const PERSONA_PHRASES: Record<string, Partial<Record<Bucket, string[]>>> = {
  suhar: {
    'petted':           ['Ладно, ладно...',     'Один раз. Хватит.',     '*вздыхает*',       'Мрр. Нехотя.',         'Не балуй меня.'],
    'petted-extra':     ['Сколько можно.',      'Тяжко тебе сегодня?',   'Ну, добавки.'],
    'petted-too-much':  ['Иди, иди.',           'Достаточно. Сказал.',   'Пожалей кота.'],
    'just-done':        ['Закрыл. Хорошо.',     'Одна. И что.',          'Хм. Норма.',       'Поработал — отойди.'],
    'day-bored':        ['Тишина в списке.',    'Скучно. Опять.',        'Ну хоть бы одну.',  'Лапы устали ждать.'],
    'night':            ['Сплю. Не мешай.',     'Тссс.',                  '*ворчит во сне*'],
  },
  valeryan: {
    'petted':           ['Прикосновение — пунктуация дня.', 'Тёплый ритуал.',  'В этом что-то от музыки.', 'Тактильная философия.'],
    'petted-extra':     ['Рука как маятник, я как метроном.', 'Контакт повторяется — значит, имеет смысл.'],
    'petted-too-much':  ['Слишком много нежности — это тоже метафора.', 'Мир прикасается слишком плотно.'],
    'just-done':        ['Задача растворилась.', 'Один штрих в дневнике вечности.', 'Вселенная едва вздохнула.'],
    'day-bored':        ['Время капает. Список молчит.', 'Тишина пахнет несделанным.'],
  },
  blin: {
    'petted':           ['Хорошо.',            'Мрр.',           'Так лучше.',     'Тише.'],
    'petted-extra':     ['Достаточно.',         'Уже хорошо.'],
    'petted-too-much':  ['Хватит.',             'Стоп.'],
    'just-done':        ['Готово.',             'Одна.',           'Закрыта.',     'Дальше.'],
    'day-bored':        ['Пусто. Начни.',       'Одна задача. Возьми её.'],
    'morning-empty':    ['Утро. Шаг.',           'Один шаг. Этого хватит.'],
  },
  shprot: {
    'petted':           ['Документирую: контакт.', 'Подозрительно мягко.', 'Алиби — мурчание.', 'Свидетель чесания.'],
    'petted-extra':     ['Слишком регулярные жесты. Подозрительно.', 'Это уже улика.'],
    'petted-too-much':  ['Дело закрыто. И я тоже.', 'Перебор. Уходим в тень.'],
    'just-done':        ['Закрыто. Дело сшито.',    'В архив.',           'Минус один свидетель.'],
    'day-bored':        ['Ни одного следа в списке.', 'Тишина — тоже улика.'],
  },
  plyushka: {
    'petted':           ['Мрррр-у-у!',          'Ещё, ещё!',         '♡ моё сердечко ♡',  'Ты прелесть!',  'Тёплый ты.'],
    'petted-extra':     ['Тут уже сердце тает',  'Так и хочется ещё.', 'Ого, какая забота'],
    'petted-too-much':  ['Ой, голова... но классно.', 'Я люблю тебя, но дай вдохнуть', 'Слишком хорошо — это тоже состояние'],
    'just-done':        ['Воу!',                 'Загляденье',          'Браво!',           'Кайф',           'У тебя получается.'],
    'day-streak':       ['Ну ты и красавчик',    'Мрр, серия!',         'Так и горим.'],
  },
  marquis: {
    'petted':           ['Премного благодарен.',  'Соблаговолили? Прошу.',  'Сие приятно.',   'Достойный жест.'],
    'petted-extra':     ['Вы балуете меня, сударь.', 'Ну-с, повторим.'],
    'petted-too-much':  ['Ну-ну, без излишеств.',  'Полно вам, право.'],
    'just-done':        ['Превосходно.',          'Ну-с, так-так.',          'Изящно сделано.', 'Дело сделано, как и подобает.'],
    'morning-empty':    ['Доброе утро, сударь.',  'Ну-с, начнём с чашки.'],
    'evening-warm':     ['Достойный был день, право.', 'Свеча и тишина.'],
    'night':            ['Доброй ночи, мой друг.', '*спит в ливрее*'],
  },
  lazer: {
    'petted':           ['Топ!',                 'Контакт — топ!',       'Мур-мур-турбо!',   'Заряд получен.'],
    'petted-extra':     ['Турбо-мур!',           'Боеготов!',             'Ещё контакт — ещё топливо.'],
    'petted-too-much':  ['Перегрев! Перегрев!',  'Турбина шумит, надо охладиться', 'Стоп. Пит-стоп.'],
    'just-done':        ['Пыщ!',                  'Минус один — топ.',     'Победа в гонке!', 'Скорость +1.', 'Газу!'],
    'day-streak':       ['Серия — газ в пол!',    'Турбо-режим включён.',  'Чекпоинт за чекпоинтом!'],
    'day-bored':        ['Стартовая решётка пустая.', 'Двигатель греется.', 'Команда «старт» где?'],
  },
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
  /** Если задано — рядом с прогрессом покажется иконка «обновить». */
  onRefresh?: () => void
}

export default function AsciiPet({
  short,
  long,
  persona,
  isLoading,
  onRefresh,
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
  // Сколько раз погладили подряд (без 30-секундной паузы) — переключает
  // пул фраз и запускает анимацию головокружения после 6-го клика.
  const [petCount, setPetCount] = useState(0)
  const petCountRef = useRef(0)
  const lastPetTimeRef = useRef<number>(0)
  const petResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Головокружение: 10 секунд с блокировкой кликов.
  const [dizzy, setDizzy] = useState(false)
  const [dizzyFrame, setDizzyFrame] = useState(0)
  const dizzyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PETTING_DURATION_MS = 5000
  const PET_LIMIT = 6

  const handlePet = useCallback(() => {
    if (dizzy) return // 10-секундная блокировка после перегруза
    const now = Date.now()
    const wasRecent = lastPetTimeRef.current > 0 && now - lastPetTimeRef.current < 30_000
    lastPetTimeRef.current = now
    const nextCount = wasRecent ? petCountRef.current + 1 : 1
    petCountRef.current = nextCount
    setPetCount(nextCount)

    // Перегруз ласки → 10 секунд головокружения, кот не реагирует на клики.
    if (nextCount >= PET_LIMIT) {
      setPetting(false)
      setDizzy(true)
      if (petResetTimerRef.current) clearTimeout(petResetTimerRef.current)
      if (dizzyTimerRef.current) clearTimeout(dizzyTimerRef.current)
      dizzyTimerRef.current = setTimeout(() => {
        setDizzy(false)
        setPetCount(0)
        petCountRef.current = 0
        lastPetTimeRef.current = 0
        dizzyTimerRef.current = null
      }, DIZZY_DURATION_MS)
      return
    }

    setPetting(true)
    setHeartBurst((k) => k + 1)
    if (petResetTimerRef.current) clearTimeout(petResetTimerRef.current)
    petResetTimerRef.current = setTimeout(() => {
      setPetCount(0)
      petCountRef.current = 0
      lastPetTimeRef.current = 0
    }, 30_000)
    const t = setTimeout(() => setPetting(false), PETTING_DURATION_MS)
    return () => clearTimeout(t)
  }, [dizzy])

  useEffect(
    () => () => {
      if (petResetTimerRef.current) clearTimeout(petResetTimerRef.current)
      if (dizzyTimerRef.current) clearTimeout(dizzyTimerRef.current)
    },
    [],
  )

  // Пока petting активен — периодически пускаем новые порции сердечек,
  // чтобы 5 секунд ласки не превращались в тишину после первого пшика.
  useEffect(() => {
    if (!petting) return
    const id = setInterval(() => setHeartBurst((k) => k + 1), 1700)
    return () => clearInterval(id)
  }, [petting])

  // Пока dizzy — крутим кадры глаз, чтобы они «вращались».
  useEffect(() => {
    if (!dizzy) {
      setDizzyFrame(0)
      return
    }
    const id = setInterval(() => setDizzyFrame((f) => f + 1), 200)
    return () => clearInterval(id)
  }, [dizzy])

  // ── Idle-оверлеи поверх базового mood: моргание / wink / косой взгляд /
  //    зевок. Один общий планировщик: каждые 5–15с случайно выбирает действие.
  type Overlay = 'none' | 'blink' | 'wink' | 'glance-l' | 'glance-r' | 'yawn'
  const [overlay, setOverlay] = useState<Overlay>('none')
  useEffect(() => {
    if (baseMood === 'sleeping' || petting) return
    let live = true
    let t: ReturnType<typeof setTimeout>
    const schedule = () => {
      const delay = 5000 + Math.random() * 10_000 // 5–15с
      t = setTimeout(() => {
        if (!live) return
        // Распределение: blink частый (≈50%), wink редкий, косые взгляды
        // около трети, зевок очень редкий.
        const r = Math.random()
        let pick: Overlay
        let dur: number
        if (r < 0.5)        { pick = 'blink';     dur = 140 }
        else if (r < 0.6)   { pick = 'wink';      dur = 260 }
        else if (r < 0.78)  { pick = 'glance-l';  dur = 520 }
        else if (r < 0.96)  { pick = 'glance-r';  dur = 520 }
        else                { pick = 'yawn';      dur = 720 }
        setOverlay(pick)
        setTimeout(() => {
          if (!live) return
          setOverlay('none')
          schedule()
        }, dur)
      }, delay)
    }
    schedule()
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [baseMood, petting])

  // ── Итоговый mood / лицо ─────────────────────────────────────────────
  const mood: Mood = dizzy
    ? 'dizzy'
    : petting
    ? 'petted'
    : celebrating
    ? 'celebrate'
    : baseMood
  // Персона перекрывает глаза ТОЛЬКО в базовом content-mood.
  // Другие (sleeping, celebrate, petted, proud, …) логически важнее персоны.
  const base: Face = mood === 'content' && persona
    ? { ...MOODS.content, eyeL: persona.eyes_l, eyeR: persona.eyes_r }
    : MOODS[mood]
  // Анимированные глаза головокружения: каждые 200мс берём следующий символ.
  const dizzyEyePatch: Partial<Face> = dizzy
    ? {
        eyeL: DIZZY_EYE_FRAMES[dizzyFrame % DIZZY_EYE_FRAMES.length],
        eyeR: DIZZY_EYE_FRAMES[(dizzyFrame + 2) % DIZZY_EYE_FRAMES.length],
      }
    : {}
  // Idle-оверлеи (моргание/glance/yawn) — только в спокойных состояниях.
  const overlayPatch: Partial<Face> =
    petting || dizzy
      ? {}
      : overlay === 'blink'    ? BLINK
      : overlay === 'wink'     ? WINK
      : overlay === 'glance-l' ? GLANCE_L
      : overlay === 'glance-r' ? GLANCE_R
      : overlay === 'yawn'     ? YAWN
      : {}
  const face: Face = {
    ...base,
    ...dizzyEyePatch,
    ...overlayPatch,
  }
  const asciiArt = `${face.ears}\n(${face.eyeL}.${face.eyeR})\n${face.mouth}`

  // ── Контекстная фраза. Пересчитывается раз в час (или на смену стейта).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const contextualPhrase = useMemo(() => {
    const personaPhrases = persona ? PERSONA_PHRASES[persona.id] : undefined
    // Головокружение: показываем фразы из «petted-too-much» (свои у персоны).
    if (dizzy) {
      const pool =
        personaPhrases?.['petted-too-much'] ??
        PHRASES['petted-too-much']
      return pickFrom(pool, dizzyFrame)
    }
    // Petting показывает свой пул сразу. Бакет зависит от количества поглаживаний.
    if (petting) {
      const pettingBucket: Bucket =
        petCount >= 6 ? 'petted-too-much' : petCount >= 4 ? 'petted-extra' : 'petted'
      const pool =
        personaPhrases?.[pettingBucket] ??
        PHRASES[pettingBucket] ??
        PHRASES.petted
      return pickFrom(pool, heartBurst)
    }
    const sinceDone = lastDoneRef.current ? Date.now() - lastDoneRef.current : null
    const bucket = pickBucket(hour, progress, sinceDone)
    const pool = personaPhrases?.[bucket] ?? PHRASES[bucket]
    // Меняем по: tick (час), celebrateKey (событие), bucket-строка (переход)
    const seed = tick * 7 + celebrateKey * 13 + bucket.length
    return pickFrom(pool, seed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, celebrateKey, hour, progress, petting, heartBurst, petCount, persona, dizzy, dizzyFrame])

  const isNight = mood === 'sleeping'
  const progressPct = Math.round(progress * 100)

  // Персона от родителя (short/long) имеет приоритет над контекстом;
  // petting и dizzy всегда показывают свою фразу.
  const bubbleText: string | null = petting || dizzy
    ? contextualPhrase
    : isLoading
    ? null
    : (expanded && long) || short || contextualPhrase
  // «ещё» показываем только когда есть РАЗНЫЕ short и long от родителя.
  const canExpand = !petting && !dizzy && !!short && !!long && long !== short

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
                mood === 'dizzy'
                  ? 'radial-gradient(circle, rgba(245,158,11,0.32), transparent 70%)'
                  : mood === 'proud' || mood === 'celebrate' || mood === 'petted'
                  ? 'radial-gradient(circle, rgba(217,119,6,0.28), transparent 70%)'
                  : mood === 'happy'
                  ? 'radial-gradient(circle, rgba(217,119,6,0.14), transparent 70%)'
                  : isNight
                  ? 'radial-gradient(circle, rgba(148,163,184,0.10), transparent 70%)'
                  : 'radial-gradient(circle, rgba(217,119,6,0.06), transparent 70%)',
            }}
          />
        </div>

        {/* Кот — кликабелен, центрирован. На dizzy блокируем клики. */}
        <motion.button
          type="button"
          onClick={handlePet}
          disabled={dizzy}
          aria-label={dizzy ? 'кот в нокдауне, подожди' : 'погладить'}
          className={clsx(
            'relative focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md',
            dizzy ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
          style={{ padding: 4 }}
          whileHover={!isNight && !dizzy ? { scale: 1.04 } : undefined}
          whileTap={!dizzy ? { scale: 0.94 } : undefined}
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
                  : mood === 'dizzy'
                  ? '0 0 8px rgba(245,158,11,0.45)'
                  : mood === 'petted'
                  ? '0 0 6px rgba(217,119,6,0.25)'
                  : 'none',
              willChange: 'transform',
            }}
            animate={
              mood === 'dizzy'
                ? { rotate: [-6, 6, -6], y: [0, -1, 0, 1, 0], scale: [1, 0.97, 1, 0.97, 1] }
                : isNight
                ? { y: [0, -1, 0], opacity: [0.75, 0.9, 0.75] }
                : mood === 'celebrate'
                ? { y: [0, -3, 0, -3, 0] }
                : mood === 'petted'
                ? { y: [0, -1, 0] }
                : { y: [0, -1.2, 0] }
            }
            transition={
              mood === 'dizzy'
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : isNight
                ? { duration: 5.4, repeat: Infinity, ease: 'easeInOut' }
                : mood === 'celebrate'
                ? { duration: 1.0, ease: 'easeInOut' }
                : mood === 'petted'
                ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
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

        {/* Звёздочки кружат над головой при dizzy. Орбита — эллипс ~58×16,
            смещён вверх. Один rotate на родителе, четыре звезды позиционированы
            по углам 0/90/180/270 — получаем «карусель» вокруг центра головы. */}
        <AnimatePresence>
          {dizzy && (
            <motion.div
              key="dizzy-stars"
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                className="absolute left-1/2 top-3"
                style={{ width: 0, height: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
              >
                {[0, 1, 2, 3].map((i) => {
                  const angle = (i * Math.PI) / 2
                  return (
                    <motion.span
                      key={i}
                      className="absolute font-display text-amber-500 dark:text-amber-300"
                      style={{
                        left: Math.cos(angle) * 29 - 5,
                        top:  Math.sin(angle) * 8  - 7,
                        fontSize: 12,
                      }}
                      animate={{ opacity: [0.5, 1, 0.5], scale: [0.85, 1.1, 0.85] }}
                      transition={{ duration: 0.9, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      ✦
                    </motion.span>
                  )
                })}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  )

  // ── Лейбл настроения + прогресс + (опц.) кнопка обновления ──────────
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
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="перегенерировать совет"
          title="перегенерировать"
          className="ml-0.5 w-4 h-4 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={clsx(isLoading && 'animate-spin')}
          >
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <polyline points="21 3 21 8 16 8" />
          </svg>
        </button>
      )}
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
        {persona && !petting && (
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
