/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['DM Mono', 'JetBrains Mono', 'monospace'],
        syne: ['Syne', 'sans-serif'],
        dm: ['DM Mono', 'monospace'],
      },
      colors: {
        cv: {
          bg:      'var(--cv-bg)',
          surface: 'var(--cv-surface)',
          elev:    'var(--cv-elev)',
          cyan:    'var(--cv-cyan)',
          orange:  'var(--cv-orange)',
          purple:  'var(--cv-purple)',
          text:    'var(--cv-text)',
        },
      },
    },
  },
  plugins: [],
}
