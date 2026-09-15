/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F7FB',
        surface: '#FFFFFF',
        'surface-raised': '#FAFCFF',
        'surface-subtle': '#EEF2F7',
        ink: '#14213D',
        'ink-muted': '#64748B',
        'ink-subtle': '#94A3B8',
        border: '#D9E2EC',
        navy: '#0F2747',
        blue: { DEFAULT: '#2563EB', soft: '#E8F0FF', hover: '#1D4ED8' },
        mint: { DEFAULT: '#0F9F8C', soft: '#DDF7F1' },
        amber: { DEFAULT: '#D97706', soft: '#FFF3D6' },
        red: { DEFAULT: '#DC3B4B', soft: '#FDE8EB' },
        violet: { DEFAULT: '#7357D8', soft: '#F0EDFF' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 2px 0 rgb(20 33 61 / 0.05), 0 1px 3px 0 rgb(20 33 61 / 0.06)',
        popover: '0 4px 16px 0 rgb(20 33 61 / 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease forwards',
        'slide-up': 'slideUp 0.25s ease forwards',
        'slide-right': 'slideRight 0.25s ease forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}