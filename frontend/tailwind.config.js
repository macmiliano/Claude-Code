/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Bright, cartoon-friendly palette.
      colors: {
        sky: { DEFAULT: '#38bdf8' },
        sunny: '#FFD43B',
        grass: '#51CF66',
        coral: '#FF6B6B',
        grape: '#845EF7',
        ink: '#2B2D42',
      },
      fontFamily: {
        display: ['"Fredoka"', '"Nunito"', 'system-ui', 'sans-serif'],
        body: ['"Nunito"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        pop: '0 6px 0 0 rgba(0,0,0,0.15)',
        'pop-lg': '0 10px 0 0 rgba(0,0,0,0.15)',
      },
      keyframes: {
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-8px)' },
          '40%, 80%': { transform: 'translateX(8px)' },
        },
        flashGreen: {
          '0%': { boxShadow: '0 0 0 0 rgba(81,207,102,0.0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(81,207,102,0.5)' },
          '100%': { boxShadow: '0 0 0 0 rgba(81,207,102,0.0)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(6deg)' },
        },
      },
      animation: {
        'bounce-slow': 'bounceSlow 1.4s ease-in-out infinite',
        wiggle: 'wiggle 0.6s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out',
        'flash-green': 'flashGreen 0.6s ease-out',
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
