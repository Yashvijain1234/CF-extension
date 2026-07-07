/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  // Preflight is disabled so Tailwind's global CSS reset never leaks into the
  // host Codeforces page. A scoped reset lives in `src/styles/global.css`
  // under `.cf-leetmode-root` instead.
  corePlugins: { preflight: false },
  content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        cf: {
          bg: 'var(--cf-bg)',
          surface: 'var(--cf-surface)',
          'surface-2': 'var(--cf-surface-2)',
          border: 'var(--cf-border)',
          text: 'var(--cf-text)',
          muted: 'var(--cf-muted)',
          accent: 'var(--cf-accent)',
          'accent-hover': 'var(--cf-accent-hover)',
        },
        difficulty: {
          easy: '#00b8a3',
          medium: '#ffb800',
          hard: '#ff375f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'spin-slow': 'spin-slow 1s linear infinite',
      },
    },
  },
  plugins: [],
};
