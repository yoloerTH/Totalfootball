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
 * The starters below were authored as files, for the promo films. The ones
 * marked `official` were not: they are the systems that went out as videos on
 * the Total Football channels, built in the studio on the account where the
 * films get made, and brought down here by `scripts/pull-system.mjs`.
 *
 * That is the only difference that matters to a coach, and it is worth a badge
 * because it is the strongest thing this page can say: the board you are about
 * to open is not a demo of the board, it is the actual document the video was
 * rendered from. `watch` is where they can go and check that claim.
 *
 * Marking one `official` is the whole registration: it decides which of the
 * grids the card lands in (Portal.tsx), and it is also what builds the public
 * `/o/<id>/` page and its sitemap entry (../pages/o/[slug].astro,
 * ../pages/sitemap.xml.ts). Nothing else has to be told.
 *
 * ── WHY EVERY ONE OF THEM DECLARES A `kind` ─────────────────────────────────
 *
 * Because a coach arrives wanting one of two different things, and until this
 * field existed the page made them read fifteen cards to find out which they
 * were holding. "How do I press a 2-3-5" and "what do I run on Tuesday with
 * eleven players and four mini goals" are not the same question, and a system
 * answers exactly one of them: a `match` document is eleven against eleven with
 * a tactical idea in it, a `drill` document is a session — cones, poles,
 * mannequins, mini goals, a ball supply and a coach standing next to it.
 *
 * It is on the starters too, not only the official ones, so the split is total.
 * A template that belonged to neither category would be a template nobody could
 * find, and the compiler now refuses to let one be added.
 */

import type { System } from './schema'

import beatingTheTwoManPress from '../../content/systems/beating-the-two-man-press.json'
import combinationPlayToFinish from '../../content/systems/combination-play-to-finish.json'
import crossingAndFinishing from '../../content/systems/crossing-and-finishing-from-both-sides.json'
import deZerbiBuildUp from '../../content/systems/de-zerbi-build-up.json'
import escapingPressingTrap from '../../content/systems/escaping-pressing-trap.json'
import finishingThroughMannequins from '../../content/systems/finishing-through-the-mannequins.json'
import overloadToIsolate from '../../content/systems/overload-to-isolate.json'
import playingAroundTheBlock from '../../content/systems/playing-around-the-block.json'
import the235BuildUp from '../../content/systems/the-2-3-5-build-up.json'
import theFalseNine from '../../content/systems/the-false-nine.json'
import theFourZoneRondo from '../../content/systems/the-four-zone-rondo.json'
import thePress4141 from '../../content/systems/the-4-1-4-1-press.json'
import theThirdManRun from '../../content/systems/the-third-man-run.json'
import theYPassingDrill from '../../content/systems/the-y-passing-drill-in-3-levels.json'
import whyTheLineStepsUp from '../../content/systems/why-the-line-steps-up.json'

/** Where a published system can be watched. Both, when it went out on both. */
export interface Watch {
  instagram?: string
  facebook?: string
}

/**
 * What a coach came here for.
 *
 * `match` — eleven against eleven, or a phase of it: a shape, a press, a way
 * out of one. Read at a desk, argued about, taken into a team meeting.
 *
 * `drill` — a session on the grass: a grid, a ball supply, gear, a coach. Read
 * on a phone at the side of a pitch, with players waiting.
 */
export type TemplateKind = 'match' | 'drill'

/** The label each kind wears on the portal, and the line under it. */
export const KIND_LABEL: Record<TemplateKind, { title: string; note: string }> = {
  match: {
    title: 'Match systems',
    note: 'Eleven against eleven: shape, press, and the way out of one.',
  },
  drill: {
    title: 'Training drills',
    note: 'Sessions on the grass: a grid, the gear, and where the balls start.',
  },
}

export interface Template {
  /** Permanent. It goes in a URL (`/studio/new/?t=<id>`), so it outlives titles. */
  id: string
  /**
   * Match system or training drill. See the note in the header: it is the first
   * cut a coach makes, so every template declares one and none may abstain.
   */
  kind: TemplateKind
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
   * Drives the badge and which of the grids it lands in. Absent rather than
   * `false` on the starters, so the honest reading of the list is "these are
   * published films", not "these five have been demoted".
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

/**
 * The channels themselves, for the systems that have no single post to point at.
 *
 * A drill filmed as part of a session goes out across a run of posts rather than
 * one reel, and there is no honest permalink for "the one this came from". The
 * profile is the honest answer instead: it is where the video is, along with
 * everything else we have shot on this board. A guessed reel URL that 404s would
 * cost more than the precision is worth.
 */
const CHANNELS: Watch = {
  instagram: 'https://www.instagram.com/total.fball/',
  facebook: 'https://www.facebook.com/profile.php?id=61590673460742',
}

export const TEMPLATES: Template[] = [
  {
    id: 'the-2-3-5-build-up',
    kind: 'match',
    teaches:
      'Two against two at the back, three against four in midfield. How pushing both full backs inside forces the front two to pick their poison.',
    official: true,
    watch: {
      instagram: 'https://www.instagram.com/reel/DcqJjyBIMo-/',
      facebook: 'https://www.facebook.com/share/r/1Bq3ccZYSP/',
    },
    system: doc(the235BuildUp),
  },
  {
    id: 'press-4141',
    kind: 'match',
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
    kind: 'match',
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
    id: 'de-zerbi-build-up',
    kind: 'match',
    teaches:
      'Standing on the ball until they come, then playing through the gap they left behind them. Sixteen phases of an invitation being accepted.',
    official: true,
    watch: CHANNELS,
    system: doc(deZerbiBuildUp),
  },
  {
    id: 'y-passing-drill',
    kind: 'drill',
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
    id: 'four-zone-rondo',
    kind: 'drill',
    teaches:
      'Seven against four in a 24 by 27 metre grid, one defender to a zone and a mini goal at either end. The rondo that has an end product attached to it.',
    official: true,
    watch: CHANNELS,
    system: doc(theFourZoneRondo),
  },
  {
    id: 'around-the-block',
    kind: 'drill',
    teaches:
      'Two lanes, three men blocking the far one, and the passes that do not work crossed out where they would have gone. The habit of looking for the way around rather than the way through.',
    official: true,
    watch: CHANNELS,
    system: doc(playingAroundTheBlock),
  },
  {
    id: 'combination-to-finish',
    kind: 'drill',
    teaches:
      'Pass, lay-off, run the gate, finish. Then the same pattern again from the right and from the left, so nobody rehearses it from one angle only.',
    official: true,
    watch: CHANNELS,
    system: doc(combinationPlayToFinish),
  },
  {
    id: 'cross-and-finish',
    kind: 'drill',
    teaches:
      'Round the pole, into the channel, ball in. Two runners attacking the near and far post, coached from both flanks at once so the queue never stands still.',
    official: true,
    watch: CHANNELS,
    system: doc(crossingAndFinishing),
  },
  {
    id: 'mannequin-finishing',
    kind: 'drill',
    teaches:
      'Six mannequins laid out as the shape you will face, two queues behind the cones, and a pattern that has to be run from either side of the box.',
    official: true,
    watch: CHANNELS,
    system: doc(finishingThroughMannequins),
  },
  {
    id: 'false-nine',
    kind: 'match',
    teaches: 'What a striker dropping off actually asks of a centre-half, and why following him is the wrong answer.',
    system: doc(theFalseNine),
  },
  {
    id: 'third-man',
    kind: 'match',
    teaches: 'The pass that is not for the man receiving it. Three players, one idea, and the run nobody tracks.',
    system: doc(theThirdManRun),
  },
  {
    id: 'overload-isolate',
    kind: 'match',
    teaches: 'Crowd one side of the pitch so the other one is empty, then switch it. The oldest trick there is.',
    system: doc(overloadToIsolate),
  },
  {
    id: 'two-man-press',
    kind: 'match',
    teaches: 'Two forwards, two centre-halves and a goalkeeper. How to play out when the numbers say you cannot.',
    system: doc(beatingTheTwoManPress),
  },
  {
    id: 'line-steps-up',
    kind: 'match',
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
