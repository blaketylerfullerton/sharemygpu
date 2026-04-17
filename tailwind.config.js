/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn zinc dark
        coop: {
          void:     '#09090b',
          deep:     '#09090b',
          surface:  '#18181b',
          elevated: '#27272a',
          overlay:  '#3f3f46',
          accent:   '#fafafa',
          green:    '#4ade80',
          amber:    '#facc15',
          red:      '#f87171',
          blue:     '#60a5fa',
        },
        tx: {
          primary:   '#fafafa',
          secondary: '#a1a1aa',
          tertiary:  '#71717a',
        },
        bd: {
          DEFAULT: '#27272a',
          muted:   '#3f3f46',
        },
      },
      fontFamily: {
        display: ['"Geist"', 'system-ui', 'sans-serif'],
        body:    ['"Geist"', 'system-ui', 'sans-serif'],
        mono:    ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        // subtle shadows only — no colored glows
        card: '0 1px 3px rgba(0,0,0,0.4)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.5)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'subtle-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },
      animation: {
        'fade-up':      'fade-up 0.2s cubic-bezier(0.16,1,0.3,1) both',
        'subtle-pulse': 'subtle-pulse 2s ease infinite',
      },
    },
  },
  plugins: [],
};
