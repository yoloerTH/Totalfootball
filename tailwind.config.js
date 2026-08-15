/** @type {import('tailwindcss').Config} */

/**
 * Brand tokens are a direct port of editor/src/branding/totalFootball.ts.
 * One source of truth with the videos, so do not re-pick these by eye.
 *
 * The neutrals resolve through CSS variables (see src/styles/global.css) so a
 * single `data-theme="dark"` on <html> re-skins the whole site. They are stored
 * as space-separated RGB channels rather than hex because that is what lets
 * Tailwind's slash-opacity syntax keep working: `text-ink/85` compiles to
 * `rgb(var(--tf-ink) / 0.85)`.
 *
 * Gold and green are fixed. They are the brand and they read on both grounds.
 */
const channel = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./src/**/*.{astro,js,ts,jsx,tsx,md,mdx}'],
  /*
   * `dark:` means "on a dark ground", which is three of the four themes and not
   * one of them — the two pitch themes are dark too. A single selector would
   * leave anything written with `dark:` reading as if the page were still white
   * on Pitch Broadcast.
   *
   * Nearly nothing needs it: the neutrals already resolve through the variables
   * below, so a theme is a palette block in global.css and no utilities at all.
   * `dark:` is for the handful of places where a FIXED colour has to change —
   * the darkened gold in ModelCurve.astro, which is the only one today.
   */
  darkMode: [
    'variant',
    [
      '&:where([data-theme="dark"], [data-theme="dark"] *)',
      '&:where([data-theme="pitch"], [data-theme="pitch"] *)',
      '&:where([data-theme="pitch-night"], [data-theme="pitch-night"] *)',
    ],
  ],
  theme: {
    extend: {
      colors: {
        paper: channel('--tf-paper'),
        'paper-deep': channel('--tf-paper-deep'),
        /** Raised panels. White on light, a lifted charcoal on dark. */
        surface: channel('--tf-surface'),
        ink: channel('--tf-ink'),
        'ink-soft': 'rgb(var(--tf-ink) / 0.62)',
        'ink-faint': 'rgb(var(--tf-ink) / 0.38)',
        'ink-hair': 'rgb(var(--tf-ink) / 0.10)',
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
        // The video identity's signature: a soft, low, wide drop, never a hard
        // card shadow. Driven by variables because a shadow that reads on paper
        // is invisible on a near-black ground, where the panel has to be lifted
        // by a hairline and a lighter fill instead.
        paper: 'var(--tf-shadow-paper)',
        lift: 'var(--tf-shadow-lift)',
      },
      maxWidth: {
        prose: '68ch',
        shell: '1180px',
      },
    },
  },
  plugins: [],
}
