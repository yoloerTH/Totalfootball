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
 * `swatch` duplicates a little more of each block than `paper` does — the two
 * grounds either side of the page colour, and the light — for the same reason
 * and on the same terms.
 */

export type ThemeId = 'light' | 'dark' | 'pitch' | 'pitch-night'

export interface Theme {
  id: ThemeId
  /** How it reads in the picker. */
  label: string
  /** One line under it. */
  hint: string
  /** Browser UI colour, and the swatch's middle ground. Matches --tf-paper. */
  paper: string
  /** The rule drawn across the swatch. Matches --tf-ink in global.css. */
  accent: string
  /** What the room looks like at 16px. See `themeSwatch` below. */
  swatch: ThemeSwatch
}

/**
 * A room, small enough to sit in a button.
 *
 * The picker used to draw every theme as the same diagonal two-tone split,
 * `linear-gradient(135deg, paper 55%, accent 55%)`, and it failed at the one
 * job a swatch has. Day and Night came out as exact inverses of each other,
 * which reads as a generic contrast icon rather than as two rooms; and the two
 * pitch themes came out as the same dark green disc differing only in a sliver
 * of gold versus mint, which is the least visible part of the shape. Four
 * options, two of which nobody could tell apart (user, 2026-08-19).
 *
 * So a swatch is now a miniature of the room's own stage rather than a device
 * laid over its colours, and the themes are told apart by TEXTURE first and
 * hue second — which is also what makes them survive being 16px, and what makes
 * them work for a coach who cannot separate gold from mint.
 *
 * The texture is not invented for the swatch. `--tf-stage-pattern` in
 * global.css already says what each room is patterned with: the two pitch
 * themes are mown in bands, and the other two are not. That is the whole
 * discriminator, and it lands on exactly the pair that needed one.
 */
export interface ThemeSwatch {
  /**
   * The ground, top and bottom. `paper` is the stop between them, so the
   * swatch is lit the way the page is rather than being one flat fill.
   */
  ground: [string, string]
  /**
   * The light in the room: an `r,g,b` triple, how strong it falls, and where.
   *
   * Written as a triple rather than a hex because the glow needs the same
   * colour at zero alpha for its outer stop. A gradient that fades to the
   * keyword `transparent` fades through transparent BLACK on the way, which
   * puts a grey bloom around a green glow on a dark ground.
   */
  light: { rgb: string; alpha: number; at: string }
  /**
   * Mown bands, at this alpha. The two pitch rooms only — it is what their own
   * `--tf-stage-pattern` draws, and it is why they are no longer twins.
   */
  bands?: number
}

export const THEMES: Theme[] = [
  {
    id: 'light',
    label: 'Day',
    hint: 'The paper stage. The default, and what the videos are drawn on.',
    paper: '#F4F4F2',
    accent: '#161618',
    // Paper, lit from above, with a line ruled on it. No bands: the day stage
    // is a grid, and a grid at this size is noise rather than texture.
    swatch: {
      ground: ['#FFFFFF', '#EAEAE6'],
      light: { rgb: '255,255,255', alpha: 0.85, at: '50% 16%' },
    },
  },
  {
    id: 'dark',
    label: 'Night',
    hint: 'Near-black with a green cast. For reading in the dark.',
    paper: '#0A0C0B',
    accent: '#F5F5F3',
    // The same page with the lights off, and the green cast the palette is
    // named for made visible — it is the one thing that separates this from a
    // neutral dark theme, and it was doing nothing in the old swatch.
    swatch: {
      ground: ['#111614', '#050706'],
      light: { rgb: '8,193,106', alpha: 0.42, at: '74% 78%' },
    },
  },
  {
    id: 'pitch',
    label: 'Pitch Broadcast',
    hint: 'Televised turf, mown in bands.',
    paper: '#15512D',
    accent: '#F2C55E',
    // Mown in bands, which is what the hint has always said and what the stage
    // has always drawn. Gold reads as the warm television light over the top
    // rather than as a wedge of colour.
    swatch: {
      ground: ['#1C6739', '#104324'],
      light: { rgb: '242,197,94', alpha: 0.34, at: '50% 10%' },
      bands: 0.12,
    },
  },
  {
    id: 'pitch-night',
    label: 'Pitch Night',
    hint: 'The same pitch under floodlights.',
    paper: '#081A11',
    accent: '#6FEFA8',
    // The same bands, dimmer, under a floodlight coming in off one corner.
    // Same turf as Broadcast and unmistakably not it, which is the whole point
    // of the pair.
    swatch: {
      ground: ['#103923', '#05120B'],
      light: { rgb: '111,239,168', alpha: 0.44, at: '20% 8%' },
      bands: 0.09,
    },
  },
]

/**
 * A theme's swatch, as a CSS `background` value.
 *
 * Returned as a string rather than as a component because the two pickers that
 * draw it are not the same technology — one is Astro with a vanilla script
 * (../components/Header.astro), the other is React (../studio/editor/
 * ThemeToggle.tsx) — and a string is the only shape both can take without the
 * geometry being written out twice and drifting.
 *
 * Layers paint FIRST ON TOP:
 *
 *   1. the rule, a short bar low on the swatch, in the room's ink
 *   2. the light, falling where that room's light falls
 *   3. the mown bands, on the two rooms that have them
 *   4. the ground the page is painted in
 *
 * The rule is the constant across all four, so the set reads as one system;
 * everything under it is what makes a room itself.
 */
export function themeSwatch(t: Theme): string {
  const { ground, light, bands } = t.swatch
  const glow = `rgba(${light.rgb},`
  return [
    // Sat LOW and run wide, so it reads as the line at the foot of a page.
    // Centred and half-width it read as a minus sign, which is the one thing a
    // swatch must not look like — it says "off" rather than "this room".
    `linear-gradient(to right, ${t.accent}, ${t.accent}) 50% 78% / 58% 8% no-repeat`,
    `radial-gradient(circle at ${light.at}, ${glow}${light.alpha}), ${glow}0) 62%)`,
    // Six bands across, not two. A wide repeat reads as a swatch split down the
    // middle; it takes three full cycles before the eye calls it mowing.
    bands
      ? `repeating-linear-gradient(90deg, rgba(255,255,255,${bands}) 0 16.67%, rgba(255,255,255,0) 16.67% 33.34%)`
      : null,
    `linear-gradient(to bottom, ${ground[0]}, ${t.paper} 58%, ${ground[1]})`,
  ]
    .filter(Boolean)
    .join(', ')
}

export const DEFAULT_THEME: ThemeId = 'light'

export const THEME_STORAGE_KEY = 'tf_theme'

/** Coerce anything found in storage — including a retired id — to a live theme. */
export function resolveTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
