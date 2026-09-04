/**
 * The five things a coach can say about somebody else's system.
 *
 * ── WHY NOT A LIKE ───────────────────────────────────────────────────────────
 *
 * A like is a shrug, and docs/SOCIAL.md §0a judges every mechanic by whether it
 * raises the quality of what gets posted. A single undifferentiated tap tells
 * the person who spent an evening on a pressing structure nothing at all — not
 * whether the idea landed, whether the shape held up, or whether anybody would
 * actually run it. Five specific sentences tell them which of those it was.
 *
 * ── AND WHY THESE FIVE ───────────────────────────────────────────────────────
 *
 * Each one is a different reason a coach would stop scrolling, and between them
 * they cover what a system can be good at: the idea, the thinking, the defence,
 * the one incisive detail, and the highest compliment in the building — I am
 * running this on Tuesday.
 *
 * `training_ground` IS WORTH TWO IN THE RANKING. Everything else here is an
 * opinion; that one is a commitment, and it is the only reaction that predicts
 * whether a system was any use to anybody. The weight is duplicated in
 * `studio_reaction_weight` in supabase/025 — the database is what actually
 * counts, and this copy exists so the UI can explain itself.
 *
 * IDS ARE THE CONTRACT with the CHECK in supabase/025. Change one, change both:
 * a kind this file knows about and the database does not is a button that
 * answers 23514.
 */

export interface Reaction {
  id: string
  /** Drawn on the button. Emoji, because a coach reads one at a glance. */
  glyph: string
  /** On the button beside the glyph, and in the count line. */
  label: string
  /** The tooltip. What the coach is actually saying by pressing it. */
  meaning: string
  /** Mirrors `studio_reaction_weight`. Display never uses it; ranking does. */
  weight: number
}

export const REACTIONS: Reaction[] = [
  {
    id: 'golazo',
    glyph: '⚽',
    label: 'Golazo',
    meaning: 'The idea itself is brilliant.',
    weight: 1,
  },
  {
    id: 'masterclass',
    glyph: '🧠',
    label: 'Masterclass',
    meaning: 'The thinking behind it is what makes it work.',
    weight: 1,
  },
  {
    id: 'clean_sheet',
    glyph: '🧤',
    label: 'Clean sheet',
    meaning: 'It holds up. The rest defence is honest.',
    weight: 1,
  },
  {
    id: 'killer_ball',
    glyph: '🎯',
    label: 'Killer ball',
    meaning: 'One detail in here is the whole thing.',
    weight: 1,
  },
  {
    id: 'training_ground',
    glyph: '📋',
    label: 'Taking it to training',
    meaning: 'I am running this with my own group.',
    weight: 2,
  },
]

export const REACTION_BY_ID = new Map(REACTIONS.map((r) => [r.id, r]))

export function reactionGlyph(id: string | null | undefined): string {
  return (id && REACTION_BY_ID.get(id)?.glyph) || ''
}

export function reactionLabel(id: string | null | undefined): string {
  return (id && REACTION_BY_ID.get(id)?.label) || ''
}
