/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#FEFCE8',
          100: '#FEF9C3',
          200: '#FEF08A',
        },
        accent: {
          DEFAULT: '#D97706',
          light: '#F59E0B',
          dark: '#B45309',
        },
        // Семантические токены, завязанные на CSS-переменные.
        // Предпочитать их в новом коде. Старые bg-gray-* / bg-white уже
        // перекрываются override-слоем в globals.css.
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
        },
        paper: {
          DEFAULT: 'var(--color-bg)',
          tint: 'var(--color-bg-tint)',
        },
        ink: {
          DEFAULT: 'var(--color-text)',
          soft: 'var(--color-text-secondary)',
          muted: 'var(--color-muted)',
        },
        line: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'paper': '0 1px 0 rgba(31,27,22,0.04), 0 4px 12px rgba(31,27,22,0.06)',
        'paper-lg': '0 1px 0 rgba(31,27,22,0.05), 0 12px 32px rgba(31,27,22,0.10)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
