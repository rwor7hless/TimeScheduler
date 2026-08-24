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
  bg:          '#0b0c0c',
  bgRaised:    '#0e100f',
  bgCell:      '#121413',
  bgHover:     '#101211',
  bgSel:       '#141715',
  line:        '#1e211e',
  lineSoft:    '#131614',
  fg:          '#d6d8d3',
  fgBody:      '#b9bcb6',
  mid:         '#8a8d87',
  dim:         '#6b706b',
  muted:       '#4d514a',
  faint:       '#42463f',
  accent:      '#d8a657',
  accentLight: '#e8c187',
  accentDark:  '#8a6a34',
  red:         '#b4666a',
  green:       '#7c9a6d',
}

export const LIGHT: Palette = {
  bg:          '#f6f5f1',
  bgRaised:    '#f1f0ea',
  bgCell:      '#ecebe4',
  bgHover:     '#eceae2',
  bgSel:       '#e5e3d9',
  line:        '#d8d6cb',
  lineSoft:    '#e6e4da',
  fg:          '#23241f',
  fgBody:      '#3c3e37',
  mid:         '#6b6e64',
  dim:         '#85887c',
  muted:       '#a0a396',
  faint:       '#b6b8ac',
  // Затемнён с #d8a657: на светлом фоне исходный акцент даёт 1.9:1.
  accent:      '#96651a',
  accentLight: '#b07f2c',
  accentDark:  '#6f4a11',
  red:         '#a2454a',
  green:       '#4e6f41',
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
