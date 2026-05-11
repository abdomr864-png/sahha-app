/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0B0B0F',
          subtle: '#13131A',
          raised: '#1B1B24',
          elevated: '#22222C',
        },
        ink: {
          DEFAULT: '#F4F4F5',
          subtle: '#A1A1AA',
          muted: '#71717A',
          dim: '#52525B',
        },
        accent: {
          DEFAULT: '#FF4D2E',
          soft: '#FF7A4D',
          deep: '#D63A1F',
          contrast: '#FFFFFF',
        },
        border: {
          DEFAULT: '#27272F',
          strong: '#3F3F46',
        },
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#F87171',
        violet: '#7C3AED',
      },
      fontFamily: {
        sans: ['System'],
        mono: ['Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
