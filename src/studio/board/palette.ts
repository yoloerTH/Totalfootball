/**
 * The board's palette.
 *
 * Ported from editor/src/components/football/TacticsBoard.tsx `BOARD` and
 * editor/src/branding/totalFootball.ts `TF`, which are the same numbers the
 * 123 published compositions draw with. This is the third copy of these
 * values (videos, tailwind.config.js, here) and that is a deliberate trade:
 * the two projects do not share a package, and these constants change roughly
 * never. If one of them ever does change, grep the hex.
 *
 * THE BOARD NEVER FOLLOWS THE VIEWER'S THEME. The studio chrome follows the
 * site's data-theme; the board does not, in either direction, because an
 * exported deck has to look the same to everyone who opens it no matter what
 * their screen was set to. See src/styles/global.css for the chrome's tokens.
 *
 * The board can still be drawn on something other than paper — see
 * ./surfaces.ts — but that is a choice stored on the DOCUMENT, made once by the
 * coach and carried into every export, which is a different thing entirely.
 * These values are the paper surface, and the one place its hexes live.
 */

export const BOARD = {
  /** The paper stage. Very slightly cooler and greener than the site's paper. */
  paper: '#ECEEE9',
  paper2: '#E2E5DF',
  /** Pitch markings. */
  line: 'rgba(28,34,30,0.28)',
  lineSoft: 'rgba(28,34,30,0.14)',
  /** The faint checker in the turf. */
  turf: 'rgba(28,34,30,0.028)',
  ink: '#161618',
  inkSoft: 'rgba(22,22,24,0.62)',
  gold: '#E6B23A',
  goldDeep: '#C9902B',
  green: '#08C16A',
  greenDeep: '#06A659',
  red: '#E2473B',
  redDeep: '#B5392F',
} as const

/*
 * Cue colours, arrow treatments and band fills used to live here as three
 * constants built out of BOARD. They are now functions of a surface's palette,
 * in ./surfaces.ts — an arrow whose colour is fixed to paper's ink is an arrow
 * that vanishes on a green pitch. `CUE_COLOR`, `ARROW_STYLE` and `BAND_STYLE`
 * are still exported from there, as the paper instances, for the illustrations
 * that draw a mark outside a board.
 */

/**
 * Darken a hex colour by `amount` (0–1), used to derive a kit's `deep` shade
 * from the `base` a coach picks. Keeps the dome's shading consistent across
 * every custom colour instead of asking them to choose two.
 */
export function darken(hex: string, amount = 0.22): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)))
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)))
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * Pick a label colour that stays legible on the counter. A coach who chooses a
 * yellow or white kit gets ink type instead of invisible white type, without
 * having to think about it.
 *
 * Uses relative luminance (WCAG's formula) rather than a naive average,
 * because green and yellow of the same "brightness" are nothing alike to an
 * eye and the naive version puts white text on #FFE100.
 */
export function readableText(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  const lum = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
  return lum > 0.45 ? BOARD.ink : '#FFFFFF'
}
