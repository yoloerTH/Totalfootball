/**
 * The match balls.
 *
 * These are the same photographed balls the videos composite onto the board
 * (editor/public/*.png, referenced from TacticsBoard's `Ball` and from about
 * thirty shorts). Trionda is the house default because it is what nearly every
 * recent tactics short uses; the rest are there because a coach explaining a
 * 2010 World Cup goal should be able to put the 2010 ball on the pitch.
 *
 * They are trimmed to the ball's own alpha bounds and padded back to a square,
 * so every one of them draws at the same diameter no matter how the original
 * photograph was cropped. Do not replace one with an untrimmed file — an
 * off-centre source makes the ball sit beside the position the coach dropped
 * it on, which reads as a bug in the drag rather than a bug in the asset.
 *
 * WHERE THEY LIVE. `public/studio/balls/` today, a Supabase storage bucket when
 * we go live. Only `src` changes when that happens, and it is the one field
 * every consumer already goes through.
 *
 * ── THE EXPORT CATCH, READ BEFORE BUILDING EXPORT ─────────────────────────────
 *
 * Board.tsx's contract used to be "no <image href>", because export is
 * `serialise the SVG → <img> → canvas → PNG` and a canvas will not fetch an
 * external URL out of a serialised SVG: the ball would silently vanish from
 * every exported slide. That constraint has NOT been repealed — it has been
 * paid for. The exporter must call `inlineBall()` and substitute a `data:` URI
 * before serialising. `BALL_BYTES` is roughly what that costs per slide.
 */

/** `null` src = the drawn vector ball, which needs no asset and always exports. */
export type BallId = 'trionda' | 'al-rihla' | 'brazuca' | 'jabulani' | 'telstar' | 'classic'

export interface MatchBall {
  id: BallId
  /** How a coach would ask for it. */
  name: string
  /** One line of provenance, shown under the picker. */
  story: string
  /** Public path, or null for the vector ball. */
  src: string | null
}

/** In picker order. Trionda first: it is the house default. */
export const BALLS: MatchBall[] = [
  {
    id: 'trionda',
    name: 'Trionda',
    story: 'World Cup 2026. What most of our tactics shorts use.',
    src: '/studio/balls/trionda.png',
  },
  {
    id: 'al-rihla',
    name: 'Al Rihla',
    story: 'World Cup 2022, Qatar.',
    src: '/studio/balls/al-rihla.png',
  },
  {
    id: 'brazuca',
    name: 'Brazuca',
    story: 'World Cup 2014, Brazil.',
    src: '/studio/balls/brazuca.png',
  },
  {
    id: 'jabulani',
    name: 'Jabulani',
    story: 'World Cup 2010, South Africa. The one nobody could strike.',
    src: '/studio/balls/jabulani.png',
  },
  {
    id: 'telstar',
    name: 'Telstar',
    story: 'World Cup 1974. The Total Football one.',
    src: '/studio/balls/telstar.png',
  },
  {
    id: 'classic',
    name: 'Plain',
    story: 'Drawn, not photographed. Prints small and stays sharp at any size.',
    src: null,
  },
]

export const BALL_BY_ID = new Map(BALLS.map((b) => [b.id, b]))

export const DEFAULT_BALL: BallId = 'trionda'

/** Coerce a stored id — including one we have since dropped — to a real ball. */
export function resolveBall(id: string | undefined): MatchBall {
  return BALL_BY_ID.get((id ?? DEFAULT_BALL) as BallId) ?? BALL_BY_ID.get(DEFAULT_BALL)!
}

/**
 * Fetch a ball and return it as a `data:` URI, for the exporter.
 *
 * Cached, because a deck exports every slide and re-fetching the same 110KB PNG
 * per act is the difference between an export that feels instant and one that
 * feels broken. Returns null if the fetch fails, so a flaky asset costs the
 * ball rather than the whole export — the caller should fall back to the vector
 * ball rather than emitting a broken <image>.
 */
const inlined = new Map<BallId, string | null>()

export async function inlineBall(id: BallId): Promise<string | null> {
  const cached = inlined.get(id)
  if (cached !== undefined) return cached
  const ball = resolveBall(id)
  if (!ball.src) {
    inlined.set(id, null)
    return null
  }
  try {
    const res = await fetch(ball.src)
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const uri = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error)
      fr.readAsDataURL(blob)
    })
    inlined.set(id, uri)
    return uri
  } catch {
    inlined.set(id, null)
    return null
  }
}

/** Roughly what inlining one costs a slide, so the export budget is not a surprise. */
export const BALL_BYTES = 150_000
