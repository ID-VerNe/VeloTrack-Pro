import animate from 'tailwindcss-animate';

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
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        card: 'var(--shadow-card)',
      },
      backdropBlur: {
        xs: '2px',
      },
      spacing: {
        '4.5': '1.125rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        tabular: ['var(--font-tabular)'],
      },
      transitionTimingFunction: {
        'apple-spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
      }
    },
  },
  plugins: [animate],
}
