/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      boxShadow: {
        glow: '0 22px 80px rgba(168, 85, 247, 0.38)',
        card: '0 18px 44px rgba(15, 23, 42, 0.3)',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pop: {
          '0%': { transform: 'scale(0.97)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        floaty: 'floaty 5s ease-in-out infinite',
        pop: 'pop 180ms ease-out',
      },
    },
  },
  plugins: [],
};
