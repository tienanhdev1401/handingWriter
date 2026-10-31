/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — giá trị thật nằm ở CSS variable (xem index.css),
        // đổi theo data-theme. rgb(... / <alpha-value>) để /opacity vẫn chạy.
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        'border-2': 'rgb(var(--c-border-2) / <alpha-value>)',
        text: 'rgb(var(--c-text) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        subtle: 'rgb(var(--c-subtle) / <alpha-value>)',
        // Single accent — Chinese vermilion (giữ nguyên cả 2 theme)
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-h': 'rgb(var(--c-accent-h) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        hanzi: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      animation: {
        'in': 'fadeSlideIn 0.2s ease both',
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
