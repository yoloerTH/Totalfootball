/**
 * The training gear.
 *
 * Cones, hurdles, ladders, mannequins and the strength kit — the things a coach
 * lays out on a training ground, as opposed to the eleven people who then run
 * around them. A piece of gear is a MARK on a phase (see `GearMark` in
 * ./schema.ts): it belongs to one phase, it is copied when the phase is, and it
 * travels between phases on Play exactly like a player does.
 *
 * ── SIZE IS IN METRES, AND THE METRES ARE NOT LIFE SIZE ──────────────────────
 *
 * Everything on this board is measured in grass, so that a counter is the same
 * size on screen on all five pitch views (see ../board/pitch.ts). But a counter
 * is 4.2m across and a footballer is not, because a board drawn to true scale is
 * a board where you cannot see anybody. The same allowance is made here: a
 * marker cone is 1.8m wide rather than 0.2m, which is what puts it in the same
 * visual register as the players it is being laid out around. The rule is
 * consistency with the counter and the ball, not fidelity to a catalogue.
 *
 * `aspect` is the asset's own width ÷ height, from scripts/gear-assets.mjs,
 * which trims each source to its alpha bounds and prints the ratio — re-run it
 * after replacing an asset, or a cone will draw squashed. The other dimension
 * is given ONCE and the second falls out of the aspect, so the two can never
 * drift: `w` for a piece that lies on the grass, `h` for one that stands up.
 *
 * ── WHY A STANDING PIECE IS SIZED BY ITS HEIGHT ──────────────────────────────
 *
 * A mannequin's asset is 83 × 320 — an aspect of 0.26. Giving that piece a
 * width of 2m made it 7.7m TALL, a mannequin nearly twice as tall as a player
 * counter is wide, and the pole and the inflatable defender were the same
 * (user, 2026-08-27). The number a coach can reason about on a narrow object is
 * its height, not its width, so the three standing pieces declare `h` and let
 * the width follow. The scale to hold them to is the mini goal: 7m for a real
 * 3m goal, so about 2.3× life size, which puts a 1.8m mannequin at 4.2m.
 *
 * ── THE EXPORT CATCH ─────────────────────────────────────────────────────────
 *
 * Same one the match balls have, and it bites harder here because a drill can
 * put twenty of these on a phase. A canvas will not fetch `/studio/gear/*.png`
 * out of a serialised SVG and does not error when it fails — the gear simply
 * vanishes from the export. `inlineGear()` supplies `data:` URIs, and the
 * exporter must await it before serialising. See ../board/Board.tsx's header.
 */

export interface GearPiece {
  id: string
  /** How a coach would ask for it. */
  name: string
  /** Which drawer of the picker it lives in. */
  group: GearGroupId
  /** Width on the board at 1×, in metres. See the note above. */
  w: number
  /**
   * Height on the board at 1×, in metres, for a piece that STANDS UP.
   *
   * Optional and mutually exclusive with `w` in practice: when it is set it
   * wins and the width comes off the aspect. See the header.
   */
  h?: number
  /** The asset's own width ÷ height, from scripts/gear-assets.mjs. */
  aspect: number
  /** Board asset, 320px on its long edge. */
  src: string
  /** Picker asset, 96px. Small enough that a whole drawer costs nothing. */
  thumb: string
}

export type GearGroupId = 'markers' | 'agility' | 'targets' | 'balls' | 'strength'

/**
 * The drawers, in picker order.
 *
 * Ordered by how often a coach reaches for them rather than alphabetically:
 * cones and ladders are most of every session, the strength kit is the tail.
 */
export const GEAR_GROUPS: { id: GearGroupId; label: string }[] = [
  { id: 'markers', label: 'Cones and markers' },
  { id: 'agility', label: 'Hurdles and ladders' },
  { id: 'targets', label: 'Goals and mannequins' },
  { id: 'balls', label: 'Balls' },
  { id: 'strength', label: 'Strength and balance' },
]

const asset = (id: string) => ({
  src: `/studio/gear/${id}.png`,
  thumb: `/studio/gear/thumb/${id}.webp`,
})

/**
 * A match ball, borrowed into the gear catalogue.
 *
 * The SAME files ../balls.ts serves — trimmed to the ball's alpha bounds and
 * padded back to a square, which is why they are all `aspect: 1`. Pointing at
 * the originals rather than copying them into `gear/` is the point: replace
 * a ball once and it changes in the picker, on the grass and in every export.
 */
const ball = (id: string) => ({
  src: `/studio/balls/${id}.png`,
  thumb: `/studio/balls/thumb/${id}.webp`,
})

export const GEAR: GearPiece[] = [
  // ── markers ──────────────────────────────────────────────────────────────
  { id: 'marker-cone', name: 'Marker cone', group: 'markers', w: 1.8, aspect: 0.975, ...asset('marker-cone') },
  { id: 'traffic-cone', name: 'Traffic cone', group: 'markers', w: 2.2, aspect: 0.801, ...asset('traffic-cone') },

  // ── agility ──────────────────────────────────────────────────────────────
  { id: 'hurdle-orange', name: 'Mini hurdle', group: 'agility', w: 3.2, aspect: 1.619, ...asset('hurdle-orange') },
  { id: 'hurdle-yellow', name: 'Mini hurdle, yellow', group: 'agility', w: 3.2, aspect: 1.803, ...asset('hurdle-yellow') },
  { id: 'hurdle-tall', name: 'Agility hurdle', group: 'agility', w: 4, aspect: 1.483, ...asset('hurdle-tall') },
  { id: 'ladder', name: 'Agility ladder', group: 'agility', w: 10, aspect: 3.789, ...asset('ladder') },

  // ── targets ──────────────────────────────────────────────────────────────
  { id: 'mini-goal', name: 'Mini goal', group: 'targets', w: 7, aspect: 2.663, ...asset('mini-goal') },
  // The three that stand up. Sized by HEIGHT — see the header for why, and
  // for the mini goal above them, which is the scale they are held to.
  { id: 'dummy-mannequin', name: 'Mannequin', group: 'targets', w: 0, h: 4.2, aspect: 0.26, ...asset('dummy-mannequin') },
  { id: 'dummy-inflatable', name: 'Inflatable defender', group: 'targets', w: 0, h: 4.3, aspect: 0.278, ...asset('dummy-inflatable') },
  { id: 'pole', name: 'Training pole', group: 'targets', w: 0, h: 4, aspect: 0.262, ...asset('pole') },

  // ── balls ────────────────────────────────────────────────────────────────
  //
  // ONE VOCABULARY OF BALLS, not two. The drawer used to be called "Loose
  // balls" and held two anonymous ones, while the five photographed match balls
  // lived in a picker of their own — which meant a coach who wanted a Trionda
  // lying on the grass beside the Trionda being passed could not have one
  // (user, 2026-08-27). A ball is a ball; every one of them is here.
  //
  // What the MATCH ball still is: the single object per system that the move is
  // about, the one that travels along the passes, chosen in the panel above.
  // These are balls a coach PUTS somewhere — spares in a rondo, a rack beside a
  // finishing station — and there can be as many of them as the drill needs.
  // Every one takes the size and turn controls, like any other piece of gear.
  { id: 'ball-trionda', name: 'Trionda', group: 'balls', w: 2.4, aspect: 1, ...ball('trionda') },
  { id: 'ball-al-rihla', name: 'Al Rihla', group: 'balls', w: 2.4, aspect: 1, ...ball('al-rihla') },
  { id: 'ball-brazuca', name: 'Brazuca', group: 'balls', w: 2.4, aspect: 1, ...ball('brazuca') },
  { id: 'ball-jabulani', name: 'Jabulani', group: 'balls', w: 2.4, aspect: 1, ...ball('jabulani') },
  { id: 'ball-telstar', name: 'Telstar', group: 'balls', w: 2.4, aspect: 1, ...ball('telstar') },
  { id: 'ball-spare', name: 'Spare ball', group: 'balls', w: 2.4, aspect: 1.001, ...asset('ball-spare') },
  { id: 'ball-training', name: 'Training ball', group: 'balls', w: 2.4, aspect: 1.004, ...asset('ball-training') },

  // ── strength ─────────────────────────────────────────────────────────────
  { id: 'bosu', name: 'Bosu ball', group: 'strength', w: 3, aspect: 1, ...asset('bosu') },
  { id: 'balance-disk-blue', name: 'Balance disk', group: 'strength', w: 2.6, aspect: 1.032, ...asset('balance-disk-blue') },
  { id: 'balance-disk-yellow', name: 'Balance disk, yellow', group: 'strength', w: 2.6, aspect: 0.963, ...asset('balance-disk-yellow') },
  { id: 'balance-pad', name: 'Balance pad', group: 'strength', w: 3.2, aspect: 1.749, ...asset('balance-pad') },
  { id: 'foam-roller', name: 'Foam roller', group: 'strength', w: 2.8, aspect: 1.533, ...asset('foam-roller') },
  { id: 'dumbbell', name: 'Dumbbell', group: 'strength', w: 2.4, aspect: 1.924, ...asset('dumbbell') },
  { id: 'bands', name: 'Resistance bands', group: 'strength', w: 2.8, aspect: 1.147, ...asset('bands') },
]

export const GEAR_BY_ID = new Map(GEAR.map((g) => [g.id, g]))

/**
 * The fallback for a piece we have since dropped.
 *
 * A stored document may name gear this build does not have — an older link, or
 * an asset retired between releases. Returning null lets the board skip it
 * silently, which is the right answer: a missing cone is not worth breaking a
 * whole system over, and drawing a question mark on the grass would be worse
 * than drawing nothing.
 */
export function resolveGear(kind: string): GearPiece | null {
  return GEAR_BY_ID.get(kind) ?? null
}

/**
 * How wide and tall a placed piece draws, in metres, at its own scale.
 *
 * Whichever dimension the piece declares is the one multiplied; the other is
 * derived from the aspect, so a piece can never be given two numbers that
 * disagree with its own artwork.
 */
export function gearSize(piece: GearPiece, size?: number): { w: number; h: number } {
  const s = size && size > 0 ? size : 1
  if (piece.h) {
    const h = piece.h * s
    return { w: h * piece.aspect, h }
  }
  const w = piece.w * s
  return { w, h: w / piece.aspect }
}

/** What the size slider is allowed to do. A cone at 3× is still a cone. */
export const GEAR_SIZE_MIN = 0.4
export const GEAR_SIZE_MAX = 3

/**
 * Fetch the gear on a system and return `data:` URIs, keyed by piece id.
 *
 * Cached across calls, because a deck exports every phase and a drill uses the
 * same six cones on all of them — re-fetching per slide is the difference
 * between an export that feels instant and one that feels broken. Mirrors
 * `inlineBall` in ./balls.ts, including the failure rule: a piece that will not
 * load is left out of the map and the board draws without it, rather than the
 * whole export failing over one asset.
 */
const inlined = new Map<string, string | null>()

export async function inlineGear(kinds: string[]): Promise<Record<string, string>> {
  const want = [...new Set(kinds)].filter((k) => GEAR_BY_ID.has(k))
  await Promise.all(
    want
      .filter((k) => !inlined.has(k))
      .map(async (k) => {
        try {
          const res = await fetch(GEAR_BY_ID.get(k)!.src)
          if (!res.ok) throw new Error(String(res.status))
          const blob = await res.blob()
          const uri = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader()
            fr.onload = () => resolve(String(fr.result))
            fr.onerror = () => reject(fr.error)
            fr.readAsDataURL(blob)
          })
          inlined.set(k, uri)
        } catch {
          inlined.set(k, null)
        }
      }),
  )
  const out: Record<string, string> = {}
  for (const k of want) {
    const uri = inlined.get(k)
    if (uri) out[k] = uri
  }
  return out
}

/** Every gear kind used anywhere in a system, for the exporter to inline. */
export function gearKinds(system: { acts: { gear?: { kind: string }[] }[] }): string[] {
  return [...new Set(system.acts.flatMap((a) => (a.gear ?? []).map((g) => g.kind)))]
}
