/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  corePlugins: {
    backdropBlur: false,
    backdropFilter: false,
    boxShadow: false,
    borderRadius: false,
    ringWidth: false,
    ringColor: false,
    ringOffsetWidth: false,
    ringOffsetColor: false,
    // .container тянет за собой четыре брейкпоинта Tailwind по умолчанию, а
    // проект обещает ровно один. Утилита нигде не используется.
    container: false,
  },
  theme: {
    extend: {
      // Единственный брейкпоинт проекта. sm:/md:/lg: запрещены и ловятся
      // legacy-classes.test.ts — узкая ветка называется только так.
      screens: {
        narrow: { max: '899px' },
      },
      colors: {
        bg:      {
          DEFAULT: 'var(--bg)',
          raised:  'var(--bg-raised)',
          cell:    'var(--bg-cell)',
          hover:   'var(--bg-hover)',
          sel:     'var(--bg-sel)',
        },
        fg:      {
          DEFAULT: 'var(--fg)',
          body:    'var(--fg-body)',
          mid:     'var(--mid)',
          dim:     'var(--dim)',
          muted:   'var(--muted)',
          faint:   'var(--faint)',
        },
        line:    { DEFAULT: 'var(--line)', soft: 'var(--line-soft)' },
        accent:  { DEFAULT: 'var(--accent)', light: 'var(--accent-light)', dark: 'var(--accent-dark)' },
        danger:  'var(--red)',
        success: 'var(--green)',
      },
      fontFamily: {
        sans: ['"JetBrains Mono"', 'ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
        display: ['"JetBrains Mono"', 'ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
