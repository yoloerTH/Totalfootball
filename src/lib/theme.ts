/**
 * The four rooms the site can be read in.
 *
 * A theme is CHROME ONLY: the page, the panels, the type. It is not the board.
 * A coach can work in Pitch Night and hand out a system drawn on paper, and the
 * person who opens the link sees paper — because what the board is drawn on is
 * stored on the document (src/studio/board/surfaces.ts), not on whoever is
 * looking at it. Those two things are named alike on purpose and are wired
 * separately on purpose; see the note at the top of surfaces.ts.
 *
 * ONE MECHANISM, THREE PLACES. `data-theme` on <html>, remembered under
 * `tf_theme`, applied before first paint by the inline script in
 * BaseLayout.astro. The header's picker (Header.astro) and the studio's
 * (studio/editor/ThemeToggle.tsx) both drive that same attribute and key, so
 * switching in one is switching in the other. Light removes the attribute
 * rather than setting one, which is what keeps it the default for a first-time
 * visitor whose machine is set to dark.
 *
 * The hexes below are duplicated in the CSS blocks in src/styles/global.css —
 * a stylesheet cannot import a module. They are the theme-colour meta and the
 * picker's swatches; if you change a palette, change both. Same trade, and the
 * same reasoning, as the board palette being a third copy of the videos'.
 */

export type ThemeId = 'light' | 'dark' | 'pitch' | 'pitch-night'

export interface Theme {
  id: ThemeId
  /** How it reads in the picker. */
  label: string
  /** One line under it. */
  hint: string
  /** Browser UI colour, and the top swatch. Matches --tf-paper in global.css. */
  paper: string
  /** The swatch's accent, so two dark themes are told apart at a glance. */
  accent: string
}

export const THEMES: Theme[] = [
  {
    id: 'light',
    label: 'Day',
    hint: 'The paper stage. The default, and what the videos are drawn on.',
    paper: '#F4F4F2',
    accent: '#161618',
  },
  {
    id: 'dark',
    label: 'Night',
    hint: 'Near-black with a green cast. For reading in the dark.',
    paper: '#0A0C0B',
    accent: '#F5F5F3',
  },
  {
    id: 'pitch',
    label: 'Pitch Broadcast',
    hint: 'Televised turf, mown in bands.',
    paper: '#15512D',
    accent: '#F2C55E',
  },
  {
    id: 'pitch-night',
    label: 'Pitch Night',
    hint: 'The same pitch under floodlights.',
    paper: '#081A11',
    accent: '#6FEFA8',
  },
]

export const DEFAULT_THEME: ThemeId = 'light'

export const THEME_STORAGE_KEY = 'tf_theme'

/** Coerce anything found in storage — including a retired id — to a live theme. */
export function resolveTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
