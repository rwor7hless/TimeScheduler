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
  },
  theme: {
    extend: {
      colors: {
        bg:      { DEFAULT: 'var(--bg)', raised: 'var(--bg-raised)', cell: 'var(--bg-cell)' },
        fg:      { DEFAULT: 'var(--fg)', body: 'var(--fg-body)', mid: 'var(--mid)', dim: 'var(--dim)' },
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
      borderRadius: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '0' },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
