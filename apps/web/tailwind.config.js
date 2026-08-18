/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'var(--bg-canvas)',
          subtle: 'var(--bg-subtle)'
        },
        surface: 'var(--bg-surface)',
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        brand: {
          DEFAULT: 'var(--brand-primary)',
          subtle: 'var(--brand-subtle)',
        },
        metric: {
          speed: 'var(--metric-speed)',
          cadence: 'var(--metric-cadence)',
          altitude: 'var(--metric-altitude)',
          power: 'var(--metric-power)',
        }
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        tabular: ['var(--font-tabular)'],
      },
      fontSize: {
        // 排版规范：辅助文本/单位/徽章下限 11px，主数字与正文下限 12px (text-xs)
        '2xs': ['11px', { lineHeight: '1.2', letterSpacing: '0.01em' }],
      }
    },
  },
  plugins: [],
}
