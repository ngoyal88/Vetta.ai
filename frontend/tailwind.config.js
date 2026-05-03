/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* background layers */
        base:    '#050505',
        raised:  '#0a0a0a',
        overlay: '#0f0f0f',
        surface: '#141414',
        card:    '#181818',

        /* brand */
        indigo:  '#6366F1',
        emerald: '#10B981',

        /* aliases kept for backwards compat */
        dark:   '#0a0a0a',
        darker: '#050505',
      },
      fontFamily: {
        sans:    ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        display: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm:      '3px',
        md:      '6px',
        lg:      '8px',
        xl:      '10px',
        '2xl':   '12px',
      },
      fontSize: {
        '2xs': ['0.65rem',  { lineHeight: '1rem' }],
        xs:    ['0.75rem',  { lineHeight: '1.1rem' }],
        sm:    ['0.875rem', { lineHeight: '1.375rem' }],
        base:  ['1rem',     { lineHeight: '1.5rem' }],
        lg:    ['1.125rem', { lineHeight: '1.75rem' }],
        xl:    ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem',   { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl': ['3rem',     { lineHeight: '1.15' }],
        '6xl': ['3.75rem',  { lineHeight: '1.1' }],
        '7xl': ['4.5rem',   { lineHeight: '1.05' }],
        '8xl': ['6rem',     { lineHeight: '1' }],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-right': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.25s ease-out forwards',
        'slide-right':'slide-right 0.2s ease-out forwards',
      },
      boxShadow: {
        'indigo-sm': '0 0 0 1px rgba(99,102,241,0.35)',
        'indigo':    '0 0 0 1px rgba(99,102,241,0.35), 0 0 16px rgba(99,102,241,0.2)',
        'emerald-sm':'0 0 0 1px rgba(16,185,129,0.3)',
      },
    },
  },
  plugins: [],
};