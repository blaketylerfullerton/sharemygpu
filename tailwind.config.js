/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'coop-green': '#22c55e',
        'coop-yellow': '#eab308',
        'coop-red': '#ef4444',
        'coop-gray': '#6b7280',
      },
    },
  },
  plugins: [],
};
