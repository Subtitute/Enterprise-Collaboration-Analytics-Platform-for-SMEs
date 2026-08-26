import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',   // indigo-50
          100: '#e0e7ff',  // indigo-100
          200: '#c7d2fe',  // indigo-200
          300: '#a5b4fc',  // indigo-300
          400: '#818cf8',  // indigo-400
          500: '#6366f1',  // indigo-500
          600: '#4f46e5',  // indigo-600 (chủ đạo)
          700: '#4338ca',  // indigo-700
          800: '#3730a3',  // indigo-800
          900: '#312e81',  // indigo-900
          950: '#1e1b4b',  // indigo-950
        },
        violetBrand: {
          500: '#8b5cf6',  // violet-500
          600: '#7c3aed',  // violet-600
          700: '#6d28d9',  // violet-700
        },
      },
      fontFamily: {
        display: ['Roboto', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
        sans: ['Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
