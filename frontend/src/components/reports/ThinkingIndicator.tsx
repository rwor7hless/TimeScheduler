import { useEffect, useRef, useState } from 'react'

// ─── Сообщения «пока модель думает» ───────────────────────────────────────────

const THINKING_MESSAGES = [
  'Собираю данные за неделю…',
  'Считаю закрытые задачи…',
  'Смотрю на провалы и просрочки…',
  'Проверяю, не соврал ли ты про привычки…',
  'Ищу, за что тебя похвалить (пока безрезультатно)…',
  'Достаю архивные отговорки…',
  'Консультируюсь с твоим внутренним критиком…',
  'Перечитываю список просроченных третий раз…',
  'Считаю, сколько раз ты открывал ленту вместо работы…',
  'Думаю, как сказать это помягче… или не помягче…',
  'Собираю остроумную метафору…',
  'Сверяю обещания с реальностью…',
  'Готовлю честный разбор, без «в целом»…',
  'Ищу подходящий мем для твоего прогресса…',
  'Разогреваю нейроны…',
  'Откладываю капучино и открываю твои задачи…',
  'Подбираю слова, которые не обидят (но чуть-чуть можно)…',
  'Загружаю пакет душевных пинков…',
  'Формулирую финальный вердикт…',
]

// ─── Абстрактные ASCII-анимации ─────────────────────────────────────────────
// Генерируются процедурно на каждый кадр — никаких зашитых картинок.

const FIELD_W = 36
const FIELD_H = 12
const GLYPHS = '·∙⋅*+×∘○•◦░▒▓█░▒▓◆◇▪▫'

// Поле внутри сферы: символы случайно разбросаны в эллипсе, плотность
// падает от центра к краю.
function genSphere(): string {
  const cx = (FIELD_W - 1) / 2
  const cy = (FIELD_H - 1) / 2
  const rx = FIELD_W / 2 - 0.5
  const ry = FIELD_H / 2 - 0.5
  const rows: string[] = []
  for (let y = 0; y < FIELD_H; y++) {
    let row = ''
    for (let x = 0; x < FIELD_W; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      const d = dx * dx + dy * dy
      if (d > 1) {
        row += ' '
      } else {
        const density = 0.55 - d * 0.45
        row += Math.random() < density
          ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          : ' '
      }
    }
    rows.push(row)
  }
  return rows.join('\n')
}

// Поле внутри «куба»: рисуем каркас, внутри случайные символы меняются.
function genCube(): string {
  const W = 30
  const H = 10
  const rows: string[] = []
  const top = `    +${'-'.repeat(W - 6)}+`
  const topSlope = `   /${' '.repeat(W - 6)}/|`
  const middleTop = `  +${'-'.repeat(W - 6)}+ |`
  const bottom = `  +${'-'.repeat(W - 6)}+/`
  rows.push(top)
  rows.push(topSlope)
  rows.push(middleTop)
  for (let y = 0; y < H - 5; y++) {
    let inner = ''
    for (let x = 0; x < W - 6; x++) {
      inner += Math.random() < 0.35
        ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        : ' '
    }
    const rightEdge = y === H - 6 ? '/' : (y % 2 === 0 ? '|' : ' ')
    rows.push(`  |${inner}| ${rightEdge}`)
  }
  rows.push(bottom)
  return rows.join('\n')
}

// Змейка, случайно гуляющая по тороидальному полю.
type SnakeState = {
  segs: Array<{ x: number; y: number }>
  dir: { dx: number; dy: number }
}

function initSnake(): SnakeState {
  const startX = Math.floor(FIELD_W / 2)
  const startY = Math.floor(FIELD_H / 2)
  const segs = Array.from({ length: 12 }, (_, i) => ({
    x: (startX - i + FIELD_W) % FIELD_W,
    y: startY,
  }))
  return { segs, dir: { dx: 1, dy: 0 } }
}

function stepSnake(state: SnakeState): SnakeState {
  let { dx, dy } = state.dir
  if (Math.random() < 0.25) {
    const candidates = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ].filter((c) => !(c.dx === -dx && c.dy === -dy))
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    dx = pick.dx
    dy = pick.dy
  }
  const head = state.segs[0]
  const nx = (head.x + dx + FIELD_W) % FIELD_W
  const ny = (head.y + dy + FIELD_H) % FIELD_H
  return {
    segs: [{ x: nx, y: ny }, ...state.segs.slice(0, -1)],
    dir: { dx, dy },
  }
}

function renderSnake(state: SnakeState): string {
  const grid: string[][] = Array.from({ length: FIELD_H }, () =>
    Array.from({ length: FIELD_W }, () => ' '),
  )
  state.segs.forEach((s, i) => {
    if (i === 0) grid[s.y][s.x] = '◉'
    else if (i < 4) grid[s.y][s.x] = '●'
    else if (i < 8) grid[s.y][s.x] = '∙'
    else grid[s.y][s.x] = '·'
  })
  return grid.map((r) => r.join('')).join('\n')
}

// Матричный дождь: N колонок, в каждой падающий след.
type RainState = { heads: number[]; trails: number[] }

function initRain(): RainState {
  return {
    heads: Array.from({ length: FIELD_W }, () => Math.floor(Math.random() * FIELD_H * 2)),
    trails: Array.from({ length: FIELD_W }, () => 3 + Math.floor(Math.random() * 5)),
  }
}

function stepRain(state: RainState): RainState {
  return {
    heads: state.heads.map((h) => (h + 1) % (FIELD_H + 8)),
    trails: state.trails,
  }
}

function renderRain(state: RainState): string {
  const grid: string[][] = Array.from({ length: FIELD_H }, () =>
    Array.from({ length: FIELD_W }, () => ' '),
  )
  for (let x = 0; x < FIELD_W; x++) {
    const head = state.heads[x]
    const trail = state.trails[x]
    for (let i = 0; i < trail; i++) {
      const y = head - i
      if (y >= 0 && y < FIELD_H) {
        grid[y][x] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      }
    }
  }
  return grid.map((r) => r.join('')).join('\n')
}

type AnimKind = 'sphere' | 'cube' | 'snake' | 'rain'
const ANIM_KINDS: AnimKind[] = ['sphere', 'cube', 'snake', 'rain']

export function ThinkingIndicator() {
  const [msgIdx, setMsgIdx] = useState(0)
  const [frame, setFrame] = useState<string>('')

  const kindRef = useRef<AnimKind>(
    ANIM_KINDS[Math.floor(Math.random() * ANIM_KINDS.length)],
  )
  const snakeRef = useRef<SnakeState>(initSnake())
  const rainRef = useRef<RainState>(initRain())

  useEffect(() => {
    setMsgIdx(Math.floor(Math.random() * THINKING_MESSAGES.length))
    const textId = setInterval(() => {
      setMsgIdx((i) => (i + 1) % THINKING_MESSAGES.length)
    }, 2500)

    const kind = kindRef.current
    const intervalMs =
      kind === 'snake' ? 90 : kind === 'rain' ? 110 : kind === 'cube' ? 140 : 120

    const tick = () => {
      if (kind === 'sphere') setFrame(genSphere())
      else if (kind === 'cube') setFrame(genCube())
      else if (kind === 'snake') {
        snakeRef.current = stepSnake(snakeRef.current)
        setFrame(renderSnake(snakeRef.current))
      } else if (kind === 'rain') {
        rainRef.current = stepRain(rainRef.current)
        setFrame(renderRain(rainRef.current))
      }
    }
    tick()
    const frameId = setInterval(tick, intervalMs)

    return () => {
      clearInterval(textId)
      clearInterval(frameId)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <pre className="font-mono text-[11px] leading-[1.05] text-accent select-none whitespace-pre text-center">
        {frame}
      </pre>
      <span
        key={msgIdx}
        className="text-sm text-fg-mid text-center max-w-xs"
      >
        {THINKING_MESSAGES[msgIdx]}
      </span>
    </div>
  )
}

/** Мигающий курсор для вставки в конце стримящегося текста. */
export function StreamCursor() {
  return (
    <span className="inline-block w-0.5 h-4 bg-bg-sel animate-pulse ml-0.5 align-middle" />
  )
}
