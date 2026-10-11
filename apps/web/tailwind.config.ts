import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // EFS Design System v0.2 Tokens
        'bg-canvas': '#F7F6F3',
        'bg-surface': '#FFFFFF',
        'bg-subtle': '#FAF9F6',
        'bg-muted': '#EFEDE8',
        'bg-inverse': '#1C1B1A',
        'border-subtle': '#E7E5DF',
        'border-strong': '#D3D0C8',
        'border-focus': '#0E5E5E',
        'text-primary': '#1C1B1A',
        'text-secondary': '#5C5A55',
        'text-tertiary': '#8A8781',
        'text-inverse': '#F7F6F3',
        'primary-ink': '#1C1B1A',
        'primary-ink-hover': '#2E2C29',
        accent: {
          DEFAULT: '#0E5E5E',
          soft: '#E4EFEE',
          hover: '#0A4848',
        },
        success: {
          DEFAULT: '#2F6F44',
          soft: '#E6F1E9',
        },
        warning: {
          DEFAULT: '#B45309',
          soft: '#FBEEE0',
        },
        error: {
          DEFAULT: '#B3261E',
          soft: '#F8E5E3',
        },
        info: {
          DEFAULT: '#1E5A8A',
          soft: '#E4EEF5',
        },
        // Legacy primary palette (kept for backward compatibility with existing components)
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
        sans: ['"IBM Plex Sans"', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"SF Mono"', 'Consolas', 'monospace'],
        display: ['"IBM Plex Sans"', '-apple-system', '"Segoe UI"', 'sans-serif'],
        body: ['"IBM Plex Sans"', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      spacing: {
        'space-1': '4px',
        'space-2': '8px',
        'space-3': '12px',
        'space-4': '16px',
        'space-5': '20px',
        'space-6': '24px',
        'space-8': '32px',
        'space-10': '40px',
        'space-12': '48px',
        'space-16': '64px',
      },
      borderRadius: {
        'radius-xs': '2px',
        'radius-sm': '4px',
        'radius-md': '6px',
        'radius-lg': '8px',
        'radius-full': '9999px',
        xl: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'shadow-none': 'none',
        'shadow-xs': '0 1px 2px rgba(28,27,26,0.04)',
        'shadow-sm': '0 2px 4px rgba(28,27,26,0.06)',
        'shadow-md': '0 8px 24px rgba(28,27,26,0.10), 0 2px 6px rgba(28,27,26,0.05)',
        'shadow-lg': '0 16px 48px rgba(28,27,26,0.14)',
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
