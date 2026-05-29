/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        void: '#000000',
        primary: '#00d4ff',
        secondary: '#7b2fff',
        tertiary: '#ff2d6b',
        amber: '#ffaa00',
        success: '#00ff9d',
      },
    },
  },
  plugins: [],
};
