/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        obsidian: {
          950: '#090A0F',
          900: '#10121A',
          800: '#181B26',
          700: '#232736',
        },
        neon: {
          mint: '#00F5A0',
          cyan: '#00D9F5',
          orange: '#FF5E3A',
        }
      }
    },
  },
  plugins: [],
}
