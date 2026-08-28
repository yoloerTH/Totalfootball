/**
 * Systems of ours a coach can open, edit and make their own.
 *
 * WHY THIS EXISTS
 *
 * Two screens have been promising it for a while. `/studio/` says "Or start
 * from one of ours — open one, see how it is put together, and make it your
 * own", and the portal's empty state says the second door is a finished system,
 * "because starting from a finished one is how most people learn a tool they
 * did not ask for". Both then linked to `/library/`, which is an article. This
 * is the door those two sentences were describing.
 *
 * WHY THESE AND NOT THE 123 PUBLISHED SHORTS
 *
 * A library system's phases are PNGs rendered out of Remotion, and a picture of
 * a board is not a board: the token positions that would have to be recovered
 * from them are not in them. Adapting all 123 by hand was the alternative, and
 * each short defines its own local pitch and coordinate helpers, so it is 123
 * separate readings rather than one loop.
 *
 * These needed none of that, because they are already studio documents. They
 * were authored for the promo films, or built in the studio and pulled down by
 * scripts/pull-system.mjs, and they live in content/systems/ — and
 * `scripts/render-video.mjs` and `scripts/shoot-studio.mjs` have been rendering
 * them for weeks — which means every one of them is known to open, pose, tween
 * and export. A worked example that has never been opened is a liability; these
 * have been through the whole pipeline already.
 *
 * WHICH IS ALSO WHY THE DOCUMENTS ARE IMPORTED AND NOT COPIED
 *
 * One file per system, read by the scripts and by this registry alike. A copy
 * under src/ would be a second version to fix, and the first time somebody
 * improved a phase for the film the coach's example would quietly be the old
 * one. The metadata below is the only thing added here, because "what does this
 * teach me" is a question the document has no field for and should not.
 *
 * THE RULE ABOUT WHAT A COACH GETS
 *
 * An opened template is THEIRS. It takes a new system id, and `fromTemplate`
 * strips the two fields that would otherwise make it ours: the credit line, and
 * `shareId`. The second one is not cosmetic — a document carrying our share id
 * would let a coach's edits publish over the link we sent, from the Share
 * button, without anybody doing anything wrong.
 *
 * ── THE OFFICIAL ONES ───────────────────────────────────────────────────────
 *
 * The five starters below were authored as files, for the promo films. The ones
 * marked `official` were not: they are the systems that went out as videos on
 * the Total Football channels, built in the studio on the account where the
 * films get made, and brought down here by `scripts/pull-system.mjs`.
 *
 * That is the only difference that matters to a coach, and it is worth a badge
 * because it is the strongest thing this page can say: the board you are about
 * to open is not a demo of the board, it is the actual document the video was
 * rendered from. `watch` is where they can go and check that claim.
 *
 * Marking one `official` is the whole registration: it decides which of the two
 * grids the card lands in (Portal.tsx), and it is also what builds the public
 * `/o/<id>/` page and its sitemap entry (../pages/o/[slug].astro,
 * ../pages/sitemap.xml.ts). Nothing else has to be told.
 *
 * THEY ARE TALLER THAN WIDE, which is the constraint the portal's layout is
 * built round. A board must be given a container of its own `aspect(view)` or
 * it renders through the letterbox (Board.tsx), and the five starters are
 * landscape — `full` is 1.49 wide to 1 tall against 0.67 for the upright views
 * the films are shot in, which is a 520px card beside a 230px one. So the
 * official ones cannot share a grid with the starters. See the note on the two
 * grids in Portal.tsx.
 *
 * They are not all the SAME portrait, and that is fine rather than sloppy: the
 * two films are `full-vertical` (0.67) and the Y drill is `defending-half`
 * (0.80), which is about 90px of board height apart on a 380px card. The card
 * lets the `teaches` line take up the slack — it is `flex-1` — so the phase
 * count and the call to action still line up across the row. A THIRD aspect in
 * that grid is the point at which to stop and lay it out properly.
 */

import type { System } from './schema'

import beatingTheTwoManPress from '../../content/systems/beating-the-two-man-press.json'
import escapingPressingTrap from '../../content/systems/escaping-pressing-trap.json'
import overloadToIsolate from '../../content/systems/overload-to-isolate.json'
import theFalseNine from '../../content/systems/the-false-nine.json'
import thePress4141 from '../../content/systems/the-4-1-4-1-press.json'
import theThirdManRun from '../../content/systems/the-third-man-run.json'
import theYPassingDrill from '../../content/systems/the-y-passing-drill-in-3-levels.json'
import whyTheLineStepsUp from '../../content/systems/why-the-line-steps-up.json'

/** Where a published system can be watched. Both, when it went out on both. */
export interface Watch {
  instagram?: string
  facebook?: string
}

export interface Template {
  /** Permanent. It goes in a URL (`/studio/new/?t=<id>`), so it outlives titles. */
  id: string
  /**
   * What a coach gets out of opening this one, in their language.
   *
   * Not a summary of the system — the title and the phase captions already do
   * that, and they do it better. This answers the only question being asked at
   * the moment somebody is looking at five cards: which of these is worth my
   * next ten minutes.
   */
  teaches: string
  /**
   * This one went out as a Total Football video.
   *
   * Drives the badge and which of the two grids it lands in. Absent rather than
   * `false` on the other five, so the honest reading of the list is "these two
   * are published films", not "these five have been demoted".
   */
  official?: boolean
  /** Set only on official ones, and only for the platforms it actually went out on. */
  watch?: Watch
  system: System
}

/**
 * The documents, typed on the way in.
 *
 * A JSON import widens `v: 1` to `number` and every union down the document to
 * its base type, so the compiler cannot see these as `System` on its own. They
 * are checked by something better than a cast, though: every one of them is
 * rendered end to end by scripts/render-video.mjs, and a malformed one fails
 * there long before it reaches a coach.
 */
const doc = (json: unknown): System => json as System

export const TEMPLATES: Template[] = [
  {
    id: 'y-passing-drill',
    teaches:
      'A five-player passing pattern in cones, poles and mini-goals, built three times over: beginner, intermediate, professional. The same Y, asking more of them each level.',
    official: true,
    watch: {
      instagram: 'https://www.instagram.com/reel/DckJuXBoNtp/',
      facebook: 'https://www.facebook.com/reel/1376067451381072',
    },
    system: doc(theYPassingDrill),
  },
  {
    id: 'press-4141',
    teaches:
      'One anchor holds, the four in front of him jump together, and the lane shuts. Eighteen phases of a trap being set and sprung.',
    official: true,
    watch: {
      instagram: 'https://www.instagram.com/reel/Dca_9RZNOr0/',
      facebook: 'https://www.facebook.com/reel/933841605791735',
    },
    system: doc(thePress4141),
  },
  {
    id: 'escaping-the-trap',
    teaches:
      'Pinned on the touchline with no pass on. Where the empty space actually is, and what has to happen before you can reach it.',
    official: true,
    watch: {
      instagram: 'https://www.instagram.com/reel/DcdWo4mN4yE/',
      facebook: 'https://www.facebook.com/reel/2025942812141766',
    },
    system: doc(escapingPressingTrap),
  },
  {
    id: 'false-nine',
    teaches: 'What a striker dropping off actually asks of a centre-half, and why following him is the wrong answer.',
    system: doc(theFalseNine),
  },
  {
    id: 'third-man',
    teaches: 'The pass that is not for the man receiving it. Three players, one idea, and the run nobody tracks.',
    system: doc(theThirdManRun),
  },
  {
    id: 'overload-isolate',
    teaches: 'Crowd one side of the pitch so the other one is empty, then switch it. The oldest trick there is.',
    system: doc(overloadToIsolate),
  },
  {
    id: 'two-man-press',
    teaches: 'Two forwards, two centre-halves and a goalkeeper. How to play out when the numbers say you cannot.',
    system: doc(beatingTheTwoManPress),
  },
  {
    id: 'line-steps-up',
    teaches: 'Why a defence steps forward at the moment it looks most dangerous to, and what it costs when one man does not.',
    system: doc(whyTheLineStepsUp),
  },
]

export function templateById(id: string | null | undefined): Template | null {
  if (!id) return null
  return TEMPLATES.find((t) => t.id === id) ?? null
}

/**
 * A coach's own copy of one of ours.
 *
 * Cloned, because a template is a module-level object shared by every card on
 * the portal: editing it in place would change the thumbnail behind the coach
 * and hand the next open a half-edited system. `structuredClone` rather than a
 * spread — the acts, the tokens and the marks are all nested, and a shallow
 * copy leaves the coach dragging our players around.
 *
 * The title is kept. It is a real system with a real name, and blanking it
 * would make the first thing a coach sees a document called nothing.
 */
export function fromTemplate(t: Template): System {
  const { credit: _credit, shareId: _shareId, ...rest } = structuredClone(t.system)
  return rest
}
