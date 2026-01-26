/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          'bg-deep': 'rgba(10, 12, 18, 0.55)',
          'bg-primary': 'rgba(255, 255, 255, 0.035)',
          'bg-secondary': 'rgba(255, 255, 255, 0.055)',
          'bg-elevated': 'rgba(255, 255, 255, 0.08)',
          'bg-hover': 'rgba(255, 255, 255, 0.1)',
          'bg-active': 'rgba(255, 255, 255, 0.14)',
          accent: {
            DEFAULT: '#9bb6ff',
            light: '#b9d4ff',
            dark: '#7aa2ff',
            glow: 'rgba(155, 182, 255, 0.4)',
            subtle: 'rgba(155, 182, 255, 0.16)',
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
          neutral: 'rgba(255, 255, 255, 0.26)',
          'text-primary': 'rgba(255, 255, 255, 0.92)',
          'text-secondary': 'rgba(255, 255, 255, 0.68)',
          'text-muted': 'rgba(255, 255, 255, 0.5)',
          'text-subtle': 'rgba(255, 255, 255, 0.34)',
          'speaker-interviewer': '#60a5fa',
          'speaker-you': '#34d399',
          'border-subtle': 'rgba(255, 255, 255, 0.06)',
          'border-default': 'rgba(255, 255, 255, 0.1)',
          'border-strong': 'rgba(255, 255, 255, 0.16)',
        },
      },
      borderRadius: {
        'glass-sm': '8px',
        'glass-md': '12px',
        'glass-lg': '16px',
        'glass-xl': '20px',
      },
      boxShadow: {
        'glass-sm': '0 2px 8px rgba(0, 0, 0, 0.12)',
        'glass-md': '0 6px 20px rgba(0, 0, 0, 0.18)',
        'glass-lg': '0 14px 40px rgba(0, 0, 0, 0.22)',
        'glass-glow': '0 0 50px rgba(155, 182, 255, 0.35)',
        'glass-inset': 'inset 0 1px 1px rgba(255, 255, 255, 0.18)',
      },
      backdropBlur: {
        'glass-sm': '10px',
        'glass-md': '20px',
        'glass-lg': '32px',
        'glass-xl': '56px',
      },
      fontFamily: {
        sans: [
          '"SF Pro Display"',
          '"SF Pro Text"',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          '"SFMono-Regular"',
          'ui-monospace',
          'Menlo',
          'monospace',
        ],
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
