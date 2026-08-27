/**
 * The kit a coach works in, with the counters drawn as they will actually land.
 *
 * ── THE PREVIEW IS THE REAL `Token` ──────────────────────────────────────────
 *
 * Not a div with a background colour, and not a hand-drawn circle that looks
 * about right. It imports `Token` from ../board and renders it into a small SVG,
 * so the dome, the rim, the inner shade, the highlight, the trim ring and now
 * the stripes are the same marks the board makes. This is the rule
 * docs/STUDIO.md §3e sets for the video exporter — there is exactly ONE
 * renderer, so a preview cannot drift from what the coach posed — and it costs
 * nothing to keep here. It is also why the pattern picker below is five real
 * counters rather than five swatches: choosing a kit by looking at the kit.
 *
 * `Token` reads its ground from `SurfaceContext`, which defaults to PAPER, so it
 * needs no provider. It draws its own `<defs>`, keyed off `idp`, so every
 * counter on this page gets its own prefix and none of them collide.
 *
 * ── THE OPPOSITION IS NOT EDITABLE, AND THAT IS THE POINT ────────────────────
 *
 * There was a third swatch here for the away kit and it has been removed. A
 * coach owns one kit; the other team is whoever they are playing this week, and
 * a setting that has to be changed before every session is a setting that is
 * wrong most of the time. The opposition is drawn in the house colours below so
 * a coach can still judge the contrast, and a system that genuinely needs a
 * specific opponent sets it on that system.
 *
 * ── DERIVED, NOT STORED ──────────────────────────────────────────────────────
 *
 * The coach picks a base colour, a pattern, its second colour and, if the kit
 * needs it, a trim. `deep`, the shaded twin of the second colour and the label
 * colour are computed by `darken()` and `readableText()` — the same functions
 * the board uses at render time. supabase/005 gives the reason and it still
 * holds: storing them would be storing the same fact three times, and the third
 * copy is the one that goes stale.
 */

import { darken, readableText } from '../board/palette'
import { Token, TOKEN_R } from '../board/Token'
import { U } from '../board/pitch'
import { DEFAULT_THEM, DEFAULT_US, type KitPattern, type TeamStyle } from '../schema'
import { KIT_PATTERNS } from './identity'

export interface Kit {
  teamColour: string
  kitRing: string
  kitPattern: string
  kitAlt: string
}

/**
 * A `TeamStyle` from what the coach has picked so far.
 *
 * `ring: undefined` rather than `''` when there is no trim, because `Token`
 * tests the property's presence — an empty string is a stroke of nothing, drawn
 * at full width. The pattern gets the same treatment for a stronger reason: a
 * pattern with no second colour is a half-answered question, and the honest
 * drawing of it is a plain shirt rather than a guess.
 */
function style(kit: Kit, fallback: TeamStyle, pattern?: KitPattern): TeamStyle {
  const hex = kit.teamColour.trim() || fallback.base
  const alt = kit.kitAlt.trim()
  const chosen = pattern ?? (kit.kitPattern as KitPattern) ?? 'solid'
  const patterned = chosen !== 'solid' && Boolean(alt)
  return {
    name: fallback.name,
    base: hex,
    deep: darken(hex),
    text: readableText(hex),
    ring: kit.kitRing.trim() || undefined,
    pattern: patterned ? chosen : undefined,
    alt: patterned ? alt : undefined,
  }
}

/** Board metres → SVG units, the same conversion `Token` makes internally. */
const r = TOKEN_R * U
const BOX = { w: 200, h: 84 }
/** A picker tile: one counter, a little air around it. */
const TILE = r * 2.9

function Swatch({
  label,
  note,
  value,
  fallback,
  onChange,
  onClear,
  clearLabel,
}: {
  label: string
  note: string
  value: string
  fallback: string
  onChange: (hex: string) => void
  onClear?: () => void
  clearLabel?: string
}) {
  return (
    <div>
      <span className="text-[13px] font-bold text-ink">{label}</span>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">{note}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={label}
          className="h-11 w-16 cursor-pointer rounded-lg border border-ink-hair bg-surface p-1"
        />
        <span className="font-mono text-[13px] text-ink-soft">{value || fallback}</span>
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[12px] font-bold text-ink-faint underline underline-offset-4 hover:text-ink"
          >
            {clearLabel ?? 'Clear'}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The pattern picker: five counters, each wearing the kit it is offering.
 *
 * Each tile previews in the coach's OWN colours, so "stripes" is answered with
 * their stripes rather than with a generic example. The one compromise is that a
 * coach who has not yet chosen a second colour would see five identical plain
 * counters — so the tiles fall back to the trim colour, and then to the label
 * colour, purely for the preview. Nothing that happens here is stored; only the
 * pattern id is.
 */
function PatternPicker({ kit, onChange }: { kit: Kit; onChange: (patch: Partial<Kit>) => void }) {
  const current = kit.kitPattern || 'solid'
  const hint = kit.kitAlt.trim() || kit.kitRing.trim() || DEFAULT_US.text

  return (
    <div>
      <span className="text-[13px] font-bold text-ink">Pattern</span>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
        For the kits a colour alone does not describe. Drawn on the counter, so it reads on the
        board the same way it reads on a shirt.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {KIT_PATTERNS.map((k) => {
          const on = current === k.id
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ kitPattern: k.id })}
              className={`rounded-xl border px-2 pb-1.5 pt-2 transition-colors ${
                on
                  ? 'border-ink/40 bg-paper'
                  : 'border-ink-hair bg-surface hover:border-ink/20'
              }`}
            >
              <svg
                viewBox={`0 0 ${TILE} ${TILE}`}
                className="block w-11"
                role="img"
                aria-label={`${k.label} kit`}
              >
                <Token
                  idp={`kitpick-${k.id}`}
                  cx={TILE / 2}
                  cy={TILE / 2}
                  label="6"
                  side="us"
                  style={style({ ...kit, kitAlt: hint }, DEFAULT_US, k.id)}
                />
              </svg>
              <span
                className={`mt-0.5 block text-center text-[11px] font-bold ${
                  on ? 'text-ink' : 'text-ink-faint'
                }`}
              >
                {k.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function KitEditor({
  kit,
  onChange,
}: {
  kit: Kit
  onChange: (patch: Partial<Kit>) => void
}) {
  const us = style(kit, DEFAULT_US)
  const patterned = Boolean(kit.kitPattern) && kit.kitPattern !== 'solid'

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Swatch
          label="Your kit"
          note="The counter fill for your team. Labels switch between white and black on their own so they stay readable."
          value={kit.teamColour}
          fallback={DEFAULT_US.base}
          onChange={(hex) => onChange({ teamColour: hex })}
          onClear={() => onChange({ teamColour: '', kitRing: '', kitPattern: 'solid', kitAlt: '' })}
          clearLabel="Back to the house green"
        />

        <Swatch
          label="Trim"
          note="A thin ring outside the counter, for a kit that needs an outline to hold its edge on the grass."
          value={kit.kitRing}
          fallback={DEFAULT_US.text}
          onChange={(hex) => onChange({ kitRing: hex })}
          onClear={() => onChange({ kitRing: '' })}
          clearLabel="No trim"
        />
      </div>

      <div className="mt-6">
        <PatternPicker kit={kit} onChange={onChange} />
      </div>

      {/* Only once a pattern has been chosen. A second colour with nothing to
          paint is a control that does nothing, and a coach who presses it and
          sees no change learns that this page lies to them. */}
      {patterned && (
        <div className="mt-5">
          <Swatch
            label="Second colour"
            note="The stripe, the hoop, the far half, the sash."
            value={kit.kitAlt}
            fallback={DEFAULT_US.text}
            onChange={(hex) => onChange({ kitAlt: hex })}
            onClear={() => onChange({ kitAlt: '', kitPattern: 'solid' })}
            clearLabel="Back to a plain shirt"
          />
        </div>
      )}

      {/* Drawn with the board's own Token, on the board's own paper ground. */}
      <div className="mt-7 rounded-xl border border-ink-hair bg-paper p-4">
        <p className="text-micro uppercase text-ink-faint">On the board</p>
        <svg
          viewBox={`0 0 ${BOX.w} ${BOX.h}`}
          className="mt-3 w-full max-w-[260px]"
          role="img"
          aria-label="Your kit beside the opposition, as counters on the board"
        >
          <Token idp="kit-us" cx={BOX.w * 0.28} cy={BOX.h * 0.5} label="6" side="us" style={us} />
          <Token
            idp="kit-them"
            cx={BOX.w * 0.72}
            cy={BOX.h * 0.5}
            label="9"
            side="them"
            style={DEFAULT_THEM}
          />
        </svg>
        <p className="mt-2 text-[12px] leading-snug text-ink-faint">
          This is what a new system starts in. The opposition keeps the house colours — set a
          specific one on the system itself, where it belongs. Systems you have already made keep
          the kit they were built in.
        </p>
      </div>
    </div>
  )
}
