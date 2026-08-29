/**
 * The formation library.
 *
 * A formation is NOT stored in board percentages, and the reason is worth
 * stating because it is the thing that would otherwise break the moment a
 * coach changes pitch view.
 *
 * Board percentages are percentages of the VISIBLE CROP (see ./board/pitch.ts).
 * A 4-3-3 written as crop percentages for the full pitch would be nonsense on
 * the attacking half: the back four would end up on the halfway line. So a
 * formation is stored in the only space that is actually view-independent —
 * the team's own shape:
 *
 *   depth  0 = own goal line, 1 = the team's furthest line forward
 *   width  0 = the team's LEFT flank, 1 = their RIGHT flank
 *
 * `place()` maps that into the current view, for the right side of the ball,
 * facing the right way. A team's left flank is the top of the screen when they
 * attack right and the bottom when they attack left, which is the sort of
 * detail that looks like a bug when it is wrong and is invisible when it is
 * right.
 */

import { PITCH, PITCH_VIEWS, areaBand, resolveViewId, type PitchViewId } from './board/pitch'
import type { Side, Token } from './schema'

export interface Slot {
  /** Stable token id. This is what makes act→act tweening work — see schema.ts. */
  id: string
  /** Position abbreviation, printed on the counter by default. */
  pos: string
  /** Conventional shirt number, for coaches who label by number. */
  num: number
  /** Role name, shown in the inspector rather than on the board. */
  role: string
  depth: number
  width: number
}

export interface Formation {
  id: string
  /** How a coach says it. */
  name: string
  /** Grouping in the picker. */
  family: string
  /** One line on what it is for. Written for a coach, not for search. */
  hint: string
  /**
   * True for the empty squad: eleven counters with no shape, parked on the
   * touchline to be dragged on. The editor treats it differently — there is no
   * shape to re-place them into, and telling a coach their arrangement is
   * "wrong" against a formation they never picked would be nonsense.
   */
  blank?: true
  slots: Slot[]
}

/** Terser than eleven object literals per formation. */
const s = (id: string, pos: string, num: number, role: string, depth: number, width: number): Slot => ({
  id,
  pos,
  num,
  role,
  depth,
  width,
})

/** The flat back four every four-at-the-back shape shares. */
const BACK_FOUR: Slot[] = [
  s('GK', 'GK', 1, 'Goalkeeper', 0.03, 0.5),
  s('LB', 'LB', 3, 'Left-back', 0.21, 0.11),
  s('LCB', 'CB', 6, 'Left centre-back', 0.15, 0.36),
  s('RCB', 'CB', 5, 'Right centre-back', 0.15, 0.64),
  s('RB', 'RB', 2, 'Right-back', 0.21, 0.89),
]

/** The back three, shared by the 3- and 5-at-the-back families. */
const BACK_THREE: Slot[] = [
  s('GK', 'GK', 1, 'Goalkeeper', 0.03, 0.5),
  s('LCB', 'CB', 6, 'Left centre-back', 0.17, 0.26),
  s('CB', 'CB', 5, 'Central centre-back', 0.13, 0.5),
  s('RCB', 'CB', 4, 'Right centre-back', 0.17, 0.74),
]

export const FORMATIONS: Formation[] = [
  {
    id: '4-4-2',
    name: '4-4-2',
    family: 'Four at the back',
    hint: 'Two banks of four. The reference point every other shape is described against.',
    slots: [
      ...BACK_FOUR,
      s('LM', 'LM', 11, 'Left midfield', 0.48, 0.11),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.44, 0.38),
      s('RCM', 'CM', 4, 'Right centre-mid', 0.44, 0.62),
      s('RM', 'RM', 7, 'Right midfield', 0.48, 0.89),
      s('LST', 'ST', 10, 'Left striker', 0.79, 0.4),
      s('RST', 'ST', 9, 'Right striker', 0.79, 0.6),
    ],
  },
  {
    id: '4-4-2-diamond',
    name: '4-4-2 diamond',
    family: 'Four at the back',
    hint: 'A 6, two 8s and a 10. Owns the middle, concedes the flanks.',
    slots: [
      ...BACK_FOUR,
      s('CDM', 'DM', 4, 'Holding midfielder', 0.35, 0.5),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.5, 0.25),
      s('RCM', 'CM', 7, 'Right centre-mid', 0.5, 0.75),
      s('CAM', 'AM', 10, 'Attacking midfielder', 0.64, 0.5),
      s('LST', 'ST', 11, 'Left striker', 0.82, 0.4),
      s('RST', 'ST', 9, 'Right striker', 0.82, 0.6),
    ],
  },
  {
    id: '4-3-3',
    name: '4-3-3',
    family: 'Four at the back',
    hint: 'One holder, two 8s, a front three holding the width.',
    slots: [
      ...BACK_FOUR,
      s('CDM', 'DM', 4, 'Holding midfielder', 0.38, 0.5),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.52, 0.32),
      s('RCM', 'CM', 10, 'Right centre-mid', 0.52, 0.68),
      s('LW', 'LW', 11, 'Left winger', 0.82, 0.09),
      s('ST', 'ST', 9, 'Striker', 0.88, 0.5),
      s('RW', 'RW', 7, 'Right winger', 0.82, 0.91),
    ],
  },
  {
    id: '4-3-3-pivot',
    name: '4-3-3 double pivot',
    family: 'Four at the back',
    hint: 'Two sitting, one 10. Safer in build-up, slower to arrive in the box.',
    slots: [
      ...BACK_FOUR,
      s('LDM', 'DM', 6, 'Left holding mid', 0.36, 0.38),
      s('RDM', 'DM', 4, 'Right holding mid', 0.36, 0.62),
      s('CAM', 'AM', 10, 'Attacking midfielder', 0.62, 0.5),
      s('LW', 'LW', 11, 'Left winger', 0.82, 0.09),
      s('ST', 'ST', 9, 'Striker', 0.88, 0.5),
      s('RW', 'RW', 7, 'Right winger', 0.82, 0.91),
    ],
  },
  {
    id: '4-3-3-false-9',
    name: '4-3-3 false 9',
    family: 'Four at the back',
    hint: 'The 9 drops between the lines and the wingers attack the space behind.',
    slots: [
      ...BACK_FOUR,
      s('CDM', 'DM', 4, 'Holding midfielder', 0.38, 0.5),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.54, 0.32),
      s('RCM', 'CM', 10, 'Right centre-mid', 0.54, 0.68),
      s('LW', 'LW', 11, 'Left winger', 0.9, 0.13),
      s('ST', 'F9', 9, 'False nine', 0.72, 0.5),
      s('RW', 'RW', 7, 'Right winger', 0.9, 0.87),
    ],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    family: 'Four at the back',
    hint: 'The modern default. A protected back four and a 10 in the pocket.',
    slots: [
      ...BACK_FOUR,
      s('LDM', 'DM', 6, 'Left holding mid', 0.37, 0.38),
      s('RDM', 'DM', 4, 'Right holding mid', 0.37, 0.62),
      s('LAM', 'LW', 11, 'Left attacking mid', 0.62, 0.13),
      s('CAM', 'AM', 10, 'Attacking midfielder', 0.64, 0.5),
      s('RAM', 'RW', 7, 'Right attacking mid', 0.62, 0.87),
      s('ST', 'ST', 9, 'Striker', 0.87, 0.5),
    ],
  },
  {
    id: '4-1-4-1',
    name: '4-1-4-1',
    family: 'Four at the back',
    hint: 'A mid-block shape: a screen in front of the four and a bank of four ahead.',
    slots: [
      ...BACK_FOUR,
      s('CDM', 'DM', 6, 'Holding midfielder', 0.36, 0.5),
      s('LM', 'LM', 11, 'Left midfield', 0.58, 0.1),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.54, 0.36),
      s('RCM', 'CM', 10, 'Right centre-mid', 0.54, 0.64),
      s('RM', 'RM', 7, 'Right midfield', 0.58, 0.9),
      s('ST', 'ST', 9, 'Striker', 0.86, 0.5),
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    family: 'Three at the back',
    hint: 'Wing-backs supply all the width. Overloads the middle, exposes the flanks in transition.',
    slots: [
      ...BACK_THREE,
      s('LWB', 'WB', 3, 'Left wing-back', 0.46, 0.05),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.45, 0.32),
      s('CM', 'CM', 6, 'Centre-mid', 0.4, 0.5),
      s('RCM', 'CM', 10, 'Right centre-mid', 0.45, 0.68),
      s('RWB', 'WB', 2, 'Right wing-back', 0.46, 0.95),
      s('LST', 'ST', 11, 'Left striker', 0.82, 0.4),
      s('RST', 'ST', 9, 'Right striker', 0.82, 0.6),
    ],
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    family: 'Three at the back',
    hint: 'A front three plus wing-backs. Five attacking lanes as soon as you win it.',
    slots: [
      ...BACK_THREE,
      s('LWB', 'WB', 3, 'Left wing-back', 0.48, 0.05),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.44, 0.38),
      s('RCM', 'CM', 6, 'Right centre-mid', 0.44, 0.62),
      s('RWB', 'WB', 2, 'Right wing-back', 0.48, 0.95),
      s('LW', 'LW', 11, 'Left winger', 0.82, 0.13),
      s('ST', 'ST', 9, 'Striker', 0.87, 0.5),
      s('RW', 'RW', 7, 'Right winger', 0.82, 0.87),
    ],
  },
  {
    id: '3-2-4-1',
    name: '3-2-4-1 (box)',
    family: 'Three at the back',
    hint: 'The possession shape: a back three, a double pivot, and a box of four ahead.',
    slots: [
      ...BACK_THREE,
      s('LDM', 'DM', 8, 'Left pivot', 0.4, 0.38),
      s('RDM', 'DM', 6, 'Right pivot', 0.4, 0.62),
      s('LW', 'LW', 11, 'Left winger', 0.68, 0.06),
      s('LAM', 'AM', 10, 'Left attacking mid', 0.7, 0.36),
      s('RAM', 'AM', 7, 'Right attacking mid', 0.7, 0.64),
      s('RW', 'RW', 2, 'Right winger', 0.68, 0.94),
      s('ST', 'ST', 9, 'Striker', 0.9, 0.5),
    ],
  },
  {
    id: '5-3-2',
    name: '5-3-2',
    family: 'Five at the back',
    hint: 'A low block that keeps two up. The wing-backs drop into a five without the ball.',
    slots: [
      s('GK', 'GK', 1, 'Goalkeeper', 0.03, 0.5),
      s('LWB', 'WB', 3, 'Left wing-back', 0.22, 0.07),
      s('LCB', 'CB', 6, 'Left centre-back', 0.14, 0.28),
      s('CB', 'CB', 5, 'Central centre-back', 0.12, 0.5),
      s('RCB', 'CB', 4, 'Right centre-back', 0.14, 0.72),
      s('RWB', 'WB', 2, 'Right wing-back', 0.22, 0.93),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.45, 0.3),
      s('CM', 'CM', 10, 'Centre-mid', 0.42, 0.5),
      s('RCM', 'CM', 7, 'Right centre-mid', 0.45, 0.7),
      s('LST', 'ST', 11, 'Left striker', 0.76, 0.4),
      s('RST', 'ST', 9, 'Right striker', 0.76, 0.6),
    ],
  },
  {
    id: '5-4-1',
    name: '5-4-1',
    family: 'Five at the back',
    hint: 'Two banks, five and four. What a 3-4-3 becomes when it defends deep.',
    slots: [
      s('GK', 'GK', 1, 'Goalkeeper', 0.03, 0.5),
      s('LWB', 'WB', 3, 'Left wing-back', 0.2, 0.07),
      s('LCB', 'CB', 6, 'Left centre-back', 0.14, 0.28),
      s('CB', 'CB', 5, 'Central centre-back', 0.12, 0.5),
      s('RCB', 'CB', 4, 'Right centre-back', 0.14, 0.72),
      s('RWB', 'WB', 2, 'Right wing-back', 0.2, 0.93),
      s('LM', 'LM', 11, 'Left midfield', 0.42, 0.14),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.4, 0.38),
      s('RCM', 'CM', 10, 'Right centre-mid', 0.4, 0.62),
      s('RM', 'RM', 7, 'Right midfield', 0.42, 0.86),
      s('ST', 'ST', 9, 'Striker', 0.72, 0.5),
    ],
  },

  // ── more four-at-the-back shapes ────────────────────────────────────────────
  {
    id: '4-2-3-1-narrow',
    name: '4-2-3-1 narrow',
    family: 'Four at the back',
    hint: 'The 4-2-3-1 with the wide men tucked into the half-spaces. Full-backs supply the width instead.',
    slots: [
      ...BACK_FOUR,
      s('LDM', 'DM', 6, 'Left holding mid', 0.37, 0.4),
      s('RDM', 'DM', 4, 'Right holding mid', 0.37, 0.6),
      s('LAM', 'AM', 11, 'Left attacking mid', 0.63, 0.28),
      s('CAM', 'AM', 10, 'Attacking midfielder', 0.66, 0.5),
      s('RAM', 'AM', 7, 'Right attacking mid', 0.63, 0.72),
      s('ST', 'ST', 9, 'Striker', 0.87, 0.5),
    ],
  },
  {
    id: '4-4-1-1',
    name: '4-4-1-1',
    family: 'Four at the back',
    hint: 'Two banks of four with a second striker dropping off the front man. The classic British counter shape.',
    slots: [
      ...BACK_FOUR,
      s('LM', 'LM', 11, 'Left midfield', 0.46, 0.11),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.43, 0.38),
      s('RCM', 'CM', 4, 'Right centre-mid', 0.43, 0.62),
      s('RM', 'RM', 7, 'Right midfield', 0.46, 0.89),
      s('CAM', 'SS', 10, 'Second striker', 0.68, 0.5),
      s('ST', 'ST', 9, 'Striker', 0.88, 0.5),
    ],
  },
  {
    id: '4-5-1',
    name: '4-5-1',
    family: 'Four at the back',
    hint: 'A flat five across the middle. Hard to play through, and a long way to the striker when you win it.',
    slots: [
      ...BACK_FOUR,
      s('LM', 'LM', 11, 'Left midfield', 0.46, 0.09),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.44, 0.3),
      s('CDM', 'CM', 6, 'Centre-mid', 0.42, 0.5),
      s('RCM', 'CM', 10, 'Right centre-mid', 0.44, 0.7),
      s('RM', 'RM', 7, 'Right midfield', 0.46, 0.91),
      s('ST', 'ST', 9, 'Striker', 0.84, 0.5),
    ],
  },
  {
    id: '4-3-1-2',
    name: '4-3-1-2',
    family: 'Four at the back',
    hint: 'No wingers at all. Everything through the middle, and the full-backs have the whole flank to themselves.',
    slots: [
      ...BACK_FOUR,
      s('LCM', 'CM', 8, 'Left centre-mid', 0.42, 0.28),
      s('CDM', 'DM', 6, 'Holding midfielder', 0.36, 0.5),
      s('RCM', 'CM', 4, 'Right centre-mid', 0.42, 0.72),
      s('CAM', 'AM', 10, 'Attacking midfielder', 0.62, 0.5),
      s('LST', 'ST', 11, 'Left striker', 0.84, 0.38),
      s('RST', 'ST', 9, 'Right striker', 0.84, 0.62),
    ],
  },
  {
    id: '4-2-2-2',
    name: '4-2-2-2 (box)',
    family: 'Four at the back',
    hint: 'A double pivot, two in the pockets, two up. A box in midfield without giving up the second striker.',
    slots: [
      ...BACK_FOUR,
      s('LDM', 'DM', 6, 'Left pivot', 0.36, 0.36),
      s('RDM', 'DM', 4, 'Right pivot', 0.36, 0.64),
      s('LAM', 'AM', 11, 'Left pocket', 0.62, 0.26),
      s('RAM', 'AM', 7, 'Right pocket', 0.62, 0.74),
      s('LST', 'ST', 10, 'Left striker', 0.85, 0.4),
      s('RST', 'ST', 9, 'Right striker', 0.85, 0.6),
    ],
  },
  {
    id: '4-2-4',
    name: '4-2-4',
    family: 'Four at the back',
    hint: 'Four across the front, two to hold everything behind them. All the width and none of the cover.',
    slots: [
      ...BACK_FOUR,
      s('LCM', 'CM', 8, 'Left centre-mid', 0.42, 0.36),
      s('RCM', 'CM', 6, 'Right centre-mid', 0.42, 0.64),
      s('LW', 'LW', 11, 'Left winger', 0.8, 0.08),
      s('LST', 'ST', 10, 'Left striker', 0.86, 0.38),
      s('RST', 'ST', 9, 'Right striker', 0.86, 0.62),
      s('RW', 'RW', 7, 'Right winger', 0.8, 0.92),
    ],
  },

  // ── more three-at-the-back shapes ───────────────────────────────────────────
  {
    id: '3-4-1-2',
    name: '3-4-1-2',
    family: 'Three at the back',
    hint: 'Wing-backs for width, a 10 between the lines, two up top. Congests the centre on both sides of the ball.',
    slots: [
      ...BACK_THREE,
      s('LWB', 'WB', 3, 'Left wing-back', 0.46, 0.05),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.42, 0.36),
      s('RCM', 'CM', 6, 'Right centre-mid', 0.42, 0.64),
      s('RWB', 'WB', 2, 'Right wing-back', 0.46, 0.95),
      s('CAM', 'AM', 10, 'Attacking midfielder', 0.65, 0.5),
      s('LST', 'ST', 11, 'Left striker', 0.85, 0.4),
      s('RST', 'ST', 9, 'Right striker', 0.85, 0.6),
    ],
  },
  {
    id: '3-4-2-1',
    name: '3-4-2-1',
    family: 'Three at the back',
    hint: 'Two in the pockets behind a lone nine. The shape that presses in a 5-2-3 and attacks in a 3-2-5.',
    slots: [
      ...BACK_THREE,
      s('LWB', 'WB', 3, 'Left wing-back', 0.46, 0.05),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.42, 0.36),
      s('RCM', 'CM', 6, 'Right centre-mid', 0.42, 0.64),
      s('RWB', 'WB', 2, 'Right wing-back', 0.46, 0.95),
      s('LAM', 'AM', 11, 'Left pocket', 0.68, 0.3),
      s('RAM', 'AM', 7, 'Right pocket', 0.68, 0.7),
      s('ST', 'ST', 9, 'Striker', 0.88, 0.5),
    ],
  },
  {
    id: '3-1-4-2',
    name: '3-1-4-2',
    family: 'Three at the back',
    hint: 'A screen in front of the three, then a bank of four. Built to win the ball early and go straight to the two.',
    slots: [
      ...BACK_THREE,
      s('CDM', 'DM', 6, 'Holding midfielder', 0.32, 0.5),
      s('LWB', 'WB', 3, 'Left wing-back', 0.52, 0.06),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.5, 0.36),
      s('RCM', 'CM', 4, 'Right centre-mid', 0.5, 0.64),
      s('RWB', 'WB', 2, 'Right wing-back', 0.52, 0.94),
      s('LST', 'ST', 11, 'Left striker', 0.84, 0.4),
      s('RST', 'ST', 9, 'Right striker', 0.84, 0.6),
    ],
  },

  // ── more five-at-the-back shapes ────────────────────────────────────────────
  {
    id: '5-2-3',
    name: '5-2-3',
    family: 'Five at the back',
    hint: 'A back five that still presses with three. What a 3-4-3 looks like the moment it loses the ball.',
    slots: [
      s('GK', 'GK', 1, 'Goalkeeper', 0.03, 0.5),
      s('LWB', 'WB', 3, 'Left wing-back', 0.2, 0.07),
      s('LCB', 'CB', 6, 'Left centre-back', 0.14, 0.28),
      s('CB', 'CB', 5, 'Central centre-back', 0.12, 0.5),
      s('RCB', 'CB', 4, 'Right centre-back', 0.14, 0.72),
      s('RWB', 'WB', 2, 'Right wing-back', 0.2, 0.93),
      s('LCM', 'CM', 8, 'Left centre-mid', 0.44, 0.38),
      s('RCM', 'CM', 10, 'Right centre-mid', 0.44, 0.62),
      s('LW', 'LW', 11, 'Left winger', 0.76, 0.16),
      s('ST', 'ST', 9, 'Striker', 0.8, 0.5),
      s('RW', 'RW', 7, 'Right winger', 0.76, 0.84),
    ],
  },

  // ── from the archive ────────────────────────────────────────────────────────
  // Shapes nobody lines up in any more, kept because half of what the channel
  // explains is why the modern ones look the way they do. A coach showing a
  // session on why we press in threes gets a lot from putting the 2-3-5 up
  // first.
  {
    id: 'wm',
    name: 'WM (3-2-2-3)',
    family: 'From the archive',
    hint: "Herbert Chapman's answer to the 1925 offside law. The first shape with a centre-back in it.",
    slots: [
      s('GK', 'GK', 1, 'Goalkeeper', 0.03, 0.5),
      s('LCB', 'FB', 3, 'Left full-back', 0.16, 0.3),
      s('CB', 'CB', 5, 'Centre-half (stopper)', 0.13, 0.5),
      s('RCB', 'FB', 2, 'Right full-back', 0.16, 0.7),
      s('LCM', 'WH', 6, 'Left half-back', 0.38, 0.32),
      s('RCM', 'WH', 4, 'Right half-back', 0.38, 0.68),
      s('LAM', 'IF', 10, 'Left inside forward', 0.62, 0.36),
      s('RAM', 'IF', 8, 'Right inside forward', 0.62, 0.64),
      s('LW', 'OL', 11, 'Outside left', 0.84, 0.1),
      s('ST', 'CF', 9, 'Centre forward', 0.88, 0.5),
      s('RW', 'OR', 7, 'Outside right', 0.84, 0.9),
    ],
  },
  {
    id: '2-3-5',
    name: '2-3-5 pyramid',
    family: 'From the archive',
    hint: 'The Victorian default, and the reason the shirt numbers run the way they do. Five forwards, two at the back.',
    slots: [
      s('GK', 'GK', 1, 'Goalkeeper', 0.03, 0.5),
      s('LCB', 'FB', 3, 'Left full-back', 0.15, 0.38),
      s('RCB', 'FB', 2, 'Right full-back', 0.15, 0.62),
      s('LCM', 'HB', 6, 'Left half-back', 0.4, 0.22),
      s('CDM', 'CH', 5, 'Centre half-back', 0.38, 0.5),
      s('RCM', 'HB', 4, 'Right half-back', 0.4, 0.78),
      s('LW', 'OL', 11, 'Outside left', 0.78, 0.08),
      s('LAM', 'IL', 10, 'Inside left', 0.82, 0.3),
      s('ST', 'CF', 9, 'Centre forward', 0.86, 0.5),
      s('RAM', 'IR', 8, 'Inside right', 0.82, 0.7),
      s('RW', 'OR', 7, 'Outside right', 0.78, 0.92),
    ],
  },
  {
    id: '3-4-3-diamond',
    name: '3-4-3 diamond',
    family: 'From the archive',
    hint: "Cruyff's Ajax and Barcelona: a back three, a diamond in midfield, a front three holding the touchlines.",
    slots: [
      ...BACK_THREE,
      s('CDM', 'DM', 4, 'Base of the diamond', 0.34, 0.5),
      s('LCM', 'CM', 8, 'Left of the diamond', 0.5, 0.28),
      s('RCM', 'CM', 6, 'Right of the diamond', 0.5, 0.72),
      s('CAM', 'AM', 10, 'Tip of the diamond', 0.64, 0.5),
      s('LW', 'LW', 11, 'Left winger', 0.85, 0.07),
      s('ST', 'CF', 9, 'Centre forward', 0.9, 0.5),
      s('RW', 'RW', 7, 'Right winger', 0.85, 0.93),
    ],
  },

  // ── the empty squad ─────────────────────────────────────────────────────────
  {
    id: 'blank-11',
    name: 'Blank: place your own XI',
    family: 'Start from scratch',
    hint: 'Eleven counters waiting on the touchline. Drag each one where you want it.',
    blank: true,
    // Laid out along the team's own touchline rather than scattered on the
    // grass: a coach with a shape in their head wants a tray of magnets to pull
    // from, not eleven counters piled on the halfway line to untangle first.
    // Constant `width` puts them all on one touchline; spreading `depth` runs
    // them along it. The keeper is first, then 2 to 11 in shirt order, so the
    // tray empties in the order anyone would name a team.
    slots: [
      s('GK', 'GK', 1, 'Goalkeeper', 0.04, 0.965),
      ...Array.from({ length: 10 }, (_, i) => {
        const n = i + 2
        return s(`P${n}`, String(n), n, `Player ${n}`, 0.04 + ((i + 1) * 0.92) / 10, 0.965)
      }),
    ],
  },
]

export const FORMATION_BY_ID = new Map(FORMATIONS.map((f) => [f.id, f]))

/** The picker groups by family, in this order. */
export const FORMATION_FAMILIES = [
  'Four at the back',
  'Three at the back',
  'Five at the back',
  'From the archive',
  'Start from scratch',
]

/** Formations grouped for a picker, in family order, skipping empty families. */
export function formationsByFamily(): { family: string; formations: Formation[] }[] {
  return FORMATION_FAMILIES.map((family) => ({
    family,
    formations: FORMATIONS.filter((f) => f.family === family),
  })).filter((g) => g.formations.length > 0)
}

/**
 * How much of the visible crop each side's shape occupies, as percent-of-crop
 * x, keyed by view.
 *
 * These are judgement calls, not geometry. The principle behind them: the side
 * the view is ABOUT gets the room. On the attacking half we are the ones
 * attacking, so our shape stretches across most of the board and the
 * opposition is compressed back onto their goal. On the defending half it is
 * the other way round. A coach then drags from a sensible starting point
 * rather than untangling eleven counters piled on the halfway line.
 */
/*
 * THE TRAINING BOARDS TAKE THEIR BANDS FROM THEIR OWN GEOMETRY.
 *
 * Every match view's numbers below are judgement calls, and they have to be:
 * "how much of their half does the opposition get" has no arithmetic behind it.
 * A training board's does. The crop is the coned area plus about five metres of
 * grass for the equipment, so the band a shape may use is exactly that area,
 * pulled in by a counter's radius — `areaBand` in ./board/pitch.ts. Writing
 * those percentages out by hand would be four numbers per board that go silently
 * wrong the day a grid is resized.
 */

/**
 * A training board's usable length, split between two sides.
 *
 * The gap in the middle is wider than the match views' four points, and has to
 * be: four points of a 105m pitch is four metres and four points of a 29m rondo
 * square is barely one, so the two lines that meet in the middle would be drawn
 * on top of each other. Twenty points is about six metres on the smallest board
 * here, which is a counter's width of daylight between the two sides.
 */
function split(id: PitchViewId): { us: [number, number]; them: [number, number] } {
  const [a, b] = areaBand(PITCH_VIEWS[id], 'x')
  return { us: [a, 40], them: [60, b] }
}

/** The whole of it, for a shape with the board to itself. */
function whole(id: PitchViewId): [number, number] {
  return areaBand(PITCH_VIEWS[id], 'x')
}

const BANDS: Record<PitchViewId, { us: [number, number]; them: [number, number] }> = {
  full: { us: [3, 48], them: [52, 97] },
  // Upright is the same crop stood on its end. Percent is measured on the crop
  // BEFORE the quarter turn (see board/pitch.ts `metresToUnits`), so a shape
  // laid out for the full pitch lands correctly here without its own numbers.
  'full-vertical': { us: [3, 48], them: [52, 97] },
  'two-thirds': { us: [3, 47], them: [53, 97] },
  'attacking-half': { us: [3, 47], them: [53, 97] },
  'defending-half': { us: [3, 47], them: [53, 97] },
  'attacking-box': { us: [3, 47], them: [53, 97] },
  // The set-piece boards are the two half-pitch crops stood on their end, and
  // percent is measured on the crop BEFORE the turn, so they take the same
  // bands as the halves they are cut from and need no numbers of their own.
  'attacking-set-piece': { us: [3, 47], them: [53, 97] },
  'defending-set-piece': { us: [3, 47], them: [53, 97] },
  'training-pitch': split('training-pitch'),
  'channel-grid': split('channel-grid'),
  'possession-grid': split('possession-grid'),
  'rondo-square': split('rondo-square'),
}

/**
 * Where a shape goes when it has the board to itself.
 *
 * With no opposition, splitting the pitch down the middle wastes half of it and
 * makes "our 4-3-3" look like a team lined up against nobody. A solo shape gets
 * most of the board, which is how a coach draws their own system when the
 * question is the shape rather than the matchup.
 */
const SOLO_BANDS: Record<PitchViewId, [number, number]> = {
  full: [3, 74],
  'full-vertical': [3, 74],
  'two-thirds': [3, 80],
  'attacking-half': [3, 88],
  'defending-half': [3, 88],
  'attacking-box': [3, 88],
  'attacking-set-piece': [3, 88],
  'defending-set-piece': [3, 88],
  'training-pitch': whole('training-pitch'),
  'channel-grid': whole('channel-grid'),
  'possession-grid': whole('possession-grid'),
  'rondo-square': whole('rondo-square'),
}

/**
 * How much of the crop's WIDTH a shape may use, per view.
 *
 * Every match view is the whole pitch or a crop of it, so a shape spans the
 * board's full height and a full-back stands on the touchline where he belongs.
 * A training board is not like that: the crop is the coned area PLUS about five
 * metres of spare grass on each side (board/pitch.ts `TrainingArea`), and that
 * margin belongs to the goals and the cones. A shape laid out across the whole
 * crop puts the wide men in it — standing on the line or outside the exercise
 * altogether, which is not where a session starts.
 *
 * So the training boards state the slice of the crop their AREA occupies, taken
 * in a little further so nobody is placed on the boundary itself. Everything
 * else keeps the whole width, which is what the absent entry means.
 */
const WIDTH_BANDS: Partial<Record<PitchViewId, [number, number]>> = {
  'training-pitch': areaBand(PITCH_VIEWS['training-pitch'], 'y'),
  'channel-grid': areaBand(PITCH_VIEWS['channel-grid'], 'y'),
  'possession-grid': areaBand(PITCH_VIEWS['possession-grid'], 'y'),
  'rondo-square': areaBand(PITCH_VIEWS['rondo-square'], 'y'),
}

/** The x-band our shape occupies on a view — the full solo band, or the half it shares with an opposition. */
export function usBand(view: PitchViewId, solo: boolean): [number, number] {
  return solo ? (SOLO_BANDS[view] ?? SOLO_BANDS.full) : (BANDS[view] ?? BANDS.full).us
}

/**
 * Slide a token's x from one band to another, keeping its position within the
 * band proportional.
 *
 * This is the ONE operation behind the "Keep my shape" switch, and it is only
 * ever run when the coach throws that switch themselves. A shape that has been
 * folded into its own half is spread back across the board — and folded back
 * if the switch goes off again — without any token being regenerated from its
 * formation default, so ten minutes of dragging survives the round trip. The
 * relationships inside the shape are all ratios, so they all come back.
 *
 * It is deliberately NOT wired into the opposition toggle. Doing that squeezed
 * every system the moment an opposition appeared, which is the same complaint
 * as re-placing them, with extra steps.
 */
export function rescaleX(x: number, from: [number, number], to: [number, number]): number {
  const [f0, f1] = from
  const [t0, t1] = to
  const ratio = f1 === f0 ? 0 : (x - f0) / (f1 - f0)
  return Math.round((t0 + ratio * (t1 - t0)) * 10) / 10
}

/**
 * The band an opposition takes when our shape is keeping the whole board.
 *
 * Splitting the pitch down the middle is a kickoff, not a system. Once our
 * shape is spread across the board there is no half left to give away, so the
 * opposition is fitted into the MIRROR of the ground we actually cover: their
 * keeper stands in the goal our front line is attacking, their back line in
 * front of it, and the two shapes interleave through the middle the way they
 * do in a match.
 *
 * Mirroring the real extent rather than a fixed band means the answer suits
 * whatever was built — a high line living in the front third is faced by a low
 * block in the same depth of pitch, not by a full team stretched over it.
 *
 * `null` when there is nothing meaningful to mirror (fewer than two counters,
 * or a huddle inside a tenth of the crop); the caller then falls back to the
 * view's ordinary half-band.
 */
export function mirrorBand(xs: number[]): [number, number] | null {
  if (xs.length < 2) return null
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  if (hi - lo < 10) return null
  return [Math.max(0, 100 - hi), Math.min(100, 100 - lo)]
}

/**
 * How many players of each side a view can actually hold.
 *
 * The first version placed all eleven of both sides on every view and squeezed
 * them into the crop. On the full pitch that is right; on "their box" it is
 * twenty-two counters in a penalty area, which is not a diagram of anything. A
 * close-up is a close-up BECAUSE most of the team is somewhere else.
 *
 * These numbers are judgement calls about what each view is for, and the cast
 * they choose is not: `castFor` keeps the players whose natural position on the
 * pitch is nearest the crop, so a 4-3-3 and a 5-4-1 each give up the players
 * they should. Two rules keep the result looking deliberate:
 *
 *  · Nobody is placed outside the story. On their box we place the attack and
 *    their back line, not a compressed midfield nobody can see past.
 *  · Lines are never split. A cap that would leave one centre-back on the board
 *    and drop the other stops short instead, so the count below is a ceiling
 *    rather than a target. A half-placed back four reads as a mistake.
 *
 * Nobody is deleted by this. A shape placed on a tight view and then widened
 * back out simply has fewer counters on it, and `Re-place shapes` fills the
 * wider view back up.
 */
const CAST: Record<PitchViewId, { us: number; them: number }> = {
  full: { us: 11, them: 11 },
  'full-vertical': { us: 11, them: 11 },
  'two-thirds': { us: 11, them: 11 },
  // Their half: our GK is a pitch away. Their side is the one defending it, so
  // they keep the goalkeeper and give up the forwards.
  'attacking-half': { us: 10, them: 8 },
  // Our half: our shape defends it more or less whole; theirs is the part of
  // their team that has arrived.
  'defending-half': { us: 8, them: 6 },
  // Their box. Everything here is about the attack and the line defending it.
  'attacking-box': { us: 6, them: 6 },
  // THE SET PIECES ARE THE EXCEPTION TO EVERYTHING ABOVE, and deliberately.
  //
  // Every other cap here is a judgement that a close-up view is a close-up
  // BECAUSE most of the team is somewhere else. On a dead ball that is simply
  // false: at a corner all twenty-two are inside this crop, the goalkeeper who
  // is a pitch away is a real player standing on the halfway line in the
  // picture, and dropping a back four would delete the men the routine is
  // about. So both boards hold everybody, and `setpieces.ts` places them.
  'attacking-set-piece': { us: 11, them: 11 },
  'defending-set-piece': { us: 11, them: 11 },
  // TRAINING BOARDS, capped at the numbers the area is actually sized for
  // rather than at a squad. Twenty-two counters in a 20m square is not a rondo,
  // it is a crowd — and a coach who wants more drags them on, which is the
  // normal way to build a session anyway. Lines are still never split, so a
  // back four either all comes or none of it does.
  'training-pitch': { us: 8, them: 8 },
  'channel-grid': { us: 8, them: 8 },
  'possession-grid': { us: 6, them: 6 },
  'rondo-square': { us: 4, them: 3 },
}

/**
 * Where a slot naturally stands along the pitch, in metres.
 *
 * `depth` is measured from the team's own goal, so it has to be turned around
 * for the side attacking the other way before it can be compared to a crop.
 */
function naturalX(slot: Slot, side: Side): number {
  const d = slot.depth * PITCH.length
  return side === 'us' ? d : PITCH.length - d
}

/**
 * Which players of a shape belong on a view, nearest the crop first.
 *
 * Distance is zero for anyone whose natural position is inside the crop, so the
 * ordering only starts discriminating once it runs out of players who are
 * actually there. Slots at the same depth are one line and travel together.
 */
export function castFor(formation: Formation, side: Side, view: PitchViewId): Slot[] {
  const v = PITCH_VIEWS[resolveViewId(view)]
  const cap = CAST[v.id][side]
  // The blank XI is a tray of magnets, not a shape. Eleven were asked for.
  if (formation.blank || formation.slots.length <= cap) return formation.slots

  const ranked = [...formation.slots].sort((a, b) => {
    const da = distanceToCrop(naturalX(a, side), v.x0, v.x1)
    const db = distanceToCrop(naturalX(b, side), v.x0, v.x1)
    return da - db || a.depth - b.depth
  })

  const kept: Slot[] = []
  for (let i = 0; i < ranked.length; ) {
    // Take the whole line at this depth, or none of it.
    const line = ranked.filter((s) => Math.abs(s.depth - ranked[i].depth) < 0.005)
    if (kept.length + line.length > cap) break
    kept.push(...line)
    i += line.length
  }
  // A cap tighter than the first line would place nobody; fall back to that line.
  return kept.length ? kept : ranked.slice(0, cap)
}

function distanceToCrop(x: number, x0: number, x1: number): number {
  return x < x0 ? x0 - x : x > x1 ? x - x1 : 0
}

export type LabelMode = 'position' | 'number'

/**
 * Lay a formation onto the board.
 *
 * We always attack RIGHT and they always attack LEFT, on every view. That
 * sounds like it needs a special case for `defending-half` and it does not:
 * "defending half" means the crop sits on the half containing OUR goal, which
 * is the left goal, so we are still playing left-to-right. Only the bands
 * change per view — which part of the crop each shape occupies.
 *
 * Token ids are prefixed by side, so putting the same formation on both teams
 * does not collide two `LB`s into one id — which would quietly break every
 * tween that followed.
 *
 * On a close-up view this places a CAST rather than a squad — see `castFor`.
 * The returned tokens are the whole of that side for the act they are placed
 * into, so a caller that replaces a side's tokens with these is also, on a
 * tight view, deciding who is in the picture.
 */
export function place(
  formation: Formation,
  side: Side,
  view: PitchViewId,
  labels: LabelMode = 'position',
  /** True when this shape is alone on the board — it then gets the wider band. */
  solo = false,
  /**
   * An explicit x-band to lay the shape into, overriding both of the above.
   *
   * Used by "Keep my shape" to drop the opposition into the mirror of the
   * ground our own tokens cover (see `mirrorBand`), which is a band no table
   * of view defaults could know.
   */
  bandOverride?: [number, number],
): Token[] {
  const band = BANDS[view] ?? BANDS.full
  const [x0, x1] =
    bandOverride ??
    (solo && side === 'us' ? (SOLO_BANDS[view] ?? SOLO_BANDS.full) : side === 'us' ? band.us : band.them)
  const facesRight = side === 'us'

  const slots = castFor(formation, side, view)

  /*
   * A cast fills the band it is given.
   *
   * Six attackers on "their box" carry depths of roughly 0.5–0.9, and laid out
   * raw they would all sit in the front half of the band with empty grass
   * behind them — the crop would look like it was framed wrong. Stretching the
   * kept depths back across the whole band puts the front line at the front and
   * the deepest man at the back, which is what the view is for.
   *
   * The full eleven are deliberately NOT re-normalised: their layout is the one
   * that has been looked at on every view, and a goalkeeper standing exactly on
   * the edge of the band instead of just inside it is a change for nothing.
   */
  const partial = slots.length < formation.slots.length
  const lo = Math.min(...slots.map((s) => s.depth))
  const hi = Math.max(...slots.map((s) => s.depth))
  const spread = (d: number) => (partial && hi > lo ? (d - lo) / (hi - lo) : d)

  /*
   * ACROSS the board, the same argument, and ONLY on a training board.
   *
   * A cast on a small grid is a slice out of the middle of a team — four
   * midfielders and a holder — and their `width` values all sit within a few
   * points of the centre line, because that is where midfielders stand on a
   * pitch. Laid out raw into a 20m square that is five counters in a vertical
   * pile with the whole grid empty either side of them, which is not a rondo,
   * it is a queue.
   *
   * The match views deliberately do NOT do this. There, width means something
   * fixed — a left-back is on the left touchline and stays there whoever else
   * is in the picture — and stretching a cast across the pitch would move men
   * off the positions the view exists to show. A coned grid has no touchline
   * and no left-back: it has an area, and the men in it should fill it.
   */
  const across = WIDTH_BANDS[view] !== undefined
  const wlo = Math.min(...slots.map((s) => s.width))
  const whi = Math.max(...slots.map((s) => s.width))
  const fan = (w: number) => (across && whi > wlo ? (w - wlo) / (whi - wlo) : w)

  return slots.map((slot) => {
    // depth runs from the team's own goal to its front line, along the band
    const along = facesRight ? spread(slot.depth) : 1 - spread(slot.depth)
    const x = x0 + along * (x1 - x0)
    // Seen from above, a team attacking right has its LEFT flank at the top.
    const [y0, y1] = WIDTH_BANDS[view] ?? [0, 100]
    const w = fan(slot.width)
    const y = y0 + (facesRight ? w : 1 - w) * (y1 - y0)

    return {
      id: `${side}-${slot.id}`,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      label: labels === 'number' ? String(slot.num) : slot.pos,
      side,
      name: undefined,
    }
  })
}

/** Re-label an existing set of tokens without disturbing their positions. */
export function relabel(tokens: Token[], formationId: string, labels: LabelMode): Token[] {
  const f = FORMATION_BY_ID.get(formationId)
  if (!f) return tokens
  const bySlot = new Map(f.slots.map((slot) => [slot.id, slot]))
  return tokens.map((t) => {
    const slot = bySlot.get(t.id.replace(/^(us|them)-/, ''))
    if (!slot) return t
    return { ...t, label: labels === 'number' ? String(slot.num) : slot.pos }
  })
}
