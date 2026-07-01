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
        // Surfaces — near-black, cool warmth (Sahha design tokens)
        bg: {
          DEFAULT: '#0A0A0F', // --bg : app base
          deep: '#0E0E15', // --bg-2 : scroll gutter / behind cards
          subtle: '#14141C', // --surface : card
          raised: '#1B1B25', // --surface-2 : elevated card / sheet
          elevated: '#23232F', // --surface-3 : input / chip / segmented
          pressed: '#2C2C3A', // --surface-4 : pressed / hovered chip
        },
        ink: {
          DEFAULT: '#F4F4F7', // --text
          subtle: '#B4B4C2', // --text-2
          muted: '#74748A', // --text-3
          dim: '#52525B',
        },
        // Primary flame accent (gradient #FF8A2B → #FF4D2E → #FF2D55)
        accent: {
          DEFAULT: '#FF4D2E',
          soft: '#FF8A2B', // gradient start
          bright: '#FF7A1A', // --orange
          end: '#FF2D55', // gradient end
          deep: '#C9184A',
          contrast: '#FFFFFF',
        },
        border: {
          DEFAULT: '#21212B', // hairline ≈ rgba(255,255,255,0.07)
          strong: '#34343F', // hairline-strong ≈ rgba(255,255,255,0.13)
        },
        success: '#2EE6A6',
        warning: '#F5C451',
        danger: '#FF4D6D',
        // Accent palette
        violet: {
          DEFAULT: '#A855F7',
          deep: '#6366F1',
        },
        green: '#2EE6A6',
        red: '#FF4D6D',
        gold: '#F5C451',
        blue: '#2BD2FF',
      },
      borderRadius: {
        // Sahha radii scale
        sm: '10px',
        xl: '20px', // --r-lg
        '2xl': '26px', // --r-xl
        '3xl': '32px', // --r-2xl
      },
      fontFamily: {
        sans: ['HankenGrotesk_500Medium', 'System'],
        body: ['HankenGrotesk_500Medium', 'System'],
        'body-bold': ['HankenGrotesk_700Bold', 'System'],
        display: ['SpaceGrotesk_700Bold', 'System'],
        'display-md': ['SpaceGrotesk_600SemiBold', 'System'],
        mono: ['Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
