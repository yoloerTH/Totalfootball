/**
 * "Sacchi's 25 Metres" — authored in METRES, emitted in the studio's percent space.
 *
 * View is `full`: 0..105m x 0..68m. We attack +x, our goal is x=0, theirs x=105.
 * They build from their own goal at x~101 and attack -x, so their right is low y.
 *
 * ── THE MISTAKES THIS FILE EXISTS TO NOT REPEAT ─────────────────────────────
 *
 * 1. THE COORDINATES, NOT THE CROP. The first two builds put the keeper on the
 *    centre spot and the back four ten metres inside the opposition half, and I
 *    twice blamed the camera for the dead grass. `KEEPER_MAX` and the back-line
 *    caps below exist so that cannot happen again.
 *
 * 2. THE OFFSIDE HAS TO BE EARNED. Build three drew a striker THIRTEEN metres
 *    beyond the line, left a second opponent four metres beyond it and unnamed,
 *    and floated the OFFSIDE plate eleven metres away from the man in a grey box
 *    that also held the keeper and a different idea. It read as a stranded
 *    player, not a trap. So: every phase declares its offside line and exactly
 *    who is caught, the check verifies the declared set IS the beyond-the-line
 *    set, and a caught man must be between 1.5 and 3.5 metres over. A trap reads
 *    at two metres or it does not read.
 *
 * The distances the game actually plays at:
 *
 *   our keeper      26m off his line in the shape, 35m at the very highest.
 *   our back four   52m in the shape (ON the halfway line, the Baresi picture),
 *                   stepping to 70m when the trap springs.
 *   our front two   25m ahead of the back four, by definition.
 *   their back four 88m — the edge of their own penalty area, which is at 88.5.
 *   their keeper    101m, four metres off his line.
 *
 * ── THE MARK RULES ──────────────────────────────────────────────────────────
 *
 * A label anchor cannot be dragged: a zone takes its name 2.4m inside its own
 * top edge, an arrow takes its at the midpoint (Overlays.tsx). So a label goes
 * only where its anchor lands in clear grass, 6m from every counter.
 *
 * The ONE exception is a plate that is deliberately ATTACHED to a man — the
 * OFFSIDE call. That declares `anchorTo`, must sit 2.5 to 5m from him, and must
 * still be 6m clear of everybody else. Half of the last build's offside problem
 * was a plate obeying the general rule when it needed to break it.
 *
 * ── PACE ────────────────────────────────────────────────────────────────────
 *
 * hold 0, move 1000: no phase ever sits still, the whole film is 18 seconds of
 * continuous movement. The user's call, and it is why there are 18 acts rather
 * than 8 — with no hold, a beat has to be a MOVE or it does not exist.
 */
import { writeFileSync } from 'node:fs'

const L = 105, W = 68
const VIEW = { id: 'full', x0: 0, x1: 105, y0: 0, y1: 68 }
const VW = VIEW.x1 - VIEW.x0, VH = VIEW.y1 - VIEW.y0

const r2 = (n) => Math.round(n * 100) / 100
const px = (m) => r2(((m - VIEW.x0) / VW) * 100)
const py = (m) => r2(((m - VIEW.y0) / VH) * 100)
const P = (mx, my) => ({ x: px(mx), y: py(my) })
const rect = (x0, y0, x1, y1) => ({ x: px(x0), y: py(y0), w: r2(px(x1) - px(x0)), h: r2(py(y1) - py(y0)) })
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

const US = {
  'u-gk': 'GK', 'u-lb': 'LB', 'u-lcb': 'CB', 'u-rcb': 'CB', 'u-rb': 'RB',
  'u-lm': 'LM', 'u-6': '6', 'u-8': '8', 'u-rm': 'RM', 'u-9': '9', 'u-10': '10',
}
const THEM = {
  'o-gk': 'GK', 'o-rb': 'RB', 'o-rcb': 'CB', 'o-lcb': 'CB', 'o-lb': 'LB',
  'o-6': '6', 'o-8': '8', 'o-10': '10', 'o-rw': 'RW', 'o-9': '9', 'o-lw': 'LW',
}
const SIDE = (id) => (id.startsWith('u-') ? 'us' : 'them')
const LABEL = { ...US, ...THEM }
const BACK_FOUR = ['u-lb', 'u-lcb', 'u-rcb', 'u-rb']
const NOTE = (id, at, text) => ({ id, at, text, size: 's', look: 'plate', align: 'center', weight: 'bold' })

/* ── CHAPTER ONE · THE DISTANCE ──────────────────────────────────────────── */

const PHASES = [
  {
    id: 'act-25m',
    title: 'Twenty-five metres',
    caption: 'The block is not a shape. It is a distance.',
    push: 'gentle',
    notes:
      'The back four is on the halfway line and the front two are 25 metres ahead of ' +
      'them. Sacchi allowed no more than that, ever. Everything else in this system is a ' +
      'consequence of the one number: the pressing is possible because the distances are ' +
      'short, and the line can step because there is nobody stranded behind it.',
    pos: {
      'u-gk': [26, 34],
      'u-lb': [52, 12], 'u-lcb': [52, 27], 'u-rcb': [52, 41], 'u-rb': [52, 56],
      'u-lm': [64, 12], 'u-6': [63, 28], 'u-8': [63, 40], 'u-rm': [64, 56],
      'u-9': [77, 28], 'u-10': [77, 40],
      'o-gk': [101, 34],
      'o-rb': [85, 8], 'o-rcb': [88, 26], 'o-lcb': [88, 42], 'o-lb': [85, 60],
      'o-6': [79, 34], 'o-8': [70, 22], 'o-10': [70, 46],
      'o-rw': [60, 7], 'o-9': [56, 34], 'o-lw': [60, 60],
    },
    ball: [101, 34],
    bands: [{ id: 'bd-block', kind: 'zone', box: [52, 0, 77, 68], tone: 'green',
             strength: 'normal', edge: 'dashed', label: null }],
    arrows: [{ id: 'ar-measure', kind: 'line', from: [52, 64.5], to: [77, 64.5], label: null }],
    texts: [NOTE('tx-distance', [36, 14], 'The distance\nis the system.')],
  },

  {
    id: 'act-45m',
    title: 'What everybody else did',
    caption: null,
    push: 'gentle',
    notes:
      'Italian football in 1987 defended a much bigger piece of grass than this. A deep ' +
      'back line, a libero behind it to clean up, and forty-five metres of open pitch ' +
      'between the last defender and the centre-forward. Sacchi did not invent pressing. ' +
      'He halved the distance it had to be done over, which is what made it survivable.',
    pos: {
      'u-gk': [12, 34],
      'u-lb': [25, 10], 'u-lcb': [25, 25], 'u-rcb': [25, 40], 'u-rb': [25, 55],
      'u-lm': [48, 10], 'u-6': [47, 26], 'u-8': [47, 42], 'u-rm': [48, 56],
      'u-9': [70, 27], 'u-10': [70, 41],
      'o-gk': [101, 34],
      'o-rb': [88, 8], 'o-rcb': [90, 26], 'o-lcb': [90, 42], 'o-lb': [88, 60],
      'o-6': [80, 34], 'o-8': [72, 20], 'o-10': [72, 48],
      'o-rw': [60, 8], 'o-9': [58, 34], 'o-lw': [60, 60],
    },
    dim: Object.keys(THEM),
    ball: [90, 26],
    bands: [{ id: 'bd-old', kind: 'zone', box: [25, 0, 70, 68], tone: 'grey',
             strength: 'soft', edge: 'dashed', label: null }],
    arrows: [{ id: 'ar-old-measure', kind: 'line', from: [25, 64.5], to: [70, 64.5], label: null }],
    texts: [NOTE('tx-old', [32, 13], 'Everybody else defended\nforty-five metres.')],
  },

  {
    id: 'act-references',
    title: 'Four reference points',
    caption: 'The ball. The space. The opponent. His own team-mate.',
    push: 'standard',
    notes:
      "Sacchi's players moved in relation to four things at once, and decided which of " +
      'the four owned the movement. Nobody in this side is marking a man. The left ' +
      'midfielder is holding a distance to the ball, a distance to the team-mate inside ' +
      'him, a distance to the winger outside him, and a piece of grass.',
    pos: {
      'u-gk': [26, 34],
      'u-lb': [52, 12], 'u-lcb': [52, 27], 'u-rcb': [52, 41], 'u-rb': [52, 56],
      'u-lm': [64, 12], 'u-6': [63, 28], 'u-8': [63, 40], 'u-rm': [64, 56],
      'u-9': [77, 28], 'u-10': [77, 40],
      'o-gk': [101, 34],
      'o-rb': [85, 8], 'o-rcb': [88, 26], 'o-lcb': [88, 42], 'o-lb': [85, 60],
      'o-6': [79, 34], 'o-8': [70, 22], 'o-10': [70, 46],
      'o-rw': [60, 7], 'o-9': [56, 34], 'o-lw': [60, 60],
    },
    dim: ['u-gk', 'u-lcb', 'u-rcb', 'u-rb', 'u-8', 'u-rm', 'u-10',
          'o-gk', 'o-lcb', 'o-lb', 'o-10', 'o-9', 'o-lw'],
    ball: [88, 26],
    bands: [{ id: 'bd-space', kind: 'zone', box: [52, 16, 68, 32], tone: 'blue',
             strength: 'soft', edge: 'dashed', label: 'the space' }],
    arrows: [
      { id: 'ar-ref-ball', kind: 'line', fromId: 'u-lm', from: [64, 12], to: [88, 26], opacity: 0.7 },
      { id: 'ar-ref-opp',  kind: 'line', fromId: 'u-lm', toId: 'o-rw', from: [64, 12], to: [60, 7], opacity: 0.7 },
      { id: 'ar-ref-mate', kind: 'line', fromId: 'u-lm', toId: 'u-6',  from: [64, 12], to: [63, 28], opacity: 0.7 },
    ],
    texts: [{ id: 'tx-refs', at: [30, 46], size: 's', look: 'plate', align: 'left', weight: 'bold',
              text: 'the ball\nthe space\nthe opponent\nhis team-mate' }],
  },

  {
    id: 'act-move-as-one',
    title: 'One body',
    caption: null,
    push: 'gentle',
    notes:
      'The ball is played square across their two centre-backs and the entire block ' +
      'slides with it, the same distance, in the same direction, at the same moment. ' +
      'The shape does not change. This is the drill Milan did without a ball, on a rope, ' +
      'for hours, and it is the reason nobody in the block ever has to run to recover.',
    pos: {
      'u-gk': [26, 38],
      'u-lb': [52, 18], 'u-lcb': [52, 33], 'u-rcb': [52, 47], 'u-rb': [52, 62],
      'u-lm': [64, 18], 'u-6': [63, 34], 'u-8': [63, 46], 'u-rm': [64, 62],
      'u-9': [77, 34], 'u-10': [77, 46],
      'o-gk': [101, 34],
      'o-rb': [85, 8], 'o-rcb': [88, 26], 'o-lcb': [88, 42], 'o-lb': [85, 60],
      'o-6': [81, 40], 'o-8': [70, 22], 'o-10': [70, 46],
      'o-rw': [60, 7], 'o-9': [56, 26], 'o-lw': [58, 64],
    },
    ball: [88, 42],
    bands: [],
    arrows: [
      { id: 'ar-across', kind: 'pass', fromId: 'o-rcb', toId: 'o-lcb', from: [88, 26], to: [88, 42], label: null },
      { id: 'ar-slide-back', kind: 'run', from: [52, 27], to: [52, 32], opacity: 0.6 },
      { id: 'ar-slide-mid',  kind: 'run', from: [63, 28], to: [63, 33], opacity: 0.6 },
      { id: 'ar-slide-top',  kind: 'run', from: [77, 28], to: [77, 33], opacity: 0.6 },
    ],
    texts: [NOTE('tx-one-body', [34, 12], 'One body.\nNot eleven players.')],
  },

  /* ── CHAPTER TWO · THE MIDDLE IS SHUT ──────────────────────────────────── */

  {
    id: 'act-shut',
    title: 'The middle is already shut',
    caption: 'Nobody dives in. The inside passes are closed by where men stand.',
    push: 'standard',
    notes:
      '"Pressing is not about running and it is not about working hard. It is about ' +
      'controlling space. Force the opposition to pass where you want them to." The nine ' +
      'shows the centre-back the touchline with the angle of his approach; the ten covers ' +
      'the pivot behind him. Neither of them is trying to win the ball here.',
    pos: {
      'u-gk': [28, 32],
      'u-lb': [55, 10], 'u-lcb': [55, 25], 'u-rcb': [55, 39], 'u-rb': [55, 53],
      'u-lm': [67, 11], 'u-6': [66, 26], 'u-8': [66, 38], 'u-rm': [67, 53],
      'u-9': [81, 26], 'u-10': [79, 38],
      'o-gk': [101, 34],
      'o-rb': [86, 8], 'o-rcb': [88, 26], 'o-lcb': [88, 43], 'o-lb': [86, 60],
      'o-6': [79, 32], 'o-8': [72, 20], 'o-10': [73, 45],
      'o-rw': [62, 7], 'o-9': [59, 33], 'o-lw': [62, 61],
    },
    cues: { 'u-9': 'PRESS', 'u-10': 'COVER', 'u-6': 'COVER', 'u-lm': 'JOCKEY' },
    ball: [88, 26],
    bands: [{ id: 'bd-shut', kind: 'zone', box: [68, 22, 90, 46], tone: 'blue',
             strength: 'soft', edge: 'dashed', label: null }],
    arrows: [
      { id: 'ar-press-9', kind: 'press', from: [76, 30], to: [80, 27], bend: -0.25 },
      { id: 'ar-lane', kind: 'line', fromId: 'o-rcb', toId: 'o-8', from: [88, 26], to: [72, 20], opacity: 0.45 },
    ],
    texts: [NOTE('tx-shut', [38, 14], 'Nobody dives in.\nThe lanes are shut.')],
  },

  {
    id: 'act-dive-in',
    title: 'What it costs if one man goes',
    caption: 'If one man goes early, the pass goes past him and the block has a hole in it.',
    push: 'close',
    notes:
      'This is the failure the whole system is built to avoid, and it is worth showing ' +
      'because it is the only way to explain why the pressing looks so patient. The nine ' +
      'commits, gets there half a second early, and the centre-back plays into the space ' +
      'he left. Nobody behind him has moved, so the hole is real. Sacchi fined it.',
    pos: {
      'u-gk': [28, 32],
      'u-lb': [55, 10], 'u-lcb': [55, 25], 'u-rcb': [55, 39], 'u-rb': [55, 53],
      'u-lm': [67, 11], 'u-6': [66, 26], 'u-8': [66, 38], 'u-rm': [67, 53],
      'u-9': [85.5, 26], 'u-10': [79, 38],
      'o-gk': [101, 34],
      'o-rb': [86, 8], 'o-rcb': [88, 26], 'o-lcb': [88, 43], 'o-lb': [86, 60],
      'o-6': [79, 32], 'o-8': [72, 21], 'o-10': [73, 45],
      'o-rw': [62, 7], 'o-9': [59, 33], 'o-lw': [62, 61],
    },
    cues: { 'u-9': 'PRESS', 'o-8': 'SPARE' },
    duels: [['u-9', 'o-rcb']],
    ball: [88, 26],
    bands: [{ id: 'bd-hole', kind: 'danger', box: [64, 12, 84, 32], tone: 'red',
             strength: 'normal', edge: 'solid', label: 'the hole' }],
    arrows: [
      { id: 'ar-dive', kind: 'press', from: [81, 26], to: [84.5, 26] },
      { id: 'ar-through', kind: 'pass', from: [88, 26], to: [73.5, 21.5], opacity: 0.8 },
    ],
    texts: [NOTE('tx-cost', [36, 52], 'One man dives in.\nThe system is gone.')],
  },

  /* ── CHAPTER THREE · THE TRIGGER ───────────────────────────────────────── */

  {
    id: 'act-trigger',
    title: 'The trigger is the pass to the full-back',
    caption: 'One pass. Eleven minds. The whole side leans before it arrives.',
    push: 'standard',
    notes:
      'The press was not started by a whistle or by a mistake. It was started by a ' +
      'specific pass, out to the full-back, the weakest passer on the pitch, in the ' +
      'narrowest part of it. The side moves on the pass, not on the reception.',
    pos: {
      'u-gk': [30, 30],
      'u-lb': [57, 9], 'u-lcb': [57, 24], 'u-rcb': [57, 38], 'u-rb': [57, 52],
      'u-lm': [71, 10], 'u-6': [68, 25], 'u-8': [68, 37], 'u-rm': [69, 51],
      'u-9': [81, 20], 'u-10': [78, 36],
      'o-gk': [101, 34],
      'o-rb': [86, 8], 'o-rcb': [89, 27], 'o-lcb': [89, 44], 'o-lb': [86, 60],
      'o-6': [81, 30], 'o-8': [74, 19], 'o-10': [75, 45],
      'o-rw': [64, 7], 'o-9': [61, 33], 'o-lw': [64, 61],
    },
    cues: { 'u-lm': 'PRESS', 'u-9': 'COVER', 'u-6': 'COVER', 'u-lb': 'BALANCE' },
    ball: [86, 8],
    bands: [],
    arrows: [
      { id: 'ar-trigger', kind: 'pass', fromId: 'o-rcb', toId: 'o-rb',
        from: [89, 27], to: [86, 9], label: 'the trigger' },
      { id: 'ar-lean', kind: 'run', from: [67, 12], to: [70, 11], opacity: 0.5 },
    ],
    texts: [NOTE('tx-chose', [40, 16], 'They think\nthey chose it.')],
  },

  {
    id: 'act-in-the-air',
    title: 'The half second before',
    caption: 'Six men are already moving. The ball has not landed.',
    push: 'close',
    notes:
      'This is the frame that separates the system from a hard-working team. The ball is ' +
      'still travelling and the trap is already three-quarters built. Nobody is reacting ' +
      'to the full-back receiving it, because by then it is too late to arrive together.',
    pos: {
      'u-gk': [31, 32],
      'u-lb': [65, 10], 'u-lcb': [59, 23], 'u-rcb': [59, 38], 'u-rb': [59, 52],
      'u-lm': [75.5, 10], 'u-6': [75, 20], 'u-8': [68.5, 35], 'u-rm': [68, 49],
      'u-9': [83, 20], 'u-10': [78.5, 36],
      'o-gk': [101, 34],
      'o-rb': [86, 7], 'o-rcb': [89.5, 27], 'o-lcb': [89, 44], 'o-lb': [86, 60],
      'o-6': [82, 30], 'o-8': [71.5, 26], 'o-10': [77, 44],
      'o-rw': [70, 6], 'o-9': [61, 32], 'o-lw': [65, 61],
    },
    cues: { 'u-lm': 'PRESS', 'u-lb': 'PRESS', 'u-6': 'COVER', 'u-9': 'COVER' },
    ball: [87, 17],
    bands: [],
    arrows: [
      { id: 'ar-flight', kind: 'pass', from: [89.5, 27], to: [86, 7], opacity: 0.5 },
      { id: 'ar-lean-lb', kind: 'run', from: [57, 9], to: [64, 10], opacity: 0.7 },
      { id: 'ar-lean-lm', kind: 'run', from: [71, 10], to: [75, 10], opacity: 0.7 },
      { id: 'ar-lean-6',  kind: 'run', from: [68, 25], to: [74, 20.5], opacity: 0.7 },
      { id: 'ar-lean-rm', kind: 'run', from: [69, 51], to: [68, 49], opacity: 0.7 },
    ],
    texts: [NOTE('tx-air', [40, 14], 'The ball has not\nlanded yet.')],
  },

  /* ── CHAPTER FOUR · THE TRAP ───────────────────────────────────────────── */

  {
    id: 'act-trap',
    title: 'Three men arrive at once',
    caption: 'Not one presser. Three, and the touchline.',
    push: 'close',
    notes:
      'The left midfielder takes the ball, the left-back steps out onto the winger behind ' +
      'him, the six slides across to seal the inside, and the nine drops on the pass back ' +
      'to the centre-back. Four outfield players inside a twenty-metre square, and the far ' +
      'side of the pitch deliberately empty.',
    pos: {
      'u-gk': [33, 34],
      'u-lb': [74, 10], 'u-lcb': [62, 22], 'u-rcb': [62, 37], 'u-rb': [62, 51],
      'u-lm': [81, 9], 'u-6': [77, 20], 'u-8': [70, 34], 'u-rm': [66, 46],
      'u-9': [85, 20], 'u-10': [79, 36],
      'o-gk': [101, 34],
      'o-rb': [86, 6], 'o-rcb': [90, 26], 'o-lcb': [89, 45], 'o-lb': [86, 60],
      'o-6': [83, 30], 'o-8': [74, 28], 'o-10': [79, 43],
      'o-rw': [77, 4], 'o-9': [64, 31], 'o-lw': [66, 61],
    },
    cues: { 'u-lm': 'PRESS', 'u-lb': 'PRESS', 'u-6': 'COVER', 'u-9': 'COVER',
            'u-10': 'BALANCE', 'u-8': 'BALANCE', 'u-rcb': 'SPARE' },
    ball: [86, 6],
    bands: [{ id: 'bd-trap', kind: 'danger', box: [72, 0, 96, 22], tone: 'red',
             strength: 'normal', edge: 'solid', label: null }],
    arrows: [
      { id: 'ar-trap-lm', kind: 'press', from: [72, 13], to: [79, 10], bend: 0.15 },
      { id: 'ar-trap-lb', kind: 'press', from: [61, 11], to: [72, 10] },
      { id: 'ar-trap-6',  kind: 'press', from: [70, 28], to: [75, 22] },
    ],
    texts: [NOTE('tx-touchline', [46, 16], 'The touchline is\nthe fourth defender.')],
  },

  {
    id: 'act-four-dead',
    title: 'Four ways out, all of them shut',
    caption: 'Back, inside, down the line, or the winger. There is a man on all four.',
    push: 'close',
    notes:
      'A press is only a press when it takes the options away rather than the time. The ' +
      'full-back has four passes available and every one of them arrives at a Milan ' +
      'player, so he has the ball, the touchline, and nothing to do with either.',
    pos: {
      'u-gk': [33, 34],
      'u-lb': [76, 8], 'u-lcb': [64, 22], 'u-rcb': [64, 37], 'u-rb': [64, 51],
      'u-lm': [82, 7], 'u-6': [79, 17], 'u-8': [70, 33], 'u-rm': [67, 44],
      'u-9': [86, 22], 'u-10': [79, 36],
      'o-gk': [101, 34],
      'o-rb': [85, 4], 'o-rcb': [91, 26], 'o-lcb': [89, 45], 'o-lb': [86, 60],
      'o-6': [83, 30], 'o-8': [74, 27], 'o-10': [79, 43],
      'o-rw': [77, 4], 'o-9': [65, 30], 'o-lw': [66, 61],
    },
    cues: { 'u-lm': 'PRESS', 'u-lb': 'PRESS', 'u-6': 'COVER', 'u-9': 'COVER',
            'u-8': 'BALANCE', 'u-rcb': 'SPARE' },
    duels: [['u-lm', 'o-rb'], ['u-lb', 'o-rw']],
    ball: [85, 4],
    bands: [{ id: 'bd-trap', kind: 'danger', box: [72, 0, 96, 22], tone: 'red',
             strength: 'normal', edge: 'solid', label: null }],
    arrows: [
      { id: 'ar-opt-wing', kind: 'pass', fromId: 'o-rb', toId: 'o-rw',  from: [85, 4], to: [77, 4],  opacity: 0.45 },
      { id: 'ar-opt-back', kind: 'pass', fromId: 'o-rb', toId: 'o-rcb', from: [85, 4], to: [91, 26], opacity: 0.45 },
      { id: 'ar-opt-in',   kind: 'pass', fromId: 'o-rb', toId: 'o-6',   from: [85, 4], to: [83, 30], opacity: 0.45 },
      { id: 'ar-opt-long', kind: 'pass', fromId: 'o-rb', from: [85, 4], to: [68, 20], opacity: 0.45 },
    ],
    texts: [NOTE('tx-dead', [42, 16], 'Four ways out.\nAll four are shut.')],
  },

  {
    id: 'act-concede',
    title: 'We give them the far side on purpose',
    caption: null,
    push: 'gentle',
    notes:
      'The far winger tucks in rather than holding his touchline, so the block is eleven ' +
      'men on one half of the grass. The far flank is genuinely open, and that is the ' +
      'trade: the only ball that punishes it is a long switch, first time, played by a ' +
      'full-back with three men on him.',
    pos: {
      'u-gk': [33, 34],
      'u-lb': [74, 10], 'u-lcb': [62, 22], 'u-rcb': [60, 36], 'u-rb': [62, 51],
      'u-lm': [81, 9], 'u-6': [77, 20], 'u-8': [70, 34], 'u-rm': [64, 40],
      'u-9': [85, 20], 'u-10': [79, 36],
      'o-gk': [101, 34],
      'o-rb': [86, 6], 'o-rcb': [90, 26], 'o-lcb': [89, 45], 'o-lb': [86, 60],
      'o-6': [83, 30], 'o-8': [74, 28], 'o-10': [79, 43],
      'o-rw': [77, 4], 'o-9': [64, 31], 'o-lw': [66, 61],
    },
    cues: { 'u-lm': 'PRESS', 'u-lb': 'PRESS', 'u-6': 'COVER', 'u-9': 'COVER',
            'u-rm': 'BALANCE', 'u-8': 'BALANCE' },
    ball: [86, 6],
    bands: [
      { id: 'bd-concede', kind: 'zone', box: [60, 48, 100, 68], tone: 'grey',
        strength: 'soft', edge: 'dashed', label: 'the side we concede' },
      { id: 'bd-trap', kind: 'danger', box: [72, 0, 96, 22], tone: 'red',
        strength: 'soft', edge: 'solid', label: null },
    ],
    arrows: [
      { id: 'ar-switch', kind: 'switch', from: [86, 6], to: [76, 58], bend: 0.35, opacity: 0.6 },
      { id: 'ar-tuck', kind: 'run', from: [66, 46], to: [65, 41], opacity: 0.5 },
    ],
    texts: [NOTE('tx-half', [46, 16], 'Eleven men on\nhalf the grass.')],
  },

  {
    id: 'act-switch-arrives',
    title: 'He plays it, and it still does not work',
    caption: null,
    push: 'gentle',
    notes:
      'The honest version of the trade. He does find the switch and it does arrive. But a ' +
      'ball that spends that long in the air is a ball the block has time to travel with, ' +
      'and the man who receives it on the far touchline has a Milan player on him before ' +
      'he can take a second touch. The far side was never free. It was only far.',
    pos: {
      'u-gk': [33, 40],
      'u-lb': [68, 18], 'u-lcb': [62, 34], 'u-rcb': [62, 48], 'u-rb': [66, 60],
      'u-lm': [74, 20], 'u-6': [72, 32], 'u-8': [70, 45], 'u-rm': [78, 56],
      'u-9': [82, 32], 'u-10': [80, 44],
      'o-gk': [101, 34],
      'o-rb': [86, 10], 'o-rcb': [90, 28], 'o-lcb': [89, 46], 'o-lb': [86, 60],
      'o-6': [86, 38], 'o-8': [80, 16], 'o-10': [82, 50],
      'o-rw': [72, 8], 'o-9': [66, 26], 'o-lw': [70, 64],
    },
    cues: { 'u-rm': 'PRESS', 'u-8': 'COVER', 'u-rcb': 'BALANCE', 'u-10': 'COVER' },
    ball: [86, 60],
    bands: [{ id: 'bd-covered', kind: 'zone', box: [64, 42, 100, 68], tone: 'green',
             strength: 'soft', edge: 'dashed', label: null }],
    arrows: [
      { id: 'ar-switch', kind: 'switch', from: [86, 6], to: [86, 60], bend: 0.35, opacity: 0.55 },
      { id: 'ar-travel-rm',  kind: 'run', from: [64, 40], to: [77, 55], opacity: 0.8 },
      { id: 'ar-travel-8',   kind: 'run', from: [70, 34], to: [70, 44], opacity: 0.6 },
      { id: 'ar-travel-rcb', kind: 'run', from: [60, 36], to: [62, 47], opacity: 0.6 },
    ],
    texts: [NOTE('tx-arrives', [42, 14], 'It arrives.\nSo do we.')],
  },

  /* ── CHAPTER FIVE · THE LINE ───────────────────────────────────────────────
   *
   * Four acts, because offside has to be EARNED on screen. The law judges the
   * striker's position at the moment the ball is PLAYED, so the line must step
   * BEFORE the pass leaves, not after it. That ordering is the whole sequence:
   *
   *   13  he is onside by 2m, the line is at 62, the long ball is loaded
   *   14  the four step 8m together; he chases back and loses by 2m
   *   15  he plays it anyway; at that instant the striker is 2m over
   *   16  and the price: 70 metres behind the line, with one man in it
   */

  {
    id: 'act-goes-long',
    title: 'The one ball he has left',
    caption: 'He cannot go back, inside or down the line. So he loads the only ball left.',
    push: 'standard',
    notes:
      'The back four has squared up at 62 metres and the centre-forward has dropped onto ' +
      'the last man to stay legal. He is onside. Everything up to this point has been ' +
      'about removing the short passes, and it has worked: the only ball left is the one ' +
      'over the top, which is the ball this defence wants him to choose.',
    pos: {
      'u-gk': [34, 33],
      'u-lb': [62, 12], 'u-lcb': [62, 25], 'u-rcb': [62, 40], 'u-rb': [62, 54],
      'u-lm': [80, 9], 'u-6': [76, 20], 'u-8': [70, 34], 'u-rm': [66, 46],
      'u-9': [85, 20], 'u-10': [79, 36],
      'o-gk': [101, 34],
      'o-rb': [86, 6], 'o-rcb': [90, 26], 'o-lcb': [89, 45], 'o-lb': [86, 60],
      'o-6': [83, 30], 'o-8': [74, 28], 'o-10': [79, 43],
      'o-rw': [77, 4], 'o-9': [64, 31], 'o-lw': [70, 60],
    },
    cues: { 'u-lcb': 'BALANCE', 'u-rcb': 'BALANCE' },
    offside: { caught: [] },
    ball: [86, 6],
    bands: [],
    arrows: [
      { id: 'ar-offside-line', kind: 'line', from: [62, 3], to: [62, 65] },
      { id: 'ar-long', kind: 'pass', from: [86, 6], to: [50, 30], opacity: 0.4, label: 'the only ball left' },
    ],
    texts: [
      { id: 'tx-onside', at: [60, 31], anchorTo: 'o-9', text: null, size: 's', look: 'halo',
        align: 'center', weight: 'black', tone: 'green' },
      NOTE('tx-only-ball', [40, 14], 'He has one ball left.\nOver the top.'),
    ],
  },

  {
    id: 'act-line-steps',
    title: 'Attacking their attack',
    caption: null,
    push: 'standard',
    notes:
      'Baresi calls it and the four go together, before the ball is struck rather than ' +
      'after it, because the law judges where the attacker stands at the moment of the ' +
      'pass. The centre-forward turns and runs back and does not get there. Offside ' +
      'stopped being a way of surviving a ball over the top and became a way of taking ' +
      'possession back.',
    pos: {
      'u-gk': [35, 34],
      'u-lb': [70, 12], 'u-lcb': [70, 25], 'u-rcb': [70, 40], 'u-rb': [70, 54],
      'u-lm': [80, 10], 'u-6': [77, 21], 'u-8': [76, 35], 'u-rm': [72, 47],
      'u-9': [86, 21], 'u-10': [82, 37],
      'o-gk': [101, 34],
      'o-rb': [86, 6], 'o-rcb': [90, 26], 'o-lcb': [89, 45], 'o-lb': [86, 60],
      'o-6': [83, 30], 'o-8': [76, 28], 'o-10': [80, 43],
      'o-rw': [77, 4], 'o-9': [68, 31], 'o-lw': [72, 60],
    },
    cues: { 'u-lb': 'BALANCE', 'u-lcb': 'BALANCE', 'u-rcb': 'BALANCE', 'u-rb': 'BALANCE' },
    offside: { caught: ['o-9'] },
    ball: [86, 6],
    bands: [],
    arrows: [
      { id: 'ar-offside-line', kind: 'line', from: [70, 3], to: [70, 63] },
      { id: 'ar-step-lb',  kind: 'run', from: [62, 12], to: [69, 12] },
      { id: 'ar-step-lcb', kind: 'run', from: [62, 25], to: [69, 25] },
      { id: 'ar-step-rcb', kind: 'run', from: [62, 40], to: [69, 40] },
      { id: 'ar-step-rb',  kind: 'run', from: [62, 54], to: [69, 54] },
      { id: 'ar-chase', kind: 'run', from: [64, 33], to: [67, 32], opacity: 0.7 },
    ],
    texts: [
      { id: 'tx-offside', at: [65, 34], anchorTo: 'o-9', text: null, size: 's', look: 'halo',
        align: 'center', weight: 'black', tone: 'red' },
      NOTE('tx-rule', [40, 14], 'Offside is not a defence.\nIt is an attack.'),
    ],
  },

  {
    id: 'act-flag',
    title: 'Two metres',
    caption: null,
    push: 'close',
    notes:
      'The pass leaves and the ball runs through into grass that belongs to nobody. He is ' +
      'not thirteen metres out and stranded, he is two metres out and beaten, which is ' +
      'what the trap is for: it is decided by a call and a stride, not by a mistake.',
    pos: {
      'u-gk': [35, 34],
      'u-lb': [70, 12], 'u-lcb': [70, 25], 'u-rcb': [70, 40], 'u-rb': [70, 54],
      'u-lm': [81, 11], 'u-6': [78, 22], 'u-8': [77, 36], 'u-rm': [73, 48],
      'u-9': [87, 22], 'u-10': [83, 38],
      'o-gk': [101, 34],
      'o-rb': [86, 6], 'o-rcb': [91, 27], 'o-lcb': [89, 45], 'o-lb': [86, 60],
      'o-6': [83, 30], 'o-8': [76, 28], 'o-10': [80, 43],
      'o-rw': [77, 4], 'o-9': [68, 31], 'o-lw': [72, 60],
    },
    dim: ['o-9'],
    offside: { caught: ['o-9'] },
    ball: [50, 31],
    bands: [],
    arrows: [
      { id: 'ar-offside-line', kind: 'line', from: [70, 3], to: [70, 63] },
      { id: 'ar-too-late', kind: 'pass', from: [86, 6], to: [52, 30], opacity: 0.5, label: 'too late' },
    ],
    texts: [
      { id: 'tx-offside', at: [64, 31], anchorTo: 'o-9', text: null, size: 'm', look: 'halo',
        align: 'center', weight: 'black', tone: 'red' },
    ],
  },

  {
    id: 'act-risk',
    title: 'Seventy metres, and one goalkeeper',
    caption: null,
    push: 'gentle',
    notes:
      'The price, on its own frame, because a system that only shows what it wins is a ' +
      'sales pitch. There is more grass behind this back four than most sides defend in ' +
      'total, and one man in it. It is not defended by a sweeper. It is defended by a law ' +
      'and by four players agreeing, every single time, on when to move.',
    pos: {
      'u-gk': [35, 33],
      'u-lb': [70, 12], 'u-lcb': [70, 25], 'u-rcb': [70, 40], 'u-rb': [70, 54],
      'u-lm': [79, 12], 'u-6': [77, 23], 'u-8': [76, 37], 'u-rm': [72, 48],
      'u-9': [85, 23], 'u-10': [82, 38],
      'o-gk': [101, 34],
      'o-rb': [86, 8], 'o-rcb': [90, 27], 'o-lcb': [89, 45], 'o-lb': [86, 60],
      'o-6': [83, 31], 'o-8': [76, 29], 'o-10': [80, 44],
      'o-rw': [78, 5], 'o-9': [68, 31], 'o-lw': [72, 60],
    },
    dim: ['o-9'],
    offside: { caught: ['o-9'] },
    ball: [37, 33],
    bands: [{ id: 'bd-behind', kind: 'zone', box: [0, 0, 70, 68], tone: 'grey',
             strength: 'soft', edge: 'dashed', label: null }],
    arrows: [
      { id: 'ar-offside-line', kind: 'line', from: [70, 3], to: [70, 63] },
      { id: 'ar-behind', kind: 'line', from: [3, 64.5], to: [70, 64.5], label: null },
    ],
    texts: [
      { id: 'tx-offside', at: [64, 31], anchorTo: 'o-9', text: null, size: 's', look: 'halo',
        align: 'center', weight: 'black', tone: 'red' },
      NOTE('tx-nobody', [30, 14], 'Nobody is defending it.\nThe law is.'),
    ],
  },

  /* ── CHAPTER SIX · WHAT THE DISTANCE BOUGHT ────────────────────────────── */

  {
    id: 'act-win',
    weHaveBall: true,
    title: 'Or he gives it away',
    caption: null,
    push: 'close',
    notes:
      'The trap has two endings and both of them hand us the ball. This is the one that ' +
      'hurts: the turnover happens in the corner the full-back was pressed into, and the ' +
      'channel he came from has nobody in it. Two strikers, one pass, and the defence is ' +
      'facing its own goal.',
    pos: {
      'u-gk': [35, 34],
      'u-lb': [74, 12], 'u-lcb': [66, 26], 'u-rcb': [66, 38], 'u-rb': [66, 52],
      'u-lm': [82, 12], 'u-6': [76, 26], 'u-8': [72, 38], 'u-rm': [70, 48],
      'u-9': [92, 24], 'u-10': [87, 34],
      'o-gk': [101, 34],
      'o-rb': [84, 6], 'o-rcb': [93, 30], 'o-lcb': [92, 44], 'o-lb': [88, 58],
      'o-6': [81, 30], 'o-8': [71, 20], 'o-10': [77, 45],
      'o-rw': [74, 4], 'o-9': [70, 32], 'o-lw': [67, 60],
    },
    cues: { 'u-9': 'SPARE', 'o-rcb': 'JOCKEY' },
    dim: ['o-rb', 'o-rw', 'o-8', 'o-10', 'o-9', 'o-lw', 'o-6'],
    ball: [82, 12],
    bands: [{ id: 'bd-channel', kind: 'zone', box: [84, 0, 101, 20], tone: 'gold',
             strength: 'normal', edge: 'dashed', label: 'he has gone' }],
    arrows: [
      { id: 'ar-win', kind: 'pass', fromId: 'u-lm', from: [82, 12], to: [91, 23], label: 'first time' },
      { id: 'ar-run-9', kind: 'run', from: [85, 22], to: [91, 24] },
      { id: 'ar-run-10', kind: 'run', from: [81, 36], to: [86, 34] },
    ],
    texts: [NOTE('tx-two', [46, 16], 'Two strikers.\nOne pass.')],
  },

  {
    id: 'act-why',
    weHaveBall: true,
    title: 'That is what the distance bought',
    caption: null,
    push: 'close',
    notes:
      'The argument for the whole system, in one number. A side that wins the ball on its ' +
      'own edge of the box has to play through a set defence to hurt anybody. A side that ' +
      'wins it here is already in a shooting position, against a back four running the ' +
      'wrong way. Sacchi never called this a defensive system, and it is not one.',
    pos: {
      'u-gk': [35, 34],
      'u-lb': [76, 12], 'u-lcb': [68, 26], 'u-rcb': [68, 38], 'u-rb': [68, 52],
      'u-lm': [84, 14], 'u-6': [78, 27], 'u-8': [74, 38], 'u-rm': [72, 48],
      'u-9': [93, 22], 'u-10': [87, 36],
      'o-gk': [101, 34],
      'o-rb': [86, 8], 'o-rcb': [93, 32], 'o-lcb': [93, 45], 'o-lb': [89, 58],
      'o-6': [84, 28], 'o-8': [73, 20], 'o-10': [79, 45],
      'o-rw': [76, 4], 'o-9': [72, 32], 'o-lw': [69, 60],
    },
    cues: { 'u-9': 'SPARE' },
    dim: ['o-rb', 'o-rw', 'o-8', 'o-10', 'o-9', 'o-lw'],
    ball: [93, 22],
    bands: [{ id: 'bd-final', kind: 'zone', box: [88, 14, 101, 30], tone: 'gold',
             strength: 'normal', edge: 'dashed', label: null }],
    arrows: [{ id: 'ar-shot', kind: 'pass', from: [93, 22], to: [103, 32], label: null }],
    texts: [NOTE('tx-why', [44, 14], 'Win it there and it is\nalready a chance.')],
  },
]

/* ── the numbers the copy claims, measured rather than asserted ──────────── */

const at = (id) => PHASES[PHASES.findIndex((p) => p.id === id)]
const lineOf = (ph) => Math.min(...BACK_FOUR.map((k) => ph.pos[k][0]))
const arrowOf = (ph, id) => ph.arrows.find((a) => a.id === id)
const textOf = (ph, id) => ph.texts.find((t) => t.id === id)

const f = {}
f.block = Math.round(at('act-25m').pos['u-9'][0] - at('act-25m').pos['u-lcb'][0])
f.oldBlock = Math.round(at('act-45m').pos['u-9'][0] - at('act-45m').pos['u-lcb'][0])
f.line = Math.round(lineOf(at('act-25m')))
f.across = Math.round(dist(arrowOf(at('act-move-as-one'), 'ar-across').from, arrowOf(at('act-move-as-one'), 'ar-across').to))
f.switch = Math.round(dist(arrowOf(at('act-concede'), 'ar-switch').from, arrowOf(at('act-concede'), 'ar-switch').to))
f.lands = Math.round(dist(arrowOf(at('act-switch-arrives'), 'ar-switch').from, arrowOf(at('act-switch-arrives'), 'ar-switch').to))
f.slide = Math.round(dist(arrowOf(at('act-switch-arrives'), 'ar-travel-rm').from, arrowOf(at('act-switch-arrives'), 'ar-travel-rm').to))
f.onsideBy = Math.round(at('act-goes-long').pos['o-9'][0] - lineOf(at('act-goes-long')))
f.step = Math.round(lineOf(at('act-line-steps')) - lineOf(at('act-goes-long')))
f.offsideBy = Math.round(lineOf(at('act-flag')) - at('act-flag').pos['o-9'][0])
f.behind = Math.round(lineOf(at('act-risk')))
f.toGoal = Math.round(dist(at('act-win').ball, [L, W / 2]))
f.shot = Math.round(dist(at('act-why').ball, [L, W / 2]))

at('act-25m').arrows[0].label = `${f.block} metres`
at('act-25m').bands[0].label = `the block: ${f.block} metres`
at('act-45m').arrows[0].label = `${f.oldBlock} metres`
at('act-45m').caption = `Everybody else defended ${f.oldBlock} metres. Sacchi refused to defend more than ${f.block}.`
arrowOf(at('act-move-as-one'), 'ar-across').label = `${f.across} metres`
at('act-move-as-one').caption = `The ball moves ${f.across} metres. All eleven move it with it.`
at('act-concede').caption = `The switch is the only ball out. It is ${f.switch} metres, first time, with a man on him.`
at('act-switch-arrives').caption = `The ball travels ${f.lands} metres. The block travels ${f.slide}, and gets there first.`
textOf(at('act-goes-long'), 'tx-onside').text = `ONSIDE\nBY ${f.onsideBy}`
at('act-line-steps').caption = `The four go together. ${f.step} metres, on one call, before the ball is struck.`
for (const id of ['act-line-steps', 'act-flag', 'act-risk'])
  textOf(at(id), 'tx-offside').text = `OFFSIDE\nBY ${f.offsideBy}`
at('act-flag').caption = `At the moment the pass leaves, he is ${f.offsideBy} metres the wrong side of it.`
arrowOf(at('act-risk'), 'ar-behind').label = `${f.behind} metres`
at('act-risk').caption = `${f.behind} metres behind the line, and one goalkeeper in it. That is the price.`
at('act-win').caption = `The ball is won ${f.toGoal} metres from his goal. That is what the ${f.block} metres bought.`
arrowOf(at('act-why'), 'ar-shot').label = `${f.shot} metres`
at('act-why').caption = `Won ${f.toGoal} metres out. One pass later it is a shot from ${f.shot}.`

/* ── the check. It collects, and every fault carries its fix ─────────────── */

const MIN = 5.5              // two counters at rest
const DUEL_MIN = 2.4         // ... unless the phase declares them a duel
const LABEL_CLEAR = 6        // a label anchor, from any counter
const ATTACH_MIN = 2.5, ATTACH_MAX = 5   // ... unless it is anchorTo a man
const OFFSIDE_MIN = 1.5, OFFSIDE_MAX = 3.5  // a trap reads at two metres, not thirteen
const MAX_MARGIN = 0.35, MIN_SPAN_X = 0.6, MIN_SPAN_Y = 0.72
const KEEPER_MAX = 35        // no goalkeeper stands further off his line than this
const BOX_EDGE = 88.5        // their penalty area starts here

const faults = []
const ids = Object.keys(LABEL)
const bandLabelAt = (box) => [(box[0] + box[2]) / 2, box[1] + 2.4]

PHASES.forEach((ph, n) => {
  const where = `phase ${n + 1} (${ph.id})`
  const list = Object.entries(ph.pos)

  for (const id of ids) if (!(id in ph.pos)) faults.push(`${where}: missing token ${id}`)
  for (const id of Object.keys(ph.pos)) if (!ids.includes(id)) faults.push(`${where}: unknown token ${id}`)

  /* ── DOES EACH MAN STAND WHERE HIS JOB STANDS ─────────────────────────── */

  const ourGk = ph.pos['u-gk'][0], theirGk = ph.pos['o-gk'][0]
  if (ourGk > KEEPER_MAX)
    faults.push(`${where}: our keeper is ${ourGk}m off his own line, max ${KEEPER_MAX}. Pull u-gk back to [${KEEPER_MAX}, ${ph.pos['u-gk'][1]}].`)
  if (L - theirGk > KEEPER_MAX)
    faults.push(`${where}: their keeper is ${(L - theirGk).toFixed(0)}m off his line, max ${KEEPER_MAX}. Push o-gk to [${L - KEEPER_MAX}, ${ph.pos['o-gk'][1]}].`)

  const ourLine = lineOf(ph)
  if (ourGk > ourLine - 10)
    faults.push(`${where}: our keeper (${ourGk}m) is within 10m of his own back line (${ourLine}m). Pull u-gk back to [${r2(ourLine - 15)}, ${ph.pos['u-gk'][1]}].`)
  if (ourLine > 72)
    faults.push(`${where}: our back line is ${ourLine}m up the pitch, past anything a back four does. Cap it near 70.`)

  /* Where a back four stands depends on who has the ball. While they are
     building, their centre-backs work off their own box edge; once we have won
     it they are retreating into it, which is the point of the last two acts. */
  const theirLine = Math.max(...['o-rcb', 'o-lcb'].map((k) => ph.pos[k][0]))
  const capThem = ph.weHaveBall ? 96 : BOX_EDGE + 3
  if (theirLine > capThem)
    faults.push(`${where}: their centre-backs are at ${theirLine}m, max ${capThem} ` +
                `(${ph.weHaveBall ? 'retreating, but not onto their own keeper' : 'building, and their box edge is ' + BOX_EDGE + 'm'}). ` +
                `Pull o-rcb / o-lcb back to ${capThem}m.`)

  /* ── OFFSIDE. Declared, or it is a bug ────────────────────────────────── */

  const beyond = list
    .filter(([id, p]) => id.startsWith('o-') && id !== 'o-gk' && p[0] < ourLine - 0.01)
    .map(([id]) => id)
  const caught = ph.offside?.caught ?? []
  for (const id of beyond)
    if (!caught.includes(id))
      faults.push(`${where}: ${id} stands at ${ph.pos[id][0]}m, ${(ourLine - ph.pos[id][0]).toFixed(1)}m beyond our back line at ${ourLine}m, ` +
                  `and this phase does not call him offside. Either push ${id} to [${r2(ourLine + 2)}, ${ph.pos[id][1]}] or add him to offside.caught.`)
  for (const id of caught) {
    if (!beyond.includes(id)) {
      faults.push(`${where}: ${id} is called offside but stands at ${ph.pos[id][0]}m, level with or behind our line at ${ourLine}m. ` +
                  `Pull ${id} back to [${r2(ourLine - 2)}, ${ph.pos[id][1]}].`)
      continue
    }
    const by = ourLine - ph.pos[id][0]
    if (by < OFFSIDE_MIN || by > OFFSIDE_MAX)
      faults.push(`${where}: ${id} is ${by.toFixed(1)}m offside. A trap has to read as a stride, not an abandonment, so ${OFFSIDE_MIN}..${OFFSIDE_MAX}m. ` +
                  `Move ${id} to [${r2(ourLine - 2)}, ${ph.pos[id][1]}].`)
  }
  if (ph.offside) {
    const drawn = ph.arrows.find((a) => a.id === 'ar-offside-line')
    if (!drawn) faults.push(`${where}: declares an offside line but never draws one. Add a 'line' arrow id ar-offside-line at x=${ourLine}.`)
    else if (Math.abs(drawn.from[0] - ourLine) > 0.01 || Math.abs(drawn.to[0] - ourLine) > 0.01)
      faults.push(`${where}: ar-offside-line is drawn at x=${drawn.from[0]}/${drawn.to[0]} but the back line is at ${ourLine}m. Redraw it from [${ourLine}, ${drawn.from[1]}] to [${ourLine}, ${drawn.to[1]}].`)
  }

  /* ── SEPARATION ───────────────────────────────────────────────────────── */

  for (const [id, [mx, my]] of list)
    if (mx < 1.5 || mx > L - 1.5 || my < 1.5 || my > W - 1.5)
      faults.push(`${where}: ${id} at (${mx}, ${my}) is off the pitch, or inside 1.5m of a line`)

  const duels = new Set((ph.duels ?? []).map(([a, b]) => [a, b].sort().join('|')))
  for (const [a, b] of ph.duels ?? [])
    if (!(a in ph.pos) || !(b in ph.pos)) faults.push(`${where}: duel names a token that is not on this phase (${a}, ${b})`)
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [a, pa] = list[i], [b, pb] = list[j]
      const d = dist(pa, pb)
      const isDuel = duels.has([a, b].sort().join('|'))
      const floor = isDuel ? DUEL_MIN : MIN
      if (d < floor) {
        const need = floor - d
        const to = [r2(pb[0] + ((pb[0] - pa[0]) / d) * need), r2(pb[1] + ((pb[1] - pa[1]) / d) * need)]
        faults.push(`${where}: ${a} and ${b} are ${d.toFixed(2)}m apart, min ${floor}${isDuel ? ' (declared duel)' : ''}. Move ${b} to [${to[0]}, ${to[1]}].`)
      }
    }

  /* ── DOES THE PICTURE FILL THE FRAME ──────────────────────────────────── */

  const xs = list.map(([, p]) => p[0]).concat(ph.ball[0])
  const ys = list.map(([, p]) => p[1]).concat(ph.ball[1])
  const lo = [Math.min(...xs), Math.min(...ys)], hi = [Math.max(...xs), Math.max(...ys)]
  const margins = {
    left: (lo[0] - VIEW.x0) / VW, right: (VIEW.x1 - hi[0]) / VW,
    top: (lo[1] - VIEW.y0) / VH, bottom: (VIEW.y1 - hi[1]) / VH,
  }
  for (const [side, m] of Object.entries(margins))
    if (m > MAX_MARGIN)
      faults.push(`${where}: ${(m * 100).toFixed(0)}% of the frame is empty on the ${side}, max ${MAX_MARGIN * 100}%. ` +
                  `Content runs ${lo[0].toFixed(0)}..${hi[0].toFixed(0)}m x ${lo[1].toFixed(0)}..${hi[1].toFixed(0)}m.`)
  if ((hi[0] - lo[0]) / VW < MIN_SPAN_X) faults.push(`${where}: players use only ${(((hi[0] - lo[0]) / VW) * 100).toFixed(0)}% of the pitch length, min ${MIN_SPAN_X * 100}%`)
  if ((hi[1] - lo[1]) / VH < MIN_SPAN_Y) faults.push(`${where}: players use only ${(((hi[1] - lo[1]) / VH) * 100).toFixed(0)}% of the pitch width, min ${MIN_SPAN_Y * 100}%`)

  /* ── LABEL ANCHORS. Fixed by Overlays.tsx, so they are geometry ───────── */

  const anchors = []
  for (const b of ph.bands) if (b.label) anchors.push([`band ${b.id}`, bandLabelAt(b.box), b.label, null])
  for (const a of ph.arrows) if (a.label) anchors.push([`arrow ${a.id}`, mid(a.from, a.to), a.label, null])
  for (const t of ph.texts ?? []) anchors.push([`text ${t.id}`, t.at, t.text, t.anchorTo ?? null])
  for (const [what, anchor, txt, attach] of anchors) {
    const first = String(txt).split('\n')[0]
    if (attach) {
      const p = ph.pos[attach]
      if (!p) { faults.push(`${where}: ${what} is anchored to ${attach}, who is not on this phase`); continue }
      const d = dist(anchor, p)
      if (d < ATTACH_MIN || d > ATTACH_MAX)
        faults.push(`${where}: ${what} ("${first}") is attached to ${attach} but sits ${d.toFixed(1)}m from him, want ${ATTACH_MIN}..${ATTACH_MAX}m. ` +
                    `Put it at [${r2(p[0] - 4)}, ${p[1]}].`)
    }
    for (const [id, p] of list) {
      if (id === attach) continue
      const d = dist(anchor, p)
      if (d < LABEL_CLEAR)
        faults.push(`${where}: ${what} ("${first}") anchors ${d.toFixed(1)}m from ${id}. ` +
                    `Move it ${(LABEL_CLEAR - d).toFixed(1)}m clear, or drop the label.`)
    }
    if (anchor[0] < 0 || anchor[0] > L || anchor[1] < 0 || anchor[1] > W) faults.push(`${where}: ${what} anchors off the pitch`)
  }

  for (const b of ph.bands) {
    const [x0, y0, x1, y1] = b.box
    if (x1 <= x0 || y1 <= y0) faults.push(`${where}: band ${b.id} has a box with no area`)
    if (x0 < 0 || y0 < 0 || x1 > L || y1 > W) faults.push(`${where}: band ${b.id} runs off the pitch`)
  }
  for (const a of ph.arrows)
    if (dist(a.from, a.to) < 2) faults.push(`${where}: arrow ${a.id} is ${dist(a.from, a.to).toFixed(1)}m long and will not read. Give it at least 2m.`)

  const markIds = [...ph.bands, ...ph.arrows, ...(ph.texts ?? [])].map((m) => m.id)
  const dupe = markIds.find((v, i) => markIds.indexOf(v) !== i)
  if (dupe) faults.push(`${where}: two marks share the id "${dupe}"`)

  for (const k of ['caption', 'notes', 'title'])
    if (typeof ph[k] === 'string' && ph[k].includes('—'))
      faults.push(`${where}: ${k} contains an em dash, which is banned in rendered copy.`)
  for (const t of ph.texts ?? []) if (String(t.text).includes('—')) faults.push(`${where}: text ${t.id} contains an em dash.`)
})

const actIds = PHASES.map((p) => p.id)
const dupAct = actIds.find((v, i) => actIds.indexOf(v) !== i)
if (dupAct) faults.push(`two phases share the id "${dupAct}"`)
if (f.block !== 25) faults.push(`the block measures ${f.block}m but the system is called 25 Metres`)
if (f.step !== 8) faults.push(`the line steps ${f.step}m but the copy says 8`)

if (faults.length) {
  console.error(`\n${faults.length} fault(s):\n`)
  for (const x of faults) console.error('  - ' + x)
  console.error('')
  process.exit(1)
}

/* ── emit ───────────────────────────────────────────────────────────────── */

const acts = PHASES.map((ph) => {
  const ball = { id: 'ball-1', ...P(ph.ball[0], ph.ball[1]) }
  const act = {
    id: ph.id,
    title: ph.title,
    caption: ph.caption,
    notes: ph.notes,
    tokens: ids.map((id) => {
      const t = { id, ...P(...ph.pos[id]), label: LABEL[id], side: SIDE(id) }
      if (ph.cues?.[id]) t.cue = ph.cues[id]
      if (ph.dim?.includes(id)) t.dim = true
      return t
    }),
    ball: { x: ball.x, y: ball.y },
    balls: [ball],
    arrows: ph.arrows.map((a) => {
      const o = { id: a.id, kind: a.kind, from: P(...a.from), to: P(...a.to) }
      if (a.fromId) o.fromId = a.fromId
      if (a.toId) o.toId = a.toId
      if (a.bend !== undefined) o.bend = a.bend
      if (a.opacity !== undefined) o.opacity = a.opacity
      if (a.label) o.label = a.label
      return o
    }),
    bands: ph.bands.map((b) => {
      const o = { id: b.id, kind: b.kind, rect: rect(...b.box) }
      for (const k of ['tone', 'strength', 'edge', 'label']) if (b[k]) o[k] = b[k]
      return o
    }),
    texts: (ph.texts ?? []).map((t) => {
      const o = { id: t.id, ...P(...t.at), text: t.text }
      for (const k of ['size', 'look', 'align', 'weight', 'tone']) if (t[k]) o[k] = t[k]
      return o
    }),
  }
  if (ph.push) act.push = ph.push
  return act
})

const system = {
  v: 1,
  title: "Sacchi's 25 Metres",
  subtitle: 'How Milan pressed: one distance, one trigger, one trap',
  folder: 'Defence',
  pitch: VIEW.id,
  grid: 'thirds',
  gridOpacity: 0.35,
  surface: 'night',
  matchBall: 'trionda',
  camera: 'follow',
  push: 'gentle',
  hold: 0,
  move: 1000,
  keepShape: true,
  teams: {
    us: { name: 'Milan', base: '#371A94', deep: '#2b1473', text: '#FFFFFF' },
    them: { name: 'Opposition', base: '#E2473B', deep: '#B5392F', text: '#FFFFFF' },
  },
  credit: { presenter: 'MORIYASHU', team: 'JAPAN FC', note: "Arrigo Sacchi's Milan, 1987-1991" },
  acts,
}

const out = process.argv[2] ?? 'content/systems/sacchis-25-metres.json'
writeFileSync(out, JSON.stringify(system, null, 2) + '\n')

const secs = ((system.hold + system.move) * acts.length) / 1000
console.log(`OK - ${acts.length} phases, ${ids.length} tokens each, on the ${VIEW.id} pitch. No faults.`)
console.log(`  runtime ${secs}s at hold ${system.hold} / move ${system.move}`)
console.log(`  block ${f.block} m (they defended ${f.oldBlock}) - back line ${f.line} m, halfway is 52.5`)
console.log(`  square ball ${f.across} m - switch ${f.switch} m, lands after ${f.lands}, block travels ${f.slide}`)
console.log(`  onside by ${f.onsideBy} - line steps ${f.step} - offside by ${f.offsideBy} - ${f.behind} m behind`)
console.log(`  turnover ${f.toGoal} m from goal, shot from ${f.shot} m`)
console.log(`  our keeper: ${PHASES.map((p) => p.pos['u-gk'][0]).join(', ')} m off his line`)
console.log(`  our back line: ${PHASES.map((p) => lineOf(p)).join(', ')} m`)
