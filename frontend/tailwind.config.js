/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#0a0a0a',
        darker: '#050505',
      },
      fontFamily: {
        sans: ['Bookman Old Style', 'Crimson Text', 'Book Antiqua', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}