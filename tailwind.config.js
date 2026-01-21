/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          'bg-deep': 'rgba(15, 15, 20, 0.85)',
          'bg-primary': 'rgba(255, 255, 255, 0.05)',
          'bg-secondary': 'rgba(255, 255, 255, 0.08)',
          'bg-elevated': 'rgba(255, 255, 255, 0.1)',
          'bg-hover': 'rgba(255, 255, 255, 0.12)',
          'bg-active': 'rgba(255, 255, 255, 0.15)',
          accent: {
            DEFAULT: '#6366f1',
            light: '#818cf8',
            dark: '#4f46e5',
            glow: 'rgba(99, 102, 241, 0.4)',
            subtle: 'rgba(99, 102, 241, 0.15)',
          },
          success: {
            DEFAULT: '#10b981',
            glow: 'rgba(16, 185, 129, 0.4)',
          },
          warning: {
            DEFAULT: '#f59e0b',
            glow: 'rgba(245, 158, 11, 0.4)',
          },
          error: {
            DEFAULT: '#ef4444',
            glow: 'rgba(239, 68, 68, 0.4)',
          },
          neutral: 'rgba(255, 255, 255, 0.3)',
          'text-primary': 'rgba(255, 255, 255, 0.95)',
          'text-secondary': 'rgba(255, 255, 255, 0.7)',
          'text-muted': 'rgba(255, 255, 255, 0.5)',
          'text-subtle': 'rgba(255, 255, 255, 0.35)',
          'speaker-interviewer': '#60a5fa',
          'speaker-you': '#34d399',
          'border-subtle': 'rgba(255, 255, 255, 0.08)',
          'border-default': 'rgba(255, 255, 255, 0.12)',
          'border-strong': 'rgba(255, 255, 255, 0.18)',
        },
      },
      borderRadius: {
        'glass-sm': '8px',
        'glass-md': '12px',
        'glass-lg': '16px',
        'glass-xl': '20px',
      },
      boxShadow: {
        'glass-sm': '0 2px 8px rgba(0, 0, 0, 0.15)',
        'glass-md': '0 4px 16px rgba(0, 0, 0, 0.2)',
        'glass-lg': '0 8px 32px rgba(0, 0, 0, 0.25)',
        'glass-glow': '0 0 40px rgba(99, 102, 241, 0.4)',
        'glass-inset': 'inset 0 1px 1px rgba(255, 255, 255, 0.1)',
      },
      backdropBlur: {
        'glass-sm': '8px',
        'glass-md': '16px',
        'glass-lg': '24px',
        'glass-xl': '40px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'glass-pulse': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.15)' },
        },
        'glass-ping': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'glass-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'glass-spin': {
          to: { transform: 'rotate(360deg)' },
        },
        'glass-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'glass-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'glass-slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'glass-pulse': 'glass-pulse 2s ease-in-out infinite',
        'glass-ping': 'glass-ping 1.5s ease-out infinite',
        'glass-blink': 'glass-blink 1s step-end infinite',
        'glass-spin': 'glass-spin 0.8s linear infinite',
        'glass-bounce': 'glass-bounce 0.6s ease-in-out infinite',
        'glass-fade-in': 'glass-fade-in 0.2s ease-out',
        'glass-slide-up': 'glass-slide-up 0.3s ease-out',
      },
      transitionDuration: {
        'glass-fast': '150ms',
        'glass-normal': '250ms',
        'glass-slow': '400ms',
      },
    },
  },
  plugins: [],
};
