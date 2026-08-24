/**
 * Every word of guidance in the studio, in one file.
 *
 * It lives together rather than scattered through the JSX for two reasons. The
 * first is that this copy is the product: the tool works, and the thing
 * stopping a 55-year-old coach from getting a presentation out of it is that
 * nobody told them what an act is. The second is that guidance drifts. Hints
 * written next to the control they describe get edited when the control moves
 * and forgotten when it does not, and a tool that explains itself wrongly is
 * worse than one that says nothing.
 *
 * THE RULES THIS COPY FOLLOWS, and they are worth keeping:
 *
 *  · Say what it does, not what it is. "Fills the space your back four are
 *    protecting" beats "adds a block band".
 *  · No editor vocabulary. No canvas, layer, keyframe, object, element, asset.
 *    An Act is a PHASE, because coaches already say "phase of play". The type
 *    is still called `Act` in the code — see PHASE below.
 *  · Assume football fluency and zero software fluency. "A ball played from one
 *    player to another" needs no explanation; "drag" does.
 *  · Second person, present tense, no exclamation marks.
 */

/**
 * What an Act is called in front of a coach.
 *
 * The code says Act everywhere and will keep saying Act — it is the right word
 * for the thing (a pose in a sequence), it is what schema.ts is written around,
 * and renaming a type across a document format to win a label is a bad trade.
 * This constant is the boundary between the two vocabularies. Anything a coach
 * reads goes through it; nothing else should.
 */
export const PHASE = {
  one: 'phase',
  One: 'Phase',
  many: 'phases',
  Many: 'Phases',
} as const

// ── the welcome walkthrough ──────────────────────────────────────────────────

export interface WalkStep {
  id: string
  title: string
  /** Paragraphs. Kept short — this is read standing up, once. */
  body: string[]
}

/**
 * Five screens, shown once.
 *
 * Step 2 is the only one that matters. Everything else in the studio is
 * discoverable by poking at it; the idea that you build the SAME board twice
 * and we work out the animation from the difference is not, and a coach who
 * misses it will build eleven separate slides and wonder why nothing moves.
 */
export const WALKTHROUGH: WalkStep[] = [
  {
    id: 'board',
    title: 'This is your board',
    body: [
      'The counters are your players. Pick one up and put it where you want it, the same as sliding a magnet across a whiteboard.',
      'Everything else on the left picks football: which part of the pitch you are looking at, what shape your team lines up in, what colour they play in.',
    ],
  },
  {
    id: 'phases',
    title: 'A phase is a moment, not a slide',
    body: [
      'Set the players up the way the move starts. That is phase one.',
      'Then add a phase. You get the same board again, and you move the players to where they end up.',
      'You never draw the movement. We work it out from the difference between the two, and that is what you get back as film.',
    ],
  },
  {
    id: 'marks',
    title: 'Say what you mean, not how to draw it',
    body: [
      'Pick Pass, Run, Carry, Press or Switch, then drag on the board from where it starts to where it finishes.',
      'You choose the intention. We choose the line, the arrowhead and the colour, so every board you make looks like the ones on the channel.',
    ],
  },
  {
    id: 'play',
    title: 'Press Play to see it move',
    body: [
      'Once you have two phases, Play runs them in order and shows you the real thing, with the same timing and the same easing as the videos.',
      'Nothing is exported yet. Play as often as you like while you get it right.',
    ],
  },
  {
    id: 'saved',
    title: 'It saves itself',
    body: [
      'Every change is kept on this computer as you make it. You can close the tab and come back to it.',
      'The step-by-step list on the right walks you through your first system. You can reopen this guide any time from the ? button at the top.',
    ],
  },
]

// ── the step-by-step rail ────────────────────────────────────────────────────

export interface RailStep {
  id: 'moved' | 'named' | 'phased' | 'drew' | 'played'
  /** One line, imperative. This is what shows when the step is done. */
  label: string
  /** The fuller version, shown only while this is the step they are on. */
  detail: string
}

export const RAIL_STEPS: RailStep[] = [
  {
    id: 'moved',
    label: 'Move a player',
    detail:
      'Press and hold any counter and drag it across the pitch. Start by putting your side where the move begins.',
  },
  {
    id: 'named',
    label: 'Name your system',
    detail:
      'Type a name in the box at the top left: "Beating a low block", "Pressing from the front". It goes on the front of the finished deck.',
  },
  {
    id: 'phased',
    label: `Add a second ${PHASE.one}`,
    detail: `Press + Add ${PHASE.one} at the bottom. You get a copy of what is on the board now. Move the players to where the ball takes them, and the movement between the two is worked out for you.`,
  },
  {
    id: 'drew',
    label: 'Draw a pass or a run',
    detail:
      'Pick Pass at the top, then drag on the pitch from the player with the ball to where it is going. Run, Carry, Press and Switch work the same way.',
  },
  {
    id: 'played',
    label: 'Press Play',
    detail: `With two ${PHASE.many} on the board, Play runs the whole thing through so you can see the movement as your players will.`,
  },
]

// ── the mark vocabulary ──────────────────────────────────────────────────────

/**
 * What each drawing tool means, and when a coach would reach for it.
 *
 * The tools were the most-praised and least-understood part of the studio: five
 * arrows and two shaded areas, all of which draw the same way and none of which
 * said what they were FOR. A coach can guess that "Pass" draws a passing arrow;
 * they cannot guess that a switch is meant for the one ball that moves the whole
 * opposition, and without that they use `pass` for everything and the board
 * loses the grammar that makes it read.
 *
 * So every tool carries three lines:
 *
 *  · `what` — what the mark means on the board. One sentence.
 *  · `when` — when to reach for it, phrased as a recommendation. This is the
 *    line that earns its place; it is the coaching, not the software.
 *  · `drag` — the physical instruction, shown under the board while the tool is
 *    armed, because at that moment the only question is "now what".
 */
export interface ToolDoc {
  label: string
  what: string
  when: string
  drag: string
}

/** Keyed by the editor's `Tool` union. Order here is the order in the UI. */
export const TOOL_DOC = {
  select: {
    label: 'Move',
    what: 'Pick counters up and put them down. The state everything else returns to.',
    when: 'Between everything else. Click a counter to rename it, click an arrow or a shaded area to select it, and press Delete to take it off.',
    drag: 'Drag a counter to move it. Click any mark to select it.',
  },
  pass: {
    label: 'Pass',
    what: 'A ball played from one player to another.',
    when: 'Use one per pass, and let the chain of them tell the story of the move. If the ball travels, it is a pass.',
    drag: 'Drag from the player with the ball to the player receiving it.',
  },
  run: {
    label: 'Run',
    what: 'A player moving without the ball. Drawn as a dashed line.',
    when: 'Use it for the runs that make the pass possible: the winger in behind, the full-back overlapping, the striker dragging a centre-back away.',
    drag: 'Drag from where the player starts to where the run finishes.',
  },
  carry: {
    label: 'Carry',
    what: 'A player travelling with the ball at their feet. Drawn as a squiggle.',
    when: 'Use it when the point is that nobody passes: the centre-back stepping into midfield, the winger taking someone on.',
    drag: 'Drag from where they pick the ball up to where they let it go.',
  },
  press: {
    label: 'Press',
    what: 'Pressure going on to the ball.',
    when: 'Use it out of possession, to show who goes and, just as important, from which angle they approach.',
    drag: 'Drag from the player pressing towards the ball they are going after.',
  },
  switch: {
    label: 'Switch',
    what: 'A long ball that changes the side of the pitch.',
    when: 'Save it for the one ball that moves the whole opposition. If every pass is a switch, none of them reads as one.',
    drag: 'Drag right across the board, from one flank to the other.',
  },
  block: {
    label: 'Block',
    what: 'Threads a line through the players you pick and shades their space: back to the goal they are defending, or closed around the players themselves.',
    when: 'Use it for any unit that holds a line together: the back four, a midfield screen, the two who stay when the full-backs go. "Our block" works the deepest one out for you; this is for every other one.',
    drag: 'Click the players in order along the line, then press Enter. Click one again to take it back out.',
  },
  danger: {
    label: 'Danger area',
    what: 'Shades an area in gold: the space the move is trying to reach.',
    when: 'Use it for the space you want attacked: the cutback zone, the pocket in front of their back four, the far post.',
    drag: 'Drag a box around the area you want to talk about.',
  },
  zone: {
    label: 'Zone',
    what: 'Shades an area in a neutral grey.',
    when: 'Use it for a channel to protect, a trap you are setting, or the space you are giving up on purpose.',
    drag: 'Drag a box around the area you want to talk about.',
  },
} as const satisfies Record<string, ToolDoc>

export type ToolId = keyof typeof TOOL_DOC

/** The arrow tools, in toolbar order. The two shaded areas live with the block. */
export const ARROW_TOOL_IDS = ['pass', 'run', 'carry', 'press', 'switch'] as const
export const ZONE_TOOL_IDS = ['danger', 'zone'] as const

// ── control hints ────────────────────────────────────────────────────────────

/**
 * One hint per control. Keys are named for the control, not for the panel, so
 * moving a control between panels does not orphan its hint.
 */
export const HINT = {
  title:
    'What this system is called. It goes on the front of the deck and in your list of saved systems.',

  play: `Runs your ${PHASE.many} in order so you can watch the movement. You need two ${PHASE.many} before there is anything to watch.`,
  stop: 'Stop and go back to editing.',
  video: 'Saves the whole thing as a video file you can post. Made here on your machine, so nothing is uploaded.',
  help: 'Reopen the welcome guide.',
  news: 'Everything that has been added to the studio, newest first. It opens on its own when there is something on it you have not seen.',

  undo: 'Takes back the last thing you changed. Nothing you do here is permanent: move things, try it, take it back.',
  redo: 'Puts back the change you just took away.',
  theme: 'Changes the room you are working in: day, night, or one of the two pitch skins. It only changes these panels. What the pitch is drawn on is set under Pitch, and that is the part everyone else sees.',
  reset: `Empties this system and starts you again with a fresh board and one ${PHASE.one}. Undo brings it all back if you press it by mistake.`,

  pitchView:
    'How much of the pitch you are looking at. Changing it does not move anybody: everyone stays on the same patch of grass, you just see more or less of it.',
  pitchFit:
    'A close-up view cannot hold two full teams, so a shape placed on one puts in the players that part of the pitch is actually about and leaves the rest out. Everyone else is still in your system, and comes back when you widen the view.',
  pace:
    'How long each phase stands still before it moves on. Bring it down and the whole thing plays quicker — the film, the share link and Play, all together, because the speed belongs to the system rather than to whoever is watching it. The move between phases is not shortened: that is the part carrying the football.',

  camera:
    'Whether the film moves. Fixed shows the whole pitch view in every phase, which is what a coach draws on a whiteboard. Follow the ball pushes in on whatever each phase is about — the ball, your arrows, anyone you have given a role cue — and travels between them, the way the videos are shot. It changes nothing on the board: nobody moves, and you can still see everyone while you work.',

  ball:
    'Which match ball sits on the board. Choose one for the era you are teaching: the 1974 Telstar for a Total Football session, the 2026 Trionda for anything current.',
  surface:
    'What the pitch is drawn on. Paper is what the videos use and what prints best. Broadcast and Night look like a match on television, which reads well on a screen in a dark room. This travels with the system, so everyone you send it to sees the pitch you chose.',

  formationUs:
    'Lines your eleven up in this shape. It replaces where they are standing right now, so pick the shape before you start moving people.',
  formationThem:
    'The shape you are playing against. Useful when the lesson is about where their players are, rather than only where yours are.',
  replace:
    'Puts everybody back on their formation position, on this phase only. Your names, cues and fades are kept.',
  colourUs: 'Your kit colour. The counter labels switch between white and black on their own so they stay readable.',
  colourThem: 'Their kit colour. Pick something well clear of yours.',
  opposition: 'Puts eleven opposition players on the board. Turn it off and your own shape spreads out to use the whole pitch.',

  labels: 'What is printed on the counters: the position they play, or their shirt number.',

  addPlayer:
    'Drops one more counter in the middle of the pitch, on this phase. For a twelfth man, a coach, or a shape that is not eleven a side.',
  clearPitch: 'Takes every player off this phase. The pitch, the arrows and the zones stay.',
  ballToggle: 'Puts the ball on the pitch, or takes it off. Drag it wherever the move needs it.',

  /**
   * The block. The old copy described the drawing; this one describes the
   * mechanism, because "why did it shade all the way to the goal" was the
   * question it kept failing to answer.
   */
  block:
    'Finds your deepest line (a back three, four or five, whichever you have on the board) and shades everything between them and the goal they are protecting. It is tied to those players, so it reshapes as you drag them.',
  blockThem:
    'The same shading for the opposition: their deepest line, and the space in front of the goal they are defending. Use it to show what your team is playing into.',
  blockRedraw:
    'Works the line out again from where the players are standing now. Do it after you have moved your back line, or after you have changed shape.',
  blockDraw:
    'Pick the players yourself, in the order they stand along the line, and it shades their space. Use it for a midfield screen, a front two pressing together, or any line the automatic one will not find. It stays tied to those players, so it moves when they do.',
  blockPicking:
    'Click each player in the line, then press Enter to draw it. Click a player again to take them back out, press the grass to finish, or press Escape to forget the whole thing.',
  /**
   * The control that answers "why did it shade half the pitch". Written as the
   * two football situations rather than as two geometries, because a coach
   * picking a front three is not thinking about polygons.
   */
  blockClose:
    'What gets shaded. To the goal fills everything between the players and the goal behind them, which is what a block is: a back four, a low block, anyone holding a line in front of their own net. Around them closes the shading round the players themselves, which is what you want for a midfield screen or a front three pressing. Those are not protecting the goal, and shading back to it swallows your own team.',

  bandLabel:
    'A few words written into the area itself: "cutback zone", "trap here", "second ball". Leave it empty and the shading speaks for itself.',
  bandTone:
    'What colour it is shaded. The first five already mean something on our boards, so picking one is really picking what you are saying: gold is the space to attack, red is danger, green is ours, blue is neutral, grey is quiet. Violet, orange, teal and pink claim nothing. They are there for the board that needs a fourth and a fifth area told apart.',
  bandStrength:
    'How heavily it is laid down. Soft for an area you are only gesturing at, strong for the one thing the phase is about. Every shading stays see-through: the players underneath always read.',
  bandShape:
    'A box for a space with edges, a rounded box for one in open play, an oval for a pocket. Coaches draw pockets as circles on a whiteboard, so an oval reads as one instantly.',
  bandEdge:
    'The line round it. Dashed says "this region, roughly". Solid says the edge is real: a zone that stops where the six-yard box stops. None takes the line away and leaves the shading to say it, which reads better over a busy part of the pitch.',
  bandFill:
    'Shaded fills the area in. Outline leaves the grass showing and draws only the border round it. Line only removes the border and the shading entirely, leaving just the line threaded through the players — best when the line itself is the point. You can still click anywhere inside to pick it up.',
  bandString:
    'The thick line threaded through the players a block runs through. It is what says they are one unit rather than several men who happen to be near each other. Turn it off when the space is the point and the line is in the way.',
  bandCorner:
    'How tightly the shading wraps the players. Tight hugs them, loose reads as a ring drawn round the group. Only applies to a block that shades around its players.',
  bandMove:
    'Drag inside it to move it, or take a gold corner to resize it. Only the area you have selected shows its handles.',

  marks:
    'Everything you have drawn on this phase. Click one to pick it out on the board, or remove it on its own without clearing the rest.',
  deleteMark: 'Removes this one mark. Everything else stays.',
  clearArrows: 'Removes every arrow from this phase.',
  clearZones: 'Removes every shaded area from this phase.',

  phaseTitle: `A short name for this moment: "The trigger", "The switch". It shows under the board and in the strip of ${PHASE.many}.`,
  phaseCaption: 'One line explaining what is happening, in the words you would use to the group.',
  phaseNotes:
    'The longer version, for the printed page rather than the room: the coaching points, the triggers, what you want them watching for. Leave it empty and nothing shows.',

  share:
    'Makes a link to the finished thing. Whoever opens it sees your board play through, on a phone or a laptop, with no account and nothing to install.',
  addPhase: `Copies this ${PHASE.one} and adds it after. Move the players on the copy, and the movement between the two becomes the animation.`,
  deletePhase: `Removes this ${PHASE.one}. The others close up around it.`,
  prevPhase: `Goes back to the ${PHASE.one} before this one. Nothing is changed or moved: you are just looking at a different moment.`,
  nextPhase: `Goes on to the next ${PHASE.one}. The left and right arrow keys do the same thing.`,
  movePhaseBack: `Reorders your ${PHASE.many}: this one changes places with the one before it, so it happens earlier in the move.`,
  movePhaseOn: `Reorders your ${PHASE.many}: this one changes places with the one after it, so it happens later in the move.`,

  playerLabel: 'What is printed on the counter. Up to four characters: CB, 6, GK.',
  playerName: "The player's name, printed above the counter. Leave it blank for a shape nobody is named in.",
  playerCue:
    'A live instruction under the counter: PRESS, COVER, BALANCE. Set it on the phase where the job changes and you can show a role being handed over.',
  playerDim:
    'Greys this player back so the eye goes to the ones the phase is about. They are still on the pitch.',
  playerRemove: `Takes this player off this ${PHASE.one} only. They stay on the others.`,
} as const

// ── sharing ──────────────────────────────────────────────────────────────────

/**
 * The share dialog.
 *
 * Two things this copy has to do. Say what the person on the other end gets, in
 * one line, because "share" means fifteen different things across the apps a
 * coach already uses. And explain the link honestly: it carries the whole
 * system inside itself, which is why it is long, why it keeps working, and why
 * nothing they build is sitting on a server of ours waiting to be found.
 */
export const SHARE = {
  title: 'Send it to someone',
  body: 'They get your board, playing through every phase in order, with your captions under it. It opens in any browser, with no account and nothing to install.',
  publishing: 'Putting it up…',
  live: 'This link stays the same. Change something and press Share again, and everyone you sent it to sees the new version.',
  /**
   * Shown only when publishing failed and they have the self-contained link.
   * It says what is different rather than apologising: this one is long, and
   * unlike the short one it is a snapshot rather than something that updates.
   */
  fallback:
    'We could not reach the server, so this is the long version of the link: it carries your whole system inside it. It works exactly the same, but it is a copy: changing your system later will not change what they see.',
  foot: 'Your name and club sit at the foot of every phase, with ours beside them. Fill them in above and it is signed.',

  /**
   * The sentence that travels with the link.
   *
   * A pasted URL on its own is the weakest thing you can put in a group chat:
   * it says nothing about what it is, so it gets opened last or not at all. One
   * line in front of it is the difference between "what is this" and "oh, have
   * a look at this". Written in the COACH's voice rather than ours, because it
   * is going out under their name and a sentence that reads like an advert is
   * one they will delete before sending.
   *
   * Every send button starts from this and they can edit it in the app they
   * land in, which is the right place to edit it.
   */
  message: (title: string) =>
    `${title?.trim() || 'A tactical system'}. It plays through phase by phase, and it opens in any browser.`,

  /** The row of send buttons. Verbs, and the name of the thing they open. */
  send: 'Send it',
  sendCopy: 'Copy the link',
  sendCopied: 'Link copied',
  sendWhatsapp: 'WhatsApp',
  sendMail: 'Email',
  sendMore: 'More',
  sendNote: 'Goes out with one line saying what it is, which you can change before you send it.',
} as const

/**
 * The video export.
 *
 * The copy has one job the link's copy does not: saying what a file is FOR,
 * because a coach who has already been given a link will reasonably ask why
 * they would want a download as well. The answer is that you cannot post a
 * link to a story, so that is the first line.
 */
export const VIDEO = {
  title: 'Save it as a video',
  body: `A film of your ${PHASE.many}, playing in order, shot on the pitch itself with your words over it. Use it where a link will not go: a story, a status, a group chat that flattens everything you send it.`,
  shape: 'What it is going on',
  quality: 'Size',
  fps: 'Smoothness',
  /**
   * What the size and rate cost, said once under both controls.
   *
   * `effort` is the render against 1080p30 as 1. It is written as a comparison
   * rather than as a time because we genuinely do not know how long it will
   * take — it runs on their machine, and a promise of "about a minute" that
   * turns into four on an old laptop is worse than no promise. "About twice the
   * wait" is true on every machine.
   */
  size: (w: number, h: number, effort: number) =>
    `${w} × ${h}. ` +
    (effort === 1
      ? 'The house setting: sharp enough to project, quick enough to wait for.'
      : effort < 1
        ? `About ${effort === 0.5 ? 'half' : `${effort}×`} the wait of 1080p at 30, and a smaller file.`
        : `About ${effort}× the wait of 1080p at 30. Worth it for a slow pan on a phone.`),
  /** The one thing in the credit line a coach might not want burnt in. */
  date: 'Show the date',
  making: 'Making the film…',
  slow: 'This runs on your own machine, so nothing is uploaded and nobody waits in a queue. A long system takes a minute.',
  ready: 'Ready. It has gone to your downloads.',
  failed: 'That did not finish. Nothing was uploaded, and your system is untouched. Worth trying once more.',
  /** Shown instead of the button on a browser with no WebCodecs. */
  unsupported:
    'This browser cannot make video files. Chrome, Edge or Safari can, or send the link instead, which works everywhere.',
  foot: 'Your name and club are burnt into the picture, with ours beside them. A video travels further from you than anything else here, so it is worth signing.',
} as const

/**
 * The what's-new panel's own words.
 *
 * The entries themselves are NOT here — they live in src/data/whatsnew.ts, for
 * the reason set out at the top of that file: guidance gets rewritten whenever
 * a control changes, and a record must not be. What is here is the chrome
 * around the list, which is guidance like everything else in this file.
 *
 * The heading does one job the entries cannot do for themselves: say that this
 * is a list of things that are already there and already free. Coaches have
 * been trained by every other tool that a panel which appears on its own and
 * says "new" is about to ask them for money.
 */
export const NEWS = {
  title: "What's new",
  body: 'Everything added to the studio since you last looked. It is all here already, and all included.',
  /** Shown to a coach who opens the panel with nothing waiting in it. */
  empty: 'Nothing new since you were last here.',
  /** The markers on an entry. Say the size of the change, not the department. */
  kind: {
    new: 'New',
    better: 'Better',
    fixed: 'Fixed',
  },
  /** On an entry the coach has not had in front of them before. */
  unread: 'Not read yet',
} as const

/**
 * The pace control, in the two places it appears.
 *
 * `line` is a function because the sentence has numbers in it and the numbers
 * are the point — a coach dragging the slider is watching the film get shorter,
 * not reading a label. It still belongs in this file: the words are here, only
 * the arithmetic is at the call site.
 */
export const PACE = {
  label: `How long each ${PHASE.one} holds`,
  /** What the current setting buys, in the two units a coach thinks in. */
  line: (holdSeconds: number, filmSeconds: number, phases: number) =>
    `Each ${PHASE.one} holds for ${holdSeconds.toFixed(1)}s, then takes about a second to move. ` +
    `${phases} ${phases === 1 ? PHASE.one : PHASE.many} ${phases === 1 ? 'runs' : 'run'} ${filmSeconds.toFixed(1)}s.`,
  /**
   * Shown at the fast end. Says what the limit is protecting rather than that a
   * limit exists — "minimum 0.2s" is a rule, "gone before the room has seen it"
   * is a reason.
   */
  floor: 'As quick as it goes. Any less and a pose is gone before a room has taken it in.',
  slower: 'Slower',
  quicker: 'Quicker',
} as const

/**
 * The one question we ask a coach.
 *
 * Written to be answerable in twenty seconds by somebody who did not come here
 * to fill in a form, which is why it says what it is for and what it is not:
 * nobody reads a survey, everybody reads "this is us, not a robot". The
 * "nothing is required" line is doing real work — a coach who only wants to
 * report one broken thing must not feel they have to score us first.
 *
 * No exclamation marks and no gratitude in advance. It thanks them afterwards,
 * once, and gets out of the way.
 */
export const FEEDBACK = {
  title: 'How is the studio treating you?',
  body: 'It is a small team and we read every one of these. Nothing here is required — answer the part you have an opinion about and leave the rest.',
  rating: 'How is it going?',
  ratingHint: 'Half a star counts.',
  recommend: 'Would you mention it to another coach?',
  recommendLow: 'No chance',
  recommendHigh: 'Already have',
  note: 'Anything you would change?',
  notePlaceholder: 'The thing that annoyed you most is the useful one.',
  send: 'Send it',
  later: 'Not now',
  /** After it lands. One line, and the dialog closes itself. */
  thanks: 'Thank you. That genuinely helps.',
  /**
   * Under the buttons. Says the two things a coach might reasonably wonder
   * before typing something honest.
   */
  foot: 'Sent without your name on it. Answer once and we leave you alone for a month.',
} as const

// ── the small-screen door ────────────────────────────────────────────────────

/**
 * What a coach who arrives on a phone is told.
 *
 * The honest position, and the reason this is a door rather than a wall: the
 * studio is a drag-and-drop tool with two panels of controls, and it is better
 * on a laptop. Saying so once is respectful. Blocking them is not — a coach
 * standing on a touchline who wants to look at the thing they built is a
 * perfectly good reason to be here on a phone, and the board, the phases and
 * Play all work on one.
 */
export const SMALL = {
  title: 'This works better on a laptop',
  body: [
    'The studio is a board you drag players around on, with the controls down both sides. On a phone you get one thing at a time and a lot of scrolling.',
    'Open it on a computer and everything is in front of you. Your systems are saved on the machine you build them on, so start where you mean to finish.',
  ],
  stayCta: 'Carry on here anyway',
  copyCta: 'Copy the link for later',
  copied: 'Link copied',
  /** Shown once they are in on a small screen. The one tip that actually helps. */
  phoneTip: 'On a phone, pick the upright pitch: it is the view the videos use for this shape of screen.',
} as const
