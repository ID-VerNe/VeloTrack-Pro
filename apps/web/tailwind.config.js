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
          hairline: 'var(--border-hairline)',
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
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
        button: 'var(--radius-button)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        instrument: 'var(--shadow-instrument)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        tabular: ['var(--font-tabular)'],
      },
      fontSize: {
        micro: ['10px', { lineHeight: '1.4', letterSpacing: '0.06em' }],
        '2xs': ['11px', { lineHeight: '1.2', letterSpacing: '0.02em' }],
      }
    },
  },
  plugins: [],
}
