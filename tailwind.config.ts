import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        'primary': '#0050cb',
        'on-primary': '#ffffff',
        'primary-container': '#0066ff',
        'on-primary-container': '#f8f7ff',
        'inverse-primary': '#b3c5ff',
        'primary-fixed': '#dae1ff',
        'primary-fixed-dim': '#b3c5ff',
        'on-primary-fixed': '#001849',
        'on-primary-fixed-variant': '#003fa4',
        // Secondary
        'secondary': '#525f72',
        'on-secondary': '#ffffff',
        'secondary-container': '#d3e0f7',
        'on-secondary-container': '#566377',
        'secondary-fixed': '#d6e3fa',
        'secondary-fixed-dim': '#bac7de',
        'on-secondary-fixed': '#0f1c2d',
        'on-secondary-fixed-variant': '#3b485a',
        // Tertiary
        'tertiary': '#a33200',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#cc4204',
        'on-tertiary-container': '#fff6f4',
        'tertiary-fixed': '#ffdbd0',
        'tertiary-fixed-dim': '#ffb59d',
        'on-tertiary-fixed': '#390c00',
        'on-tertiary-fixed-variant': '#832600',
        // Error
        'error': '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        // Surface
        'surface': '#faf8ff',
        'surface-dim': '#d8d9e6',
        'surface-bright': '#faf8ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#ecedfa',
        'surface-container-high': '#e6e7f4',
        'surface-container-highest': '#e1e2ee',
        'on-surface': '#191b24',
        'on-surface-variant': '#424656',
        'surface-variant': '#e1e2ee',
        'surface-tint': '#0054d6',
        // Background
        'background': '#faf8ff',
        'on-background': '#191b24',
        'background-app': '#F8FAFC',
        // Other
        'outline': '#727687',
        'outline-variant': '#c2c6d8',
        'inverse-surface': '#2e303a',
        'inverse-on-surface': '#eff0fd',
        // Semantic
        'success-green': '#22C55E',
        'vibrant-cyan': '#00D2D3',
        'body-grey': '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        'display-kpi': ['Inter', 'sans-serif'],
        'headline-lg': ['Inter', 'sans-serif'],
        'headline-md': ['Inter', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'label-sm': ['Inter', 'sans-serif'],
        'data-mono': ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-kpi': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        'data-mono': ['14px', { lineHeight: '20px', fontWeight: '500' }],
      },
      borderRadius: {
        'DEFAULT': '0.25rem',
        'sm': '0.125rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        'full': '9999px',
      },
      spacing: {
        'section-padding': '3rem',
        'element-gap': '0.5rem',
        'container-margin': '2rem',
        'gutter-md': '1rem',
        'gutter-lg': '1.5rem',
      },
      boxShadow: {
        'ambient': '0px 1px 3px rgba(0,0,0,0.05)',
        'overlay': '0px 10px 15px -3px rgba(0,0,0,0.1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
