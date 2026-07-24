/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Minimal dark palette
        bg: '#0c0c0c',
        surface: '#161616',
        'surface-2': '#1f1f1f',
        border: '#2a2a2a',
        'border-2': '#383838',
        text: '#efefef',
        muted: '#666666',
        subtle: '#444444',
        // Single accent — Chinese vermilion
        accent: '#d62828',
        'accent-h': '#c02222',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
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
