/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1a1a1a',
        accent: '#1db954',
        hover: '#282828',
        border: '#404040',
      },
    },
  },
  plugins: [],
}