/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        booth: {
          bg: '#0b0b10',
          panel: '#14141c',
          line: '#262631',
          ink: '#eceaf0',
          dim: '#a7a3b8',
          accent: '#c9a7ff',
        },
      },
    },
  },
  plugins: [],
};
