/** @type {import('tailwindcss').Config} */
/**
 * Aligned with `.cursor/rules/frontend.md` §8 — radius max 8px for large surfaces.
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
        amber: { 1: 'var(--amber-1)' },
        danger: { 1: 'var(--red-1)' },
        /* Legacy names — map through CSS variables in index.css */
        base: 'var(--bg-base)',
        raised: 'var(--bg-raised)',
        overlay: 'var(--bg-overlay)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-card)',
        indigo: 'var(--teal-2)',
        emerald: 'var(--teal-1)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '6px',
        lg: '8px',
        xl: '8px',
        '2xl': '8px',
      },
      transitionDuration: {
        DEFAULT: '120ms',
        layout: '200ms',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.15' }],
        '6xl': ['3.75rem', { lineHeight: '1.1' }],
        '7xl': ['4.5rem', { lineHeight: '1.05' }],
        '8xl': ['6rem', { lineHeight: '1' }],
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
      boxShadow: {
        'teal-sm': '0 0 0 1px rgba(46, 138, 120, 0.35)',
      },
    },
  },
  plugins: [],
};
