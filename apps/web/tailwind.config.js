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
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          DEFAULT: 'var(--brand-primary)',
          hover: 'var(--brand-primary-hover)',
          active: 'var(--brand-primary-active)',
          subtle: 'var(--brand-subtle)',
          border: 'var(--brand-border)',
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
