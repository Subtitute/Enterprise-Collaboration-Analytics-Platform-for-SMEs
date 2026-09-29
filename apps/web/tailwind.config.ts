import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#627d98',
          500: '#334e68',
          600: '#1E3A8A',  // Navy đậm chuẩn (#1E3A8A)
          700: '#1e305e',
          800: '#18274b',
          900: '#0f172a',
          950: '#090d16',
        },
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          600: '#1E3A8A',
          700: '#1a3275',
          800: '#142557',
          900: '#0e1a3d',
        },
        secondary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10B981',  // Xanh ngọc lục bảo
          600: '#059669',
          700: '#047857',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#F59E0B',  // Hổ phách / Cam đất
          600: '#d97706',
          700: '#b45309',
        },
      },
      fontFamily: {
        heading: ['Lora', 'serif'],
        display: ['Lora', 'serif'],
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
