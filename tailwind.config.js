/** @type {import('tailwindcss').Config} */

/**
 * Brand tokens are a direct port of editor/src/branding/totalFootball.ts.
 * One source of truth with the videos — do not re-pick these by eye.
 */
export default {
  content: ['./src/**/*.{astro,js,ts,jsx,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F4F4F2',
        'paper-deep': '#EAEAE6',
        ink: '#161618',
        'ink-soft': 'rgba(22,22,24,0.62)',
        'ink-faint': 'rgba(22,22,24,0.38)',
        'ink-hair': 'rgba(22,22,24,0.10)',
        gold: '#E6B23A',
        'gold-deep': '#C9902B',
        green: '#08C16A',
        'green-deep': '#06A659',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        display: '-0.028em',
        micro: '0.22em',
      },
      fontSize: {
        // Editorial display scale. Clamped so the hero never needs a media query.
        display: ['clamp(2.75rem, 7vw, 5.5rem)', { lineHeight: '0.94', letterSpacing: '-0.028em' }],
        title: ['clamp(2rem, 4.6vw, 3.25rem)', { lineHeight: '1.02', letterSpacing: '-0.024em' }],
        section: ['clamp(1.5rem, 2.6vw, 2rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        micro: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.22em' }],
      },
      backgroundImage: {
        'tf-gradient': 'linear-gradient(135deg, #E6B23A 0%, #C9902B 42%, #08C16A 100%)',
        'tf-gradient-soft':
          'linear-gradient(135deg, rgba(230,178,58,0.14) 0%, rgba(8,193,106,0.14) 100%)',
      },
      boxShadow: {
        // The video identity's signature: a soft, low, wide drop — never a hard card shadow.
        paper: '0 1px 2px rgba(22,22,24,0.04), 0 12px 40px -12px rgba(22,22,24,0.14)',
        lift: '0 2px 4px rgba(22,22,24,0.04), 0 28px 60px -20px rgba(22,22,24,0.22)',
      },
      maxWidth: {
        prose: '68ch',
        shell: '1180px',
      },
    },
  },
  plugins: [],
}
