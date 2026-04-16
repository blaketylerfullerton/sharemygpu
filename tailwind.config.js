/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coop: {
          void: '#06080d',
          deep: '#0d1117',
          surface: '#161b22',
          elevated: '#1c2128',
          overlay: '#21262d',
          accent: '#58e6d9',
          green: '#39d353',
          amber: '#e3b341',
          red: '#f85149',
          blue: '#58a6ff',
        },
        tx: {
          primary: '#e6edf3',
          secondary: '#7d8590',
          tertiary: '#484f58',
        },
        bd: {
          DEFAULT: '#21262d',
          muted: '#30363d',
        },
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(88, 230, 217, 0.15)',
        'glow-lg': '0 0 40px rgba(88, 230, 217, 0.2)',
        'glow-green': '0 0 10px rgba(57, 211, 83, 0.25)',
        'glow-red': '0 0 10px rgba(248, 81, 73, 0.25)',
        'glow-amber': '0 0 10px rgba(227, 179, 65, 0.25)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
