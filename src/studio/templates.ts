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
 * WHY THESE FIVE AND NOT THE 123 PUBLISHED SHORTS
 *
 * A library system's phases are PNGs rendered out of Remotion, and a picture of
 * a board is not a board: the token positions that would have to be recovered
 * from them are not in them. Adapting all 123 by hand was the alternative, and
 * each short defines its own local pitch and coordinate helpers, so it is 123
 * separate readings rather than one loop.
 *
 * These five needed none of that, because they are already studio documents.
 * They were authored for the promo films and they live in content/systems/, and
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
 */

import type { System } from './schema'

import beatingTheTwoManPress from '../../content/systems/beating-the-two-man-press.json'
import overloadToIsolate from '../../content/systems/overload-to-isolate.json'
import theFalseNine from '../../content/systems/the-false-nine.json'
import theThirdManRun from '../../content/systems/the-third-man-run.json'
import whyTheLineStepsUp from '../../content/systems/why-the-line-steps-up.json'

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
  system: System
}

/**
 * The documents, typed on the way in.
 *
 * A JSON import widens `v: 1` to `number` and every union down the document to
 * its base type, so the compiler cannot see these as `System` on its own. They
 * are checked by something better than a cast, though: all five are rendered
 * end to end by scripts/render-video.mjs, and a malformed one fails there long
 * before it reaches a coach.
 */
const doc = (json: unknown): System => json as System

export const TEMPLATES: Template[] = [
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
