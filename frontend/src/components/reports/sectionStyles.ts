/**
 * Цветовые темы для каждой секции еженедельного AI-отчёта.
 *
 * LLM обязан держать 7 секций в строгом порядке (см. backend/prompts/weekly_report.py).
 * Мы матчим заголовок секции по ключевому корню и подставляем соответствующую тему.
 *
 * КРИТИЧНО: все Tailwind-классы здесь записаны ЛИТЕРАЛЬНЫМИ строками,
 * без шаблонных подстановок вида `bg-${hue}-50`. Иначе JIT-сканер не видит
 * классы на этапе билда и они вырезаются.
 */

export type SectionKey =
  | 'intro'
  | 'rating'
  | 'projects'
  | 'done'
  | 'fails'
  | 'advice'
  | 'summary'
  | 'default'

export type IconName = SectionKey

export interface SectionTheme {
  key: SectionKey
  iconName: IconName
  /** Внешний контейнер карточки секции: фон, бордер, скругление. */
  cardClass: string
  /** Круглая плашка вокруг иконки секции. */
  iconChipClass: string
  /** Цвет заголовка секции. */
  titleClass: string
  /** Градиентная линия под заголовком. */
  underlineClass: string
  /** Цвет жирного текста (strong) в теле секции — то самое «выделение цветом». */
  boldClass: string
  /** Левый бордер для h3 (подзаголовок проекта). */
  h3BorderClass: string
  /** Inline code. */
  codeClass: string
  /** Точка-маркер для обычных списков. */
  bulletClass: string
  /** Blockquote. */
  quoteBorderClass: string
  /** Фон ряда для «провалов» — полупрозрачная плашка вокруг каждого li. */
  listRowBgClass: string
}

export const THEMES: Record<SectionKey, SectionTheme> = {
  intro: {
    key: 'intro',
    iconName: 'intro',
    cardClass:
      'rounded-2xl border border-teal-200/60 dark:border-teal-800/40 bg-gradient-to-br from-teal-50/70 via-white to-white dark:from-teal-900/15 dark:via-gray-900/30 dark:to-gray-900/30',
    iconChipClass: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300',
    titleClass: 'text-teal-700 dark:text-teal-300',
    underlineClass: 'bg-gradient-to-r from-teal-300/70 via-teal-200/40 to-transparent dark:from-teal-600/60 dark:via-teal-700/30',
    boldClass: 'text-teal-700 dark:text-teal-300 font-semibold',
    h3BorderClass: 'border-teal-400/60',
    codeClass: 'bg-teal-100/70 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    bulletClass: 'bg-teal-400 dark:bg-teal-500',
    quoteBorderClass: 'border-teal-300 dark:border-teal-700',
    listRowBgClass: '',
  },
  rating: {
    key: 'rating',
    iconName: 'rating',
    cardClass:
      'rounded-2xl border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/70 via-white to-white dark:from-violet-900/15 dark:via-gray-900/30 dark:to-gray-900/30',
    iconChipClass: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
    titleClass: 'text-violet-700 dark:text-violet-300',
    underlineClass: 'bg-gradient-to-r from-violet-300/70 via-violet-200/40 to-transparent dark:from-violet-600/60 dark:via-violet-700/30',
    boldClass: 'text-violet-700 dark:text-violet-300 font-semibold',
    h3BorderClass: 'border-violet-400/60',
    codeClass: 'bg-violet-100/70 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    bulletClass: 'bg-violet-400 dark:bg-violet-500',
    quoteBorderClass: 'border-violet-300 dark:border-violet-700',
    listRowBgClass: '',
  },
  projects: {
    key: 'projects',
    iconName: 'projects',
    cardClass:
      'rounded-2xl border border-sky-200/60 dark:border-sky-800/40 bg-gradient-to-br from-sky-50/70 via-white to-white dark:from-sky-900/15 dark:via-gray-900/30 dark:to-gray-900/30',
    iconChipClass: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
    titleClass: 'text-sky-700 dark:text-sky-300',
    underlineClass: 'bg-gradient-to-r from-sky-300/70 via-sky-200/40 to-transparent dark:from-sky-600/60 dark:via-sky-700/30',
    boldClass: 'text-sky-700 dark:text-sky-300 font-semibold',
    h3BorderClass: 'border-sky-400/60',
    codeClass: 'bg-sky-100/70 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    bulletClass: 'bg-sky-400 dark:bg-sky-500',
    quoteBorderClass: 'border-sky-300 dark:border-sky-700',
    listRowBgClass: '',
  },
  done: {
    key: 'done',
    iconName: 'done',
    cardClass:
      'rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/70 via-white to-white dark:from-emerald-900/15 dark:via-gray-900/30 dark:to-gray-900/30',
    iconChipClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    titleClass: 'text-emerald-700 dark:text-emerald-300',
    underlineClass: 'bg-gradient-to-r from-emerald-300/70 via-emerald-200/40 to-transparent dark:from-emerald-600/60 dark:via-emerald-700/30',
    boldClass: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    h3BorderClass: 'border-emerald-400/60',
    codeClass: 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    bulletClass: 'bg-emerald-400 dark:bg-emerald-500',
    quoteBorderClass: 'border-emerald-300 dark:border-emerald-700',
    listRowBgClass: '',
  },
  fails: {
    key: 'fails',
    iconName: 'fails',
    cardClass:
      'rounded-2xl border border-rose-200/60 dark:border-rose-800/40 bg-gradient-to-br from-rose-50/70 via-white to-white dark:from-rose-900/15 dark:via-gray-900/30 dark:to-gray-900/30',
    iconChipClass: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
    titleClass: 'text-rose-700 dark:text-rose-300',
    underlineClass: 'bg-gradient-to-r from-rose-300/70 via-rose-200/40 to-transparent dark:from-rose-600/60 dark:via-rose-700/30',
    boldClass: 'text-rose-700 dark:text-rose-300 font-semibold',
    h3BorderClass: 'border-rose-400/60',
    codeClass: 'bg-rose-100/70 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    bulletClass: 'bg-rose-400 dark:bg-rose-500',
    quoteBorderClass: 'border-rose-300 dark:border-rose-700',
    listRowBgClass: 'bg-rose-50/60 dark:bg-rose-900/15 rounded-lg px-2.5 py-1.5 border border-rose-100/70 dark:border-rose-900/30',
  },
  advice: {
    key: 'advice',
    iconName: 'advice',
    cardClass:
      'rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/80 via-sand-50/60 to-white dark:from-amber-900/20 dark:via-gray-900/30 dark:to-gray-900/30',
    iconChipClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    titleClass: 'text-amber-700 dark:text-amber-300',
    underlineClass: 'bg-gradient-to-r from-amber-300/70 via-amber-200/40 to-transparent dark:from-amber-600/60 dark:via-amber-700/30',
    boldClass: 'text-amber-700 dark:text-amber-300 font-semibold',
    h3BorderClass: 'border-amber-400/60',
    codeClass: 'bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    bulletClass: 'bg-amber-400 dark:bg-amber-500',
    quoteBorderClass: 'border-amber-300 dark:border-amber-700',
    listRowBgClass: '',
  },
  summary: {
    key: 'summary',
    iconName: 'summary',
    cardClass:
      'rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-gradient-to-br from-indigo-50/70 via-white to-white dark:from-indigo-900/15 dark:via-gray-900/30 dark:to-gray-900/30',
    iconChipClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
    titleClass: 'text-indigo-700 dark:text-indigo-300',
    underlineClass: 'bg-gradient-to-r from-indigo-300/70 via-indigo-200/40 to-transparent dark:from-indigo-600/60 dark:via-indigo-700/30',
    boldClass: 'text-indigo-700 dark:text-indigo-300 font-semibold',
    h3BorderClass: 'border-indigo-400/60',
    codeClass: 'bg-indigo-100/70 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    bulletClass: 'bg-indigo-400 dark:bg-indigo-500',
    quoteBorderClass: 'border-indigo-300 dark:border-indigo-700',
    listRowBgClass: '',
  },
  default: {
    key: 'default',
    iconName: 'summary',
    cardClass:
      'rounded-2xl border border-gray-200/70 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/40',
    iconChipClass: 'bg-gray-100 text-gray-600 dark:bg-gray-700/70 dark:text-gray-300',
    titleClass: 'text-gray-800 dark:text-gray-200',
    underlineClass: 'bg-gradient-to-r from-gray-300/70 via-gray-200/40 to-transparent dark:from-gray-600/60 dark:via-gray-700/30',
    boldClass: 'text-gray-900 dark:text-gray-100 font-semibold',
    h3BorderClass: 'border-gray-300 dark:border-gray-600',
    codeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    bulletClass: 'bg-gray-400 dark:bg-gray-500',
    quoteBorderClass: 'border-gray-300 dark:border-gray-600',
    listRowBgClass: '',
  },
}

/**
 * По тексту заголовка (## ...) определяем ключ темы.
 * Порядок проверок важен: «разбор/проект» идут ДО «выполн»/«провал»,
 * потому что в подзаголовках проектов часто встречается слово «выполнено».
 */
export function classifySection(heading: string): SectionKey {
  const h = heading.toLowerCase()
  if (h.includes('вступ')) return 'intro'
  if (h.includes('оценк')) return 'rating'
  if (h.includes('разбор') || h.includes('проект')) return 'projects'
  if (h.includes('совет')) return 'advice'
  if (h.includes('выполн')) return 'done'
  if (h.includes('провал')) return 'fails'
  if (h.includes('итог')) return 'summary'
  return 'default'
}
