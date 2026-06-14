/** @type {import('tailwindcss').Config} */
/**
 * Aligned with `.cursor/rules/DESIGN.md` — Command Center tokens via CSS variables.
 */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          0: 'var(--bg-0)',
          1: 'var(--bg-1)',
          2: 'var(--bg-2)',
          3: 'var(--bg-3)',
          4: 'var(--bg-4)',
        },
        cream: {
          0: 'var(--cream-0)',
          1: 'var(--cream-1)',
          2: 'var(--cream-2)',
          3: 'var(--cream-3)',
          4: 'var(--cream-4)',
        },
        teal: {
          0: 'var(--teal-0)',
          1: 'var(--teal-1)',
          2: 'var(--teal-2)',
          3: 'var(--teal-3)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          container: 'var(--color-primary-container)',
          on: 'var(--color-on-primary)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          container: 'var(--color-secondary-container)',
        },
        amber: { 1: 'var(--amber-1)' },
        danger: { 1: 'var(--red-1)' },
        base: 'var(--bg-base)',
        raised: 'var(--bg-raised)',
        overlay: 'var(--bg-overlay)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-card)',
        indigo: 'var(--indigo)',
        emerald: 'var(--emerald)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      maxWidth: {
        app: 'var(--container-max)',
      },
      spacing: {
        gutter: 'var(--space-gutter)',
        'stack-sm': 'var(--space-stack-sm)',
        'stack-md': 'var(--space-stack-md)',
        'stack-lg': 'var(--space-stack-lg)',
      },
      transitionDuration: {
        DEFAULT: '120ms',
        layout: '200ms',
      },
      boxShadow: {
        luminous: 'var(--shadow-luminous)',
        card: 'var(--shadow-card)',
        'teal-sm': '0 0 0 1px rgba(79, 219, 200, 0.35)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-right': {
          from: { opacity: '0', transform: 'translateX(-6px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease forwards',
        'slide-right': 'slide-right 200ms ease-out forwards',
      },
    },
  },
  plugins: [],
};
