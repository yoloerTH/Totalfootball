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
 * NOTE THE BOARD IS ALWAYS LIGHT. The studio chrome follows the site's
 * data-theme, but the pitch stays on the paper stage in both modes, because
 * the paper stage IS the brand and an exported deck has to look like the
 * videos no matter what the coach's screen was set to when they made it.
 * See src/styles/global.css for the chrome's tokens.
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

/**
 * Cue colours. PRESS is the hot one — it is the job that moves, and gold is
 * what the videos use to say "this is the player to watch".
 */
export const CUE_COLOR: Record<string, string> = {
  PRESS: BOARD.goldDeep,
  COVER: BOARD.ink,
  BALANCE: BOARD.greenDeep,
  SPARE: BOARD.inkSoft,
  JOCKEY: BOARD.goldDeep,
  DROP: BOARD.greenDeep,
}

/**
 * Arrow treatments, one per intent.
 *
 * `width` and `dash` are in METRES, like every other size on the board, and are
 * converted at draw time. Storing a dash as a ready-made SVG string is the
 * trap here: `strokeDasharray` is in user units, so "1.6 1.1" would mean 16cm
 * of ink and 11cm of gap and render as a solid line.
 */
export const ARROW_STYLE = {
  pass: { color: BOARD.ink, dash: null as [number, number] | null, width: 0.42 },
  run: { color: BOARD.greenDeep, dash: [1.5, 1.05] as [number, number] | null, width: 0.42 },
  carry: { color: BOARD.ink, dash: null as [number, number] | null, width: 0.42, wavy: true },
  press: { color: BOARD.goldDeep, dash: null as [number, number] | null, width: 0.5 },
  switch: { color: BOARD.ink, dash: [2.4, 1.3] as [number, number] | null, width: 0.5 },
} as const

/** Band fills, keyed by kind. Widths and opacities match the videos' BlockBand. */
export const BAND_STYLE = {
  block: { tone: BOARD.green, fill: 0.22, edge: 0.4, string: 0.7 },
  danger: { tone: BOARD.gold, fill: 0.18, edge: 0.35, string: 0 },
  zone: { tone: BOARD.ink, fill: 0.08, edge: 0.22, string: 0 },
} as const

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
