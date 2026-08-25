/**
 * Единственный источник правды для цвета.
 *
 * Отсюда читают двое:
 * - globals.css — руками, значения обязаны совпадать (проверяется тестом
 *   в globals.test.ts, иначе палитра разъезжается молча);
 * - ThemeContext — потому что recharts берёт цвета из JS: в SVG-атрибутах
 *   var(--…) не раскрывается.
 */

export interface Palette {
  bg: string
  bgRaised: string
  bgCell: string
  bgHover: string
  bgSel: string
  line: string
  lineSoft: string
  fg: string
  fgBody: string
  mid: string
  dim: string
  muted: string
  faint: string
  accent: string
  accentLight: string
  accentDark: string
  red: string
  green: string
}

export const DARK: Palette = {
  bg:          '#131318',
  bgRaised:    '#17171d',
  bgCell:      '#1b1b22',
  bgHover:     '#191920',
  // Отделён от фона сильнее прежнего: выделенная строка должна читаться,
  // а не отличаться на два шага яркости.
  bgSel:       '#232330',
  // Светлее прежней #1e211e — та была почти неотличима от фона, и сетка пропадала.
  line:        '#2a2a33',
  lineSoft:    '#1e1e26',
  fg:          '#d8d6de',
  fgBody:      '#b7b5c0',
  mid:         '#8a8894',
  dim:         '#6a6875',
  muted:       '#4f4e59',
  faint:       '#42414b',
  accent:      '#a898e0',
  accentLight: '#c4b8ee',
  accentDark:  '#6e5fa6',
  red:         '#d0757e',
  green:       '#7fb083',
}

export const LIGHT: Palette = {
  bg:          '#f6f5f9',
  bgRaised:    '#f1f0f6',
  bgCell:      '#eceaf3',
  bgHover:     '#ebe9f2',
  bgSel:       '#e0dcee',
  line:        '#d5d2e0',
  lineSoft:    '#e6e3ee',
  fg:          '#22212a',
  fgBody:      '#3b3947',
  mid:         '#66637a',
  dim:         '#84819a',
  muted:       '#a29fb4',
  faint:       '#b8b5c6',
  // Углублён с #a898e0: сиреневый акцент тёмной темы на светлом фоне даёт 1.6:1.
  accent:      '#6247aa',
  accentLight: '#7d63c4',
  accentDark:  '#48336f',
  red:         '#a8434f',
  green:       '#4a6f45',
}

/**
 * Уровни, на которых разрешён смысловой текст. Каждый обязан давать
 * ≥4.5:1 к bg своей темы.
 */
export const READABLE_KEYS = [
  'fg',
  'fgBody',
  'mid',
  'accent',
  'red',
  'green',
] as const satisfies readonly (keyof Palette)[]

/**
 * Приглушённые уровни — намеренно ниже 4.5:1, это и есть терминальная
 * эстетика (у lumen тот же --dim: #6b706b, те же 3.88). Ими красятся
 * рамки, .kicker-заголовки над читаемым содержимым и прочий фон смысла.
 * Дата, счётчик или текст ошибки в них жить не может.
 */
export const DECORATIVE_KEYS = [
  'dim',
  'muted',
  'faint',
] as const satisfies readonly (keyof Palette)[]

/** Поле палитры → имя CSS-переменной в globals.css. */
export const CSS_VAR: Record<keyof Palette, string> = {
  bg:          '--bg',
  bgRaised:    '--bg-raised',
  bgCell:      '--bg-cell',
  bgHover:     '--bg-hover',
  bgSel:       '--bg-sel',
  line:        '--line',
  lineSoft:    '--line-soft',
  fg:          '--fg',
  fgBody:      '--fg-body',
  mid:         '--mid',
  dim:         '--dim',
  muted:       '--muted',
  faint:       '--faint',
  accent:      '--accent',
  accentLight: '--accent-light',
  accentDark:  '--accent-dark',
  red:         '--red',
  green:       '--green',
}
