/** @type {import('tailwindcss').Config} */
/*
 * Banknbox WMS — "Teal & Slate" theme
 * Cool slate neutrals, deep-teal primary (brand), steel-blue secondary,
 * green for inbound/success. Shadows are layered to give panels a physical,
 * 3D slab look (top highlight + visible bottom edge + soft drop shadow).
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F1F4F6',
        surface: '#FFFFFF',
        'surface-raised': '#F9FBFC',
        'surface-subtle': '#EEF2F4',
        ink: '#142028',
        'ink-muted': '#5A6B76',
        'ink-subtle': '#94A3AD',
        border: '#DCE3E8',
        edge: '#CDD6DC', // the visible "thickness" under 3D panels
        navy: '#152733', // graphite — sidebar / dark surfaces
        graphite: { DEFAULT: '#152733', 2: '#1C3341', 3: '#2A4555' },
        brand: { DEFAULT: '#0F766E', hover: '#0D6660', deep: '#0A4F4A', soft: '#E0F2F0', light: '#14A396' },
        steel: { DEFAULT: '#2D5B88', hover: '#244B71', deep: '#1C3A58', soft: '#E5EDF5', light: '#5B8BBA' },
        mint: { DEFAULT: '#15803D', deep: '#0F5F2D', soft: '#DCFCE7', light: '#22A55A' },
        amber: { DEFAULT: '#B45309', deep: '#7C3A06', soft: '#FEF3C7', light: '#F59E0B' },
        red: { DEFAULT: '#DC2626', deep: '#991B1B', soft: '#FEE2E2' },
        violet: { DEFAULT: '#6A55CF', deep: '#4B39A8', soft: '#EFECFC' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        panel:
          'inset 0 1px 0 0 rgb(255 255 255 / 0.9), 0 1px 2px 0 rgb(29 35 44 / 0.06), 0 3px 0 -1px #CDD6DC, 0 14px 28px -14px rgb(29 35 44 / 0.28)',
        lift:
          'inset 0 1px 0 0 rgb(255 255 255 / 0.9), 0 2px 4px 0 rgb(29 35 44 / 0.06), 0 5px 0 -1px #CDD6DC, 0 26px 40px -18px rgb(29 35 44 / 0.38)',
        popover: '0 4px 0 -1px #CDD6DC, 0 24px 48px -16px rgb(29 35 44 / 0.35), 0 6px 14px -6px rgb(29 35 44 / 0.12)',
        key: 'inset 0 1px 0 0 rgb(255 255 255 / 0.25), 0 3px 0 0 #0A4F4A, 0 10px 18px -8px rgb(15 118 110 / 0.6)',
        'key-sm': 'inset 0 1px 0 0 rgb(255 255 255 / 0.25), 0 2px 0 0 #0A4F4A, 0 6px 12px -6px rgb(15 118 110 / 0.55)',
        'key-steel': 'inset 0 1px 0 0 rgb(255 255 255 / 0.2), 0 3px 0 0 #1C3A58, 0 10px 18px -8px rgb(45 91 136 / 0.55)',
        'key-red': 'inset 0 1px 0 0 rgb(255 255 255 / 0.2), 0 3px 0 0 #991B1B, 0 10px 18px -8px rgb(220 38 38 / 0.5)',
        'key-neutral': 'inset 0 1px 0 0 #fff, 0 2px 0 0 #CDD6DC, 0 6px 12px -8px rgb(29 35 44 / 0.25)',
        well: 'inset 0 2px 3px 0 rgb(29 35 44 / 0.07), inset 0 0 0 1px rgb(29 35 44 / 0.04)',
        glow: '0 0 0 4px rgb(15 118 110 / 0.18)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease forwards',
        'slide-up': 'slideUp 0.35s cubic-bezier(.2,.8,.2,1) both',
        'slide-right': 'slideRight 0.25s ease forwards',
        'rise': 'rise 0.6s cubic-bezier(.2,.8,.2,1) both',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        rise: {
          from: { opacity: '0', transform: 'perspective(900px) rotateX(18deg) translateY(18px)' },
          to: { opacity: '1', transform: 'perspective(900px) rotateX(0) translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
