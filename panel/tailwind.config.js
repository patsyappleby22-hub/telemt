/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f8f8f8',
          100: '#e8e8e8',
          200: '#c8c8c8',
          300: '#a0a0a0',
          400: '#707070',
          500: '#484848',
          600: '#303030',
          700: '#222222',
          800: '#181818',
          900: '#0e0e0e',
          950: '#080808',
        }
      }
    }
  },
  plugins: []
}
