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
      'The step-by-step list on the right walks you through your first system. And if you ever cannot find something, press ? at the top and type what you are after: it will take you to it.',
    ],
  },
]

// ── the returning visitor walkthrough ────────────────────────────────────────

export const UPGRADES_WALKTHROUGH: WalkStep[] = [
  {
    id: 'gear',
    title: 'Training gear is here',
    body: [
      'You can now drop cones, ladders, hurdles and mannequins directly onto the grass.',
      'Drop them to build a drill or map out a session. Like everything else, they stay where you put them and they look right from any angle.',
    ],
  },
  {
    id: 'names',
    title: 'Names and faces',
    body: [
      'Your players are no longer just numbers. You can now put names above them, or wrap their actual photos inside the counters.',
      'It’s built for starting elevens, squad announcements, or any time the person matters as much as the position.',
    ],
  },
  {
    id: 'profile',
    title: 'Your own defaults',
    body: [
      'Set up how your players should look in your Profile settings.',
      'When you add your own name and club, it goes on every board you share, making sure your work stays yours.',
    ],
  },
  {
    id: 'ask',
    title: 'Ask the studio',
    body: [
      'The ? button is a search box now. Type what you are trying to do in your own words.',
      'It finds the control, opens the drawer it lives in and puts a ring round it.',
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
    drag: 'Tap the passer, then tap who gets it. Or drag between them to draw the line and move nobody.',
  },
  run: {
    label: 'Run',
    what: 'A player moving without the ball. Drawn as a dashed line.',
    when: 'Use it for the runs that make the pass possible: the winger in behind, the full-back overlapping, the striker dragging a centre-back away.',
    drag: 'Tap the runner, then tap where the run finishes. Or drag to draw the line and move nobody.',
  },
  carry: {
    label: 'Carry',
    what: 'A player travelling with the ball at their feet. Drawn as a squiggle.',
    when: 'Use it when the point is that nobody passes: the centre-back stepping into midfield, the winger taking someone on.',
    drag: 'Tap the carrier, then tap where they let it go. Or drag to draw the line and move nobody.',
  },
  press: {
    label: 'Press',
    what: 'Pressure going on to the ball.',
    when: 'Use it out of possession, to show who goes and, just as important, from which angle they approach.',
    drag: 'Tap the player pressing, then tap who they go after. Or drag to draw the line and move nobody.',
  },
  switch: {
    label: 'Switch',
    what: 'A long ball that changes the side of the pitch.',
    when: 'Save it for the one ball that moves the whole opposition. If every pass is a switch, none of them reads as one.',
    drag: 'Tap the player switching it, then tap who receives it on the far side. Or drag to draw the line.',
  },
  line: {
    label: 'Line',
    what: 'A plain line across the board, with no arrowhead on it. It divides; it does not move.',
    when: 'Use it for the heights and the edges: the line of confrontation, an offside line, the halfway split between who presses and who holds, the point past which you do not follow. Anything an arrow would be lying about, because an arrow says somebody is going there.',
    drag: 'Drag from one side to the other. Hold Shift and it comes out straight. Drop an end on a player to tie it to him.',
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
    drag: 'Drag a box around the area you want to talk about. Hold Shift to keep it square.',
  },
  text: {
    label: 'Text',
    what: 'Writes on the grass. Any words, anywhere on the board, at any size.',
    when: 'Use it for the thing the picture cannot say by itself: a trigger, a coaching point, a name for a space. It is the mark to reach for when you were about to draw a zone with its shading turned off.',
    drag: 'Click anywhere on the pitch and start typing. Drag it to move it.',
  },
  zone: {
    label: 'Zone',
    what: 'Shades an area in a neutral grey.',
    when: 'Use it for a channel to protect, a trap you are setting, or the space you are giving up on purpose.',
    drag: 'Drag a box around the area you want to talk about.',
  },
} as const satisfies Record<string, ToolDoc>

export type ToolId = keyof typeof TOOL_DOC

/**
 * The arrow tools, in toolbar order. The two shaded areas live with the block.
 *
 * THE LINE IS NOT IN HERE, and that is the whole reason this list still earns
 * its name. Membership of it means "two taps draw this AND pose the next
 * phase" — every consumer treats it that way, `ACTION.arm`/`.aim` are keyed on
 * it, and `perform` in ../actions.ts has a case for each one. A line poses
 * nothing, so putting it in this list to save a line of code in the toolbar
 * would have handed it to the two-tap path, where it has no case and no
 * meaning.
 */
export const ARROW_TOOL_IDS = ['pass', 'run', 'carry', 'press', 'switch'] as const
export const ZONE_TOOL_IDS = ['danger', 'zone'] as const

/**
 * The line tool. Drawn like an arrow, does none of an arrow's work.
 *
 * On its own for the reason above, and sat next to the arrows in the toolbar
 * anyway: a coach reaching for it is reaching for "draw between two points",
 * which is the shelf the arrows are on.
 */
export const LINE_TOOL_ID = 'line' as const

/** Everything drawn by pulling between two points, in toolbar order. */
export const TWO_POINT_TOOL_IDS = [...ARROW_TOOL_IDS, LINE_TOOL_ID] as const

/**
 * The text tool. On its own and not in either list above, because it is neither
 * an arrow (it has no ends) nor an area (it shades nothing) — it is a point and
 * some words. It sits in the toolbar beside the arrows, where a coach is
 * already looking when they want to add something to a phase.
 */
export const TEXT_TOOL_ID = 'text' as const

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
  export:
    'Saves a picture of any phase, or a PDF with one phase a page. For a slide, a session plan, or a printout to take out to the grass.',
  help: 'Ask the studio anything: type what you are trying to do and it takes you to the control that does it. The welcome guide is in there too.',
  news: 'Everything that has been added to the studio, newest first. It opens on its own when there is something on it you have not seen.',

  undo: 'Takes back the last thing you changed. Nothing you do here is permanent: move things, try it, take it back.',
  redo: 'Puts back the change you just took away.',
  theme: 'Changes the room you are working in: day, night, or one of the two pitch skins. It only changes these panels. What the pitch is drawn on is set under Pitch, and that is the part everyone else sees.',
  reset: `Empties this system and starts you again with a fresh board and one ${PHASE.one}. Undo brings it all back if you press it by mistake.`,

  pitchView:
    'How much of the pitch you are looking at. Changing between two match boards does not move anybody: everyone stays on the same patch of grass, you just see more or less of it. The session board is the one exception, because a coned grid is a different kind of board rather than a closer look at the same one: going there stands your players down at the side so you can build the drill, and one undo brings your match layout straight back.',
  setPiece:
    'The dead-ball boards. Picking one stands the pitch on its end with the goal the ball is going into at the top, the way a corner is drawn on a whiteboard, and puts everybody on their marks: four across the six, both posts filled, a wall at the regulation nine metres. It moves the players you already have rather than handing you new ones, so their names, faces and bibs come with them, and it only touches the phase you are on. Everything on it is yours to drag. There is an attacking board and a defending one, and the two are the same geometry seen from the end that matters to you.',
  training:
    'The session board: a coned area on grass, at whatever size you are running today. Coming here from a pitch stands your players down into the strip under the grid rather than squashing your shape into it, because a drill is written by putting the players you want where you want them. Drag them up onto the grid, and drag them back down when it is somebody else\'s turn. There are deliberately no goals painted on it, because a goal in an exercise goes where the exercise wants it: drag mini goals out of Equipment onto the grass around the grid, in the corners, on the ends, facing whichever way you need. One undo puts your match layout back exactly as it was.',
  areaPreset:
    'How big the grid is, in metres. This is the thing that changes most between one exercise and the next, so it is a control rather than four boards: rondos run from 8 x 8 up to 40 x 40 depending on the age group and what you are coaching, and possession games go out past that. The presets are the sizes that appear by name in the coaching literature and in the FA pitch guide, and the two sliders take you anywhere in between. Everything already on the grid scales with it, so shrinking a rondo keeps your men on the corners.',
  areaPerPlayer:
    'The size of the grid divided by the players standing on it, which is how a training space is sized professionally. Smaller area or more players means more touches, more accelerations and faster decisions; bigger area or fewer players means more distance and more sprinting. Small-sided games have been studied from about 43 up to 341 square metres each, and under about 150 they do not produce match-level high-speed running in youth players. A tight rondo is nowhere near that on purpose: Barcelona\'s 8v2 in a 10 x 10 is about 10 square metres each. Players waiting at the side are not counted.',
  pitchGrid:
    'Rules the grid you coach in onto the pitch itself: thirds, the five channels, or the eighteen numbered zones. The lines are drawn at the real numbers, not by eye — the channels are set by the width of the penalty area and the six-yard box, which is why "outside the box line" and "in the half-space" mean the same thing to everyone looking at the board. They sit under every counter and arrow, they are on every phase and every export, and there is nothing to drag or delete: this is the pitch, not something drawn on it. Put your own names on the sectors with the Text tool.',
  pitchFit:
    'A close-up view cannot hold two full teams, so a shape placed on one puts in the players that part of the pitch is actually about and leaves the rest out. Everyone else is still in your system, and comes back when you widen the view.',
  pace:
    'The two halves of a beat, set apart. The hold is how long a phase stands still, which is reading time. The move is how long it takes to become the next one, which is the football. Bring the hold down and stretch the move and you get the shape a coach rehearsing something familiar wants: poses they already know gone quickly, transitions they are teaching drawn out. The hold goes all the way down to nothing, which is a film with no pauses in it at all: every phase starts becoming the next one the moment it lands. Both belong to the system rather than to whoever is watching, so the film, the share link and Play all move together.',

  camera:
    'Whether the film moves. Fixed shows the whole pitch view in every phase, which is what a coach draws on a whiteboard. Follow the ball frames the ball and travels with it, the way the videos are shot — it follows the ball and nothing else, so moving a player never moves the camera. A phase with no ball is framed on what you have marked on it instead, and a phase with SEVERAL balls is yours to frame: there is no one ball to follow, so the camera uses the frame you drew on that phase and stays wide if you drew none. It changes nothing on the board: nobody moves, and you can still see everyone while you work.',

  ball:
    'Which match ball sits on the board. Choose one for the era you are teaching: the 1974 Telstar for a Total Football session, the 2026 Trionda for anything current.',
  surface:
    'What the pitch is drawn on. Paper is what the videos use and what prints best. Broadcast and Night look like a match on television, which reads well on a screen in a dark room. This travels with the system, so everyone you send it to sees the pitch you chose.',

  formationUs:
    'Lines your eleven up in this shape. It replaces where they are standing, so it asks first whenever there is anything to lose, and lets you say whether the new shape lands on this phase alone or on every phase. Names, faces, cues, fades and bibs are kept either way, and Undo puts it all back.',
  formationThem:
    'The shape you are playing against. Useful when the lesson is about where their players are, rather than only where yours are.',
  replace:
    'Puts everybody back on their formation position, on this phase only. Your names, cues and fades are kept.',
  colourUs: 'Your kit colour. The counter labels switch between white and black on their own so they stay readable.',
  colourThem: 'Their kit colour. Pick something well clear of yours.',
  bibs:
    'Bibs, for a session that is not simply two teams. Add a colour here and you can put it on any player, on either side: three-colour training, seven against seven plus seven, a group of neutrals, or a keeper who should not be in the outfield shirt. A bib is a colour with a name, so the seven yellows are all the same yellow and you can recolour the whole group in one place.',
  bib:
    'What this player is wearing. Kit is their team colour. Any bib on the board can go on them instead, and the plus makes a new bib in a colour you choose and puts them straight in it. A bib holds across every phase, because it is what they are wearing for the session rather than what they are doing on this beat.',
  opposition:
    'Puts eleven opposition players on THIS phase, and only this one. Build your shape across as many phases as you like, then bring them on for the phase where the point is made — they fade in and out as the move plays.',
  keepShape:
    'On, your players never move when the opposition comes on or goes off. They keep the whole pitch and the opposition is laid out facing them, so the spacing you worked out is the spacing you keep. Off, the two teams take a half each, which is how the studio has always started.',

  labels: 'What is printed on the counters: the position they play, or their shirt number.',

  lineup:
    'Who is filling each role, across every phase at once. Pick a player here and the name, the number and the face change on all of them, and nobody moves: the runs, the timing and the shape stay exactly as you drew them. That is what makes a board worth keeping. Build the movement once and put next week\'s eleven into it in a few seconds. It also tells you what it finds wrong, which is the part that saves a Friday night: a role nobody is on, the same player in two places, and any phase that disagrees with the others about who somebody is.',

  namePlace:
    'Where a player\'s name is printed. Above the counter is how the board has always drawn. Below is for a board that needs the air above it, for a title plate, for raised headshots, or simply because the names read better under the shape.',
  photoPlace:
    'Where a player\'s photograph goes. Above the counter keeps the kit, the stripes and the number all readable at once, which is what you want when the board is about a movement. In the counter makes the face the counter, and the number moves out to sit in front of the name, which is what you want when the board is a starting eleven. Players with no photograph are unchanged either way.',

  addPlayer:
    'Drops one more counter in the middle of the pitch, on this phase. For a twelfth man, a coach, or a shape that is not eleven a side.',
  clearPitch: 'Takes every player off this phase. The pitch, the arrows and the zones stay.',
  addBall:
    'Puts another match ball on the pitch. Drag it wherever the drill needs it. There can be as many as you like — a ball per grid in a rondo, a rack of them beside a finishing station — and every one of them is the match ball you picked, so a board with six balls on it still looks like your session rather than like clip art.',
  removeBall:
    'Takes a ball off. The one you have selected, or the last one you added if none is selected. Clicking a ball on the grass selects it, and Delete takes it off too.',

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
    'A box for a space with edges, a rounded box for one in open play, an oval for a pocket — coaches draw pockets as circles on a whiteboard, so an oval reads as one instantly. A triangle for a space that funnels, like a trap closing towards the touchline, and a diamond for the pocket between four players. The shape is only how it looks: you can change it as often as you like without redrawing it.',
  bandEdge:
    'The line round it. Dashed says "this region, roughly". Solid says the edge is real: a zone that stops where the six-yard box stops. None takes the line away and leaves the shading to say it, which reads better over a busy part of the pitch.',
  bandFill:
    'Shaded fills the area in. Hatched rules it diagonally instead — the same ink, laid on as lines, so the grass and the players standing on it still show through, and it survives being printed in black and white. Outline leaves the grass showing and draws only the border round it. Line only removes the border and the shading entirely, leaving just the line threaded through the players — best when the line itself is the point. You can still click anywhere inside to pick it up.',
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
  hideArrows: `Hides every arrow on this ${PHASE.one} without deleting any of them. They stay in the list above, they keep hold of their players, and you bring back the one you want to talk about by selecting it and turning its Strength up.`,
  showArrows: `Puts every arrow on this ${PHASE.one} back to fully drawn.`,

  phaseTitle: `A short name for this moment: "The trigger", "The switch". It shows under the board and in the strip of ${PHASE.many}.`,
  phaseCaption: 'One line explaining what is happening, in the words you would use to the group.',
  phaseNotes:
    'The longer version, for the printed page rather than the room: the coaching points, the triggers, what you want them watching for. Leave it empty and nothing shows.',

  share:
    'Makes a link to the finished thing. Whoever opens it sees your board play through, on a phone or a laptop, with no account and nothing to install.',
  addPhase: `Copies this ${PHASE.one} and adds it after. Move the players on the copy, and the movement between the two becomes the animation.`,
  deletePhase: `Removes this ${PHASE.one}. The others close up around it.`,
  copyPhase: `Makes a second copy of this ${PHASE.one} directly after it, with everything on it: the players where they stand, the arrows, the shading, the writing and the camera. Use it to keep a moment you are happy with before you change it, or to build a slow reveal out of one board.`,
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
/**
 * The Export dialog: pictures and paper.
 *
 * A single dialog for the two exports that are NOT the link and NOT the film,
 * because they answer the same question — "give me this as a file I can put in
 * something else" — and because separating them would have meant two more
 * buttons on a top bar that is already carrying six tool names.
 */
export const EXPORT = {
  title: 'Images and PDF',
  body: `A picture of every ${PHASE.one}, or the whole system on paper. For a slide, a session plan, a group chat, or a printout to take out to the grass.`,

  imagesTitle: 'Images',
  imagesBody: 'PNG files, one per phase. Drawn through exactly the same renderer as the film, so a picture is a frame of it.',
  shape: 'Shape',
  size: 'How big',
  which: 'Which phases',
  chrome: 'Put the words on the picture',
  chromeOn: 'Pick which of them below.',
  chromeOff: 'The board and nothing else. For dropping into your own slide, under your own title.',

  /* Each one names what a coach would look at on the picture, not what the
     renderer calls it. "Head" and "lockup" are our words for our own layout. */
  partHead: 'The system’s name',
  partHeadNote: 'Top left, with the phase count opposite it.',
  partWords: `The ${PHASE.one}’s title and caption`,
  partWordsNote: 'The words you wrote under this board.',
  partCredit: 'Your name and club',
  partCreditNote: 'Bottom left, with your note. The credit line off your shared boards.',
  /* Not a switch any more (user, 2026-08-28). A line under the three that are
     the coach's, saying what is going on the picture regardless — because a
     coach who finds our mark on an export they thought they had stripped bare
     should have read it here first.

     `partLockup`, `partLockupNote` and `partLockupTied` were the switch's own
     words and are kept, unused, against the switch coming back. See
     `resolveParts` in ../image.ts. */
  partLockupAlways: 'Made with Total Football goes bottom right, beside your name.',
  partLockup: 'Made with Total Football',
  partLockupNote: 'Our mark, bottom right, beside your name.',
  partLockupTied: 'Off, because your name is off. Ours never goes on a board on its own.',
  date: 'Show the date',
  making: 'Drawing…',
  saving: 'Saving them one at a time — your browser will ask about multiple files.',
  ready: (n: number) => (n === 1 ? 'Saved. It has gone to your downloads.' : `Saved ${n} images to your downloads.`),
  failed: 'That did not finish. Nothing was uploaded, and your system is untouched. Worth trying once more.',
  unsupported: 'This browser cannot write image files. Send the link instead, which works everywhere.',

  pdfTitle: 'PDF',
  pdfBody:
    'One phase a page, with your caption and notes under each board, and a cover with your name on it. It goes through your browser\u2019s own print, so pick "Save as PDF" as the destination.',
  pdfNote:
    'The boards print as vector, so it stays sharp at any size and on any printer. Cmd-P or Ctrl-P does the same thing from anywhere on this page.',
  pdfButton: 'Open the print sheet',
} as const

/**
 * The one control that appears in all three export dialogs.
 *
 * ONE SET OF WORDS, USED IN THREE PLACES, because it is one question and a
 * coach who reads it differently in the share dialog than in the film dialog
 * will reasonably think it does something different there. The only thing that
 * changes between them is the noun for what is going out, which is why `off`
 * takes one.
 */
export const IDENTITY = {
  label: 'Put my name on it',
  /* Says what stays as well as what goes. A switch that only lists what it
     removes reads as destructive, and this one changes nothing on the board. */
  on: 'Your name, your club, your crest and your players\u2019 names go with it.',
  off: (what: string) =>
    `No name, no club, no crest, and the counters go out unnamed. Your board is untouched. This only changes ${what}.`,
  /* Shown under the switch when the coach has not set a default. Points at the
     setting rather than making them find it. */
  fromSettings: 'Your default, from your settings.',
  /*
   * The switch is ON and there is nothing to put on it.
   *
   * The one moment in the studio where an unfinished profile has a visible,
   * immediate cost, which is the only moment it is fair to raise it. A coach
   * about to hand a film to their assistant is not being nagged about a form —
   * they are being told, at the last second it is still free to fix, that the
   * film is going out with nobody's name on it. Nothing is blocked: the word is
   * "goes out", not "cannot go out".
   */
  unsigned: (what: string) =>
    `There is no name on this system yet, so ${what} goes out unsigned.`,
  unsignedCta: 'Add your name',
} as const

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
 * Arming an arrow tool and letting it do the work.
 *
 * WHY EACH KIND GETS ITS OWN SENTENCE
 *
 * Because the two taps mean different things per tool and a generic "tap a
 * player, then tap a target" hides exactly the part a coach needs: who they are
 * tapping first. For a pass that is the man ON the ball; for a press it is the
 * man going TO it. One sentence that covered both would have to say "the player
 * involved", which is not guidance, it is a shrug.
 *
 * `also` is on every one of them because the drag has not gone anywhere. A
 * coach who wants a line and nothing else must not have to discover that by
 * undoing a phase they did not mean to create.
 */
export const ACTION = {
  arm: {
    pass: 'Tap the player making the pass.',
    run: 'Tap the player making the run.',
    carry: 'Tap the player carrying it.',
    press: 'Tap the player going to press.',
    switch: 'Tap the player switching it.',
  },
  aim: {
    pass: 'Now tap who receives it, or the space to play it into.',
    run: 'Now tap where the run finishes.',
    carry: 'Now tap where they let it go.',
    press: 'Now tap who they are going after.',
    switch: 'Now tap who receives it, or the space to find.',
  },
  /** What the two taps will actually change, said before they are made. */
  also: `Both taps together draw the arrow AND pose the next ${PHASE.one}. Drag instead of tapping to draw a line that moves nobody.`,
  /** After the first tap. Tapping the same player again is how you take it back. */
  armed: 'Tap the same player again to change your mind.',
} as const

/**
 * What a selected arrow says about itself.
 *
 * `ends` is the one piece of state a coach cannot see by looking: an arrow
 * attached to a player and an arrow that merely finishes near one are drawn
 * identically, and they behave completely differently the moment anybody is
 * dragged. So it is said in words rather than left to be discovered on the
 * next phase.
 *
 * Written without pronouns on purpose. A counter is a position on a board and
 * the studio has no idea who is standing on it.
 */
export const ARROW_MARK = {
  ends: (from: string | null, to: string | null) => {
    if (from && to) return `Runs from ${from} to ${to}. Both ends follow their players.`
    if (from) return `Starts on ${from} and follows. The far end is on the grass.`
    if (to) return `Finishes on ${to} and follows. The near end is on the grass.`
    return 'Both ends are on the grass, so nothing moves this arrow but you.'
  },
  adjust:
    'Drag either end onto a counter to attach it, or out onto the grass to let it go. Drag the middle to bow it, or the line itself to move it.',
  /**
   * The bend is not a drawing any more, so it stops being described as one. A
   * coach curling a pass round a defender is now setting the path the ball
   * takes, and the one place they will find that out is here.
   */
  bow: 'A bowed arrow is a bowed path. Whatever it describes travels along the curve you draw, on Play and in the film.',
  /**
   * Strength, and what it is FOR. Nobody sets an arrow to 40% for its own sake:
   * they set it because they want the board to say one thing at a time, and
   * the sentence has to arrive at that.
   */
  strength:
    'How strongly it is drawn. Turn it to nothing and the arrow is still here, still holding its players, just not on the picture. Hide them all on the early phases and turn back the one each phase is about, and the board explains itself a step at a time.',
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
  moveLabel: 'How long the move takes',
  /**
   * What the current settings buy, in the units a coach thinks in. One sentence
   * for the pair rather than one under each slider: the number they actually
   * care about is the length of the finished film, and that is a function of
   * both.
   */
  line: (holdSeconds: number, moveSeconds: number, filmSeconds: number, phases: number) =>
    (holdSeconds <= 0
      ? `Nothing pauses. Each ${PHASE.one} lands and takes ${moveSeconds.toFixed(1)}s to become the next. `
      : `Each ${PHASE.one} holds for ${holdSeconds.toFixed(1)}s, then takes ${moveSeconds.toFixed(1)}s to move. `) +
    `${phases} ${phases === 1 ? PHASE.one : PHASE.many} ${phases === 1 ? 'runs' : 'run'} ${filmSeconds.toFixed(1)}s.`,
  /**
   * Shown at the bottom of the hold, which is now no hold at all. It is a real
   * setting rather than an edge the slider fell off, so this says what it gives
   * you — and points at the control that answers the objection, because a coach
   * who takes the pauses out and then cannot follow the football wants a longer
   * MOVE, not their pauses back.
   */
  floor:
    'No pause at all. Each phase starts becoming the next the moment it lands, so the whole film is movement. If that is too quick to follow, give the move longer rather than the hold.',
  /**
   * The move's floor is the speed everything here has always moved at, so this
   * says so plainly rather than apologising for a limit. Nobody has ever asked
   * for a quicker move — the complaint runs the other way.
   */
  moveFloor: 'The speed the board has always moved at. This one only slows down.',
  /**
   * Shown as soon as the move is slowed at all, because the slider does two
   * things and a coach is entitled to know about the second one. Describes what
   * they will see rather than naming a curve.
   */
  moveEven:
    'Players set off gently and hold their speed the whole way, instead of covering most of the ground in the first instant and drifting in.',
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

// ── the help panel ───────────────────────────────────────────────────────────

/**
 * The names on the six drawers in the left rail.
 *
 * Here rather than inline in StudioEditor.tsx because the help panel has to be
 * able to OPEN one. A drawer unmounts its contents when it is shut (../ui.tsx),
 * so "show me the camera control" cannot be a query for something in the DOM —
 * the control is not there until the drawer holding it is open. The panel opens
 * the drawer by name, waits for the control to mount, and then rings it, and
 * the name it opens by has to be the same string the drawer renders under.
 *
 * It is also the localStorage key `Section` remembers itself by, so these
 * strings are load-bearing twice over and must not be edited casually.
 */
export const DRAWER = {
  board: 'The board',
  teams: 'Teams and kit',
  equipment: 'Equipment',
  phase: `On this ${PHASE.one}`,
  film: 'The film',
  system: 'This system',
} as const

export type HelpGroupId = 'board' | 'marks' | 'phases' | 'kit' | 'share' | 'new'

export interface HelpGroup {
  id: HelpGroupId
  label: string
  /** One line under the heading, so a group is chosen rather than guessed. */
  blurb: string
}

/**
 * Six groups, in the order a system gets built.
 *
 * The order is the point. Somebody who opens this panel without a word in mind
 * is lost, and a list that runs board → marks → phases → kit → sharing is a
 * description of the job as well as a menu. What's new is last because it is
 * the only group that is not about doing something.
 */
export const HELP_GROUPS: HelpGroup[] = [
  { id: 'board', label: 'The board', blurb: 'The pitch, what it is drawn on, and how the film is shot.' },
  { id: 'marks', label: 'Marks', blurb: 'Passes, runs, blocks, shaded areas and writing.' },
  { id: 'phases', label: 'Phases', blurb: `Building the move out of ${PHASE.many}, and how fast it runs.` },
  { id: 'kit', label: 'Kit and squad', blurb: 'Your colours, your crest, your players and your name.' },
  { id: 'share', label: 'Sharing', blurb: 'The link, the video file, the pictures and the PDF.' },
  { id: 'new', label: 'What is new', blurb: 'Everything added lately, and the tour of the basics.' },
]

export interface HelpTarget {
  /** The drawer that owns it, by its heading. Opened before anything is rung. */
  drawer?: string
  /** The `data-help` value on the thing to ring. */
  anchor: string
  /** What to call it while the ring is up. A coach's word, not a selector. */
  name: string
}

export interface HelpTopic {
  id: string
  group: HelpGroupId
  /** The heading, and the first thing searched. */
  label: string
  /**
   * The words a coach would type looking for this.
   *
   * WRITE THE WORDS THEY HAVE, NOT THE ONES WE USE. A coach hunting for the
   * dashed line types "run" and "off the ball", never "arrow kind". A coach who
   * wants their badge on the board types "badge" and "logo" long before
   * "crest". Every wrong guess here is a coach who concludes the studio cannot
   * do the thing it has done since March.
   *
   * The label is searched separately, so there is no need to repeat it.
   */
  terms: string[]
  /** The answer. Reuses the constants above wherever one already says it. */
  body: string[]
  /** Where the control is, if it is a control. */
  target?: HelpTarget
  /** Instead of a target: something the panel can do. */
  action?: 'walkthrough' | 'news' | 'settings'
  /**
   * Where to send somebody when the target is not on the board to be rung.
   *
   * A few controls in the rail only exist once the account has something to put
   * in them: the Your club panel is not drawn at all until a kit or a crest has
   * been saved, because a panel offering to apply nothing is worse than no
   * panel. So a coach asking "how do I get my badge on the board" — which is
   * exactly the coach who has not saved one — asks the one question the rail
   * cannot answer by pointing.
   *
   * Without this they got a shrug. With it they get the page that fixes the
   * reason the control was missing, which is the answer they were owed. It is
   * only ever reached when the anchor genuinely is not there: a coach who HAS
   * saved a crest still gets the ring, in the rail, where they will find it
   * again unaided next month.
   */
  fallback?: 'settings'
}

/**
 * The six two-point tools, straight out of TOOL_DOC.
 *
 * Generated rather than transcribed, because the copy for a pass already exists
 * and a second copy of it is a second copy to keep true. Only the search terms
 * are new, and they are the half TOOL_DOC does not have.
 */
const ARROW_TERMS: Record<(typeof TWO_POINT_TOOL_IDS)[number], string[]> = {
  pass: ['ball', 'played', 'give', 'lay off', 'through ball', 'arrow', 'combination'],
  run: ['off the ball', 'overlap', 'underlap', 'in behind', 'dashed', 'movement', 'third man'],
  carry: ['dribble', 'drive', 'travel', 'take on', 'squiggle', 'step in', 'on the ball'],
  press: ['pressure', 'closing down', 'press trigger', 'hunt', 'out of possession', 'jump'],
  switch: ['long ball', 'cross field', 'diagonal', 'change the point', 'far side', 'wide'],
  /*
   * "no arrowhead" and "plain line" are in here because that is what a coach
   * types when they have tried Pass and got a head they did not want. The
   * search has to answer the wrong guess as well as the right word.
   */
  line: [
    'line', 'straight line', 'plain line', 'no arrowhead', 'no head', 'divide', 'divider',
    'offside line', 'line of confrontation', 'line of engagement', 'press height', 'defensive line',
    'halfway', 'split', 'edge', 'boundary', 'trigger line', 'rule',
  ],
}

const TOOL_TOPICS: HelpTopic[] = TWO_POINT_TOOL_IDS.map((id) => ({
  id: `tool-${id}`,
  group: 'marks' as const,
  label: TOOL_DOC[id].label,
  terms: ARROW_TERMS[id],
  body: [TOOL_DOC[id].what, TOOL_DOC[id].when, TOOL_DOC[id].drag],
  target: { anchor: `tool:${id}`, name: `the ${TOOL_DOC[id].label} tool` },
}))

/**
 * Everything the ? button can find, in browse order within each group.
 *
 * THE RULE FOR ADDING ONE: it needs a place to send somebody. A topic with no
 * `target` and no `action` is an article, and an article in a tool is a thing
 * nobody reads. If a change is worth explaining and has no control, it is a
 * what's-new entry (../../data/whatsnew.ts), not a topic.
 */
export const HELP_TOPICS: HelpTopic[] = [
  // ── the board ──────────────────────────────────────────────────────────────
  {
    id: 'pitch-view',
    group: 'board',
    label: 'How much of the pitch you see',
    terms: ['pitch', 'view', 'half', 'third', 'final third', 'box', 'penalty area', 'full pitch', 'upright', 'zoom out', 'wider', 'closer'],
    body: [HINT.pitchView, HINT.pitchFit],
    target: { drawer: DRAWER.board, anchor: 'Pitch view', name: 'Pitch view' },
  },
  /*
   * SET PIECES — HIDDEN WITH THE PICKER ITSELF (see ../editor/StudioEditor.tsx).
   * A guide entry that scrolls to a control the drawer no longer shows is worse
   * than no entry, so this comes back at the same time the panel does.
   */
  /*
  {
    id: 'set-pieces',
    group: 'board',
    label: 'Corners, free kicks and the board for them',
    terms: ['set piece', 'set pieces', 'dead ball', 'deadball', 'corner', 'corners', 'free kick', 'freekick', 'wall', 'zonal', 'man marking', 'near post', 'far post', 'inswinger', 'in-swinger', 'short corner', 'restart', 'prekid', 'korner'],
    body: [HINT.setPiece],
    target: { drawer: DRAWER.board, anchor: 'Set pieces', name: 'Set pieces' },
  },
  */
  {
    id: 'pitch-grid',
    group: 'board',
    label: 'Thirds, channels and numbered zones',
    terms: ['grid', 'zones', 'zone 14', 'channels', 'half space', 'halfspace', 'corridor', 'corridors', 'sectors', 'thirds', 'markings', 'lines', 'positional play', 'juego de posicion', 'marked pitch', 'drawn field'],
    body: [HINT.pitchGrid],
    target: { drawer: DRAWER.board, anchor: 'Markings', name: 'Markings' },
  },
  {
    id: 'surface',
    group: 'board',
    label: 'What the pitch is drawn on',
    terms: ['grass', 'surface', 'green', 'paper', 'broadcast', 'night', 'stripes', 'mown', 'background', 'skin', 'look'],
    body: [HINT.surface],
    target: { drawer: DRAWER.board, anchor: 'Pitch', name: 'Pitch' },
  },
  {
    id: 'camera',
    group: 'board',
    label: 'How the film is shot',
    terms: ['camera', 'follow the ball', 'fixed', 'zoom', 'framing', 'frame it yourself', 'shot', 'close up', 'pan'],
    body: [HINT.camera],
    target: { drawer: DRAWER.board, anchor: 'Camera', name: 'Camera' },
  },
  {
    id: 'theme',
    group: 'board',
    label: 'Day, night and the room you work in',
    terms: ['dark', 'light', 'theme', 'night', 'day', 'lights', 'bright', 'colour of the panels'],
    body: [HINT.theme],
    target: { anchor: 'theme', name: 'the theme button' },
  },
  {
    id: 'zoom',
    group: 'board',
    label: 'Working in close on the board',
    terms: ['zoom', 'magnify', 'bigger', 'closer', 'scale', 'fiddly', 'precise', 'reset zoom'],
    body: [
      'Zoom in when the counters are too close together to pick the one you want. It magnifies the board you are working on and changes nothing about the system: not the pitch view, not the film, not what anybody you send it to sees.',
      'Drag with the middle of a phase at any zoom and the counter stays under your cursor. Reset zoom puts it back.',
    ],
    target: { anchor: 'zoom', name: 'the zoom controls' },
  },
  {
    id: 'snap',
    group: 'board',
    label: 'Keeping a line straight',
    terms: ['snap', 'align', 'line', 'level', 'straight', 'same line', 'tidy', 'mannequin', 'ravan'],
    body: [
      'Drag a player, a ball or a piece of gear near the line of another one and it settles onto it, level with them or in the same channel. A gold line shows you what it has lined up with, and it reaches every mark on that line, so a back four comes out as one line rather than four near misses.',
      'It only ever lines things up with what you have put down yourself, one axis at a time, and it will not drop a counter on top of somebody. Hold the option key while you drag to place something exactly where you want it instead, or turn it off with the button beside the zoom.',
    ],
    target: { anchor: 'snap', name: 'the lining-up button' },
  },

  // ── marks ──────────────────────────────────────────────────────────────────
  ...TOOL_TOPICS,
  {
    id: 'arrow-moves-them',
    group: 'marks',
    label: 'Let an arrow make the move for you',
    terms: ['move the player', 'automatic', 'follow', 'attached', 'ends', 'stick', 'joined', 'does it for me'],
    body: [
      `Draw a pass or a run from one counter to another and the arrow holds on to both of them. Add a ${PHASE.one} and the player it is about walks the arrow: you do not have to drag them there yourself.`,
      ARROW_MARK.adjust,
      ARROW_MARK.bow,
    ],
    target: { anchor: 'tool:pass', name: 'the Pass tool' },
  },
  {
    id: 'arrow-strength',
    group: 'marks',
    label: 'Reveal your marks one at a time',
    terms: ['hide', 'fade', 'strength', 'invisible', 'build up', 'step by step', 'reveal', 'too busy'],
    body: [ARROW_MARK.strength, HINT.hideArrows],
    target: { anchor: `Marks on this ${PHASE.one}`, name: 'the list of marks' },
  },
  {
    id: 'block',
    group: 'marks',
    label: 'Shading a block',
    terms: ['block', 'back four', 'low block', 'defensive line', 'unit', 'screen', 'shape', 'space behind', 'protect'],
    body: [HINT.block, HINT.blockDraw, HINT.blockClose],
    target: { drawer: DRAWER.phase, anchor: 'Shaded areas', name: 'Shaded areas' },
  },
  {
    id: 'areas',
    group: 'marks',
    label: 'Shading a space',
    terms: ['zone', 'danger area', 'highlight', 'shade', 'space', 'pocket', 'cutback', 'channel', 'trap', 'colour', 'box'],
    body: [TOOL_DOC.danger.when, HINT.bandTone, HINT.bandShape],
    target: { drawer: DRAWER.phase, anchor: 'Shaded areas', name: 'Shaded areas' },
  },
  {
    id: 'text',
    group: 'marks',
    label: 'Writing on the grass',
    terms: ['text', 'write', 'words', 'label', 'title', 'caption on the board', 'type', 'annotate', 'note'],
    body: [TOOL_DOC.text.what, TOOL_DOC.text.when, TOOL_DOC.text.drag],
    target: { drawer: DRAWER.phase, anchor: 'Writing', name: 'Writing' },
  },
  {
    id: 'gear',
    group: 'marks',
    label: 'Cones, mannequins and training gear',
    terms: ['cone', 'ladder', 'mannequin', 'hurdle', 'pole', 'mini goal', 'session', 'drill', 'equipment', 'gate', 'rondo'],
    body: [
      'Nineteen pieces of training kit you can put on the grass: marker cones, hurdles, an agility ladder, mini goals, mannequins, poles and the strength gear.',
      `Press one to put it down, drag it where you want it, then size it and turn it. Gear belongs to a ${PHASE.one} and moves between ${PHASE.many} on Play, so widening a gate is something you show rather than cut to.`,
    ],
    target: { drawer: DRAWER.equipment, anchor: 'Training gear', name: 'Training gear' },
  },
  {
    id: 'balls',
    group: 'marks',
    label: 'The match ball, and having more than one',
    terms: ['ball', 'match ball', 'telstar', 'trionda', 'several balls', 'more balls', 'rondo', 'station', 'era'],
    body: [HINT.ball, HINT.addBall],
    target: { drawer: DRAWER.equipment, anchor: 'Match ball', name: 'Match ball' },
  },
  {
    id: 'delete-mark',
    group: 'marks',
    label: 'Taking something off',
    terms: ['delete', 'remove', 'undo', 'rubber', 'erase', 'get rid', 'clear', 'mistake'],
    body: [HINT.marks, HINT.deleteMark, HINT.undo],
    target: { anchor: `Marks on this ${PHASE.one}`, name: 'the list of marks' },
  },

  // ── phases ─────────────────────────────────────────────────────────────────
  {
    id: 'add-phase',
    group: 'phases',
    label: 'Making it move',
    terms: ['animate', 'movement', 'moving', 'animation', 'next', 'second board', 'slide', 'step', 'nothing moves'],
    body: [
      `You never draw the movement. You build the same board twice and we work the animation out from the difference.`,
      HINT.addPhase,
      HINT.play,
    ],
    target: { anchor: 'addPhase', name: `the Add ${PHASE.one} button` },
  },
  {
    id: 'reorder-phase',
    group: 'phases',
    label: `Reordering and copying ${PHASE.many}`,
    terms: ['reorder', 'move earlier', 'move later', 'swap', 'duplicate', 'copy', 'wrong order', 'rearrange'],
    body: [HINT.movePhaseBack, HINT.copyPhase, HINT.deletePhase],
    target: { anchor: 'phaseStrip', name: `the strip of ${PHASE.many}` },
  },
  {
    id: 'repeat-drill',
    group: 'phases',
    label: 'Repeating a drill sequence',
    terms: ['repeat', 'loop', 'again', 'second set', 'same thing', 'copy sequence', 'duplicate drill'],
    body: [
      'You can repeat a whole sequence of movements without redrawing it.',
      'Tap Repeat, and the players will seamlessly reset to their starting positions to run the drill again. The equipment stays exactly where it is.',
    ],
    target: { anchor: 'repeatDrill', name: 'the Repeat button' },
  },
  {
    id: 'pace',
    group: 'phases',
    label: 'How fast it runs',
    terms: ['speed', 'slow', 'quick', 'timing', 'duration', 'length', 'hold', 'too fast', 'seconds', 'pace'],
    body: [HINT.pace, PACE.moveEven],
    target: { drawer: DRAWER.film, anchor: 'Pace', name: 'Pace' },
  },
  {
    id: 'phase-words',
    group: 'phases',
    label: `Titles, captions and notes on a ${PHASE.one}`,
    terms: ['title', 'caption', 'notes', 'description', 'coaching points', 'explain', 'words under the board'],
    body: [HINT.phaseTitle, HINT.phaseCaption, HINT.phaseNotes],
    target: { anchor: 'phaseWords', name: `the ${PHASE.one} title` },
  },
  {
    id: 'play',
    group: 'phases',
    label: 'Watching it back',
    terms: ['play', 'preview', 'watch', 'run it', 'see it move', 'test'],
    body: [HINT.play, HINT.stop],
    target: { anchor: 'play', name: 'Play' },
  },

  // ── kit and squad ──────────────────────────────────────────────────────────
  {
    id: 'my-kit',
    group: 'kit',
    label: 'Putting your own kit on the board',
    terms: ['kit', 'colours', 'shirt', 'strip', 'my club', 'our colours', 'house colours', 'change colour'],
    body: [
      HINT.colourUs,
      'Use my kit brings the colours you saved in Personal settings onto a board you have already started. House colours puts it back to the studio green.',
    ],
    target: { drawer: DRAWER.teams, anchor: 'Your club', name: 'Your club' },
    // The panel is only drawn once a kit is saved. See `fallback` above.
    fallback: 'settings',
  },
  {
    id: 'lineup',
    group: 'kit',
    label: "Changing the lineup without redrawing the board",
    // The words a coach hunting for this actually has, which are the words in
    // the complaint that produced it: they are not looking for a "lineup panel",
    // they are looking for the retyping to stop.
    terms: [
      'lineup',
      'line up',
      'team sheet',
      'starting eleven',
      'xi',
      'swap',
      'substitute',
      'change player',
      'change name',
      'rename',
      'wrong name',
      'every slide',
      'all phases',
      'reuse',
      'template',
      'next week',
      'new match',
    ],
    body: [
      HINT.lineup,
      'Names, numbers and faces belong to the player and so they travel across every phase on their own. Cues, fades and where somebody is standing belong to the phase, and those stay where you put them.',
      'The counter beside each row takes you to that player on the board.',
    ],
    target: { drawer: DRAWER.teams, anchor: 'Lineup', name: 'Lineup' },
    // Drawn once there is a squad to pick from, or a name already on the board.
    // A coach with neither is being pointed at the squad, which is the thing
    // they are missing.
    fallback: 'settings',
  },
  {
    id: 'crest',
    group: 'kit',
    label: 'Your crest on the board',
    terms: ['crest', 'badge', 'logo', 'club badge', 'emblem', 'branding', 'corner'],
    body: [
      'Your crest sits in the corner of the board, and travels with it into share links, PDFs and films. Upload it once in Personal settings and Show my crest turns it on for a system.',
    ],
    target: { drawer: DRAWER.teams, anchor: 'Your club', name: 'Your club' },
    fallback: 'settings',
  },
  {
    id: 'shapes',
    group: 'kit',
    label: 'Formations, and the opposition',
    terms: ['formation', 'shape', '4-3-3', 'line up', 'eleven', 'opposition', 'them', 'against', 'other team'],
    body: [HINT.formationUs, HINT.opposition, HINT.keepShape],
    target: { drawer: DRAWER.teams, anchor: 'Our shape', name: 'Our shape' },
  },
  {
    id: 'bibs',
    group: 'kit',
    label: 'Bibs: three colours, neutrals, a keeper in a different shirt',
    terms: [
      'bib',
      'bibs',
      'colour one player',
      'different colour player',
      'three colour',
      '3 colour',
      'neutrals',
      'jokers',
      'keeper colour',
      'goalkeeper colour',
      '7v7',
      'plus seven',
      'groups',
      'rondo colours',
    ],
    body: [HINT.bibs, HINT.bib],
    target: { drawer: DRAWER.teams, anchor: 'Bibs', name: 'Bibs' },
  },
  {
    id: 'counters',
    group: 'kit',
    label: 'Names, numbers and faces on the counters',
    terms: ['name', 'number', 'position', 'photo', 'picture', 'headshot', 'face', 'squad', 'players', 'label'],
    body: [HINT.labels, HINT.namePlace, HINT.photoPlace],
    target: { drawer: DRAWER.teams, anchor: 'Counters', name: 'Counters' },
  },
  {
    id: 'squad-list',
    group: 'kit',
    label: 'Typing your squad in once',
    terms: ['squad', 'my players', 'team sheet', 'roster', 'names once', 'photographs', 'faces'],
    body: [
      'Type your players once in Personal settings and a counter can then take a name, a number and a face in one press instead of three fields.',
      'Everything there is yours alone: a board you share carries the names you put on it and never the photographs, which stay in your account.',
    ],
    action: 'settings',
  },
  {
    id: 'signing',
    group: 'kit',
    label: 'Putting your name on your work',
    terms: ['my name', 'credit', 'signature', 'who made this', 'author', 'anonymous', 'byline', 'presenter'],
    body: [
      'Your name and your club sign every board you share, every page you print and every film you export. Without them a system you send to your assistant arrives anonymous.',
      'Both are set once, in Personal settings, and every system you make afterwards carries them.',
    ],
    action: 'settings',
  },

  // ── sharing ────────────────────────────────────────────────────────────────
  {
    id: 'share-link',
    group: 'share',
    label: 'Sending it to someone',
    terms: ['share', 'link', 'send', 'url', 'whatsapp', 'assistant', 'players', 'phone', 'show someone'],
    body: [HINT.share],
    target: { anchor: 'share', name: 'Share' },
  },
  {
    id: 'video',
    group: 'share',
    label: 'Getting a video file',
    terms: ['video', 'mp4', 'film', 'post', 'instagram', 'tiktok', 'youtube', 'download', 'export video', 'render'],
    body: [HINT.video],
    target: { anchor: 'video', name: 'Video' },
  },
  {
    id: 'export',
    group: 'share',
    label: 'Pictures and a PDF',
    terms: ['pdf', 'print', 'picture', 'image', 'png', 'slide', 'session plan', 'printout', 'paper', 'deck'],
    body: [HINT.export],
    target: { anchor: 'export', name: 'Images and PDF' },
  },
  {
    id: 'saving',
    group: 'share',
    label: 'Where your work is kept',
    terms: ['save', 'saved', 'lost', 'autosave', 'close the tab', 'come back', 'my systems', 'shelf', 'account'],
    body: [
      'Every change is kept as you make it, on the machine you are working on. You can close the tab and come back to it.',
      'Signed in, your systems are on your account as well, so the shelf you see is the same on any computer you sign in to.',
    ],
    target: { anchor: 'title', name: 'the name of this system' },
  },

  // ── what is new ────────────────────────────────────────────────────────────
  {
    id: 'whats-new',
    group: 'new',
    label: 'Everything added lately',
    terms: ['new', 'changed', 'update', 'changelog', 'latest', 'recently', 'what is new'],
    body: [HINT.news],
    action: 'news',
  },
  {
    id: 'walkthrough',
    group: 'new',
    label: 'Show me round again',
    terms: ['tour', 'guide', 'walkthrough', 'start', 'beginner', 'first time', 'basics', 'lost', 'how does this work'],
    body: [
      'The five screens you were shown the first time: the board, how a move is built, what the marks are for, Play, and where your work is kept.',
    ],
    action: 'walkthrough',
  },
]

// ── searching it ─────────────────────────────────────────────────────────────

const NOISE = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'does', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'the',
  'this', 'to', 'what', 'where', 'with', 'you', 'your',
])

/**
 * Words worth matching on, out of whatever somebody typed.
 *
 * The noise list is not an optimisation. A coach types "how do i make it move",
 * and without this the query is six words of which four match nearly every
 * topic in the file, so the ranking is decided by "how" and "do" rather than by
 * "move" and the right answer comes fourth. Strip them and one word is left,
 * which is the word they meant.
 *
 * If EVERY word is noise the query is handed back whole rather than emptied —
 * somebody who typed only "how" gets a weak result, which beats a blank panel.
 */
export function queryWords(query: string): string[] {
  const all = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const kept = all.filter((w) => !NOISE.has(w))
  return kept.length ? kept : all
}

/**
 * How well one topic answers one query. 0 means it does not.
 *
 * EVERY WORD HAS TO LAND SOMEWHERE. "arrow colour" must not return every topic
 * that mentions an arrow, because a coach who typed two words has told us both
 * of them matter — an OR here turns a narrowing query into a widening one,
 * which is the failure people mean when they say a search box is useless.
 *
 * Weighting is by where the word was found, which is a rough proxy for what the
 * topic is ABOUT: a heading is the subject, a search term is a synonym for the
 * subject, and the body is merely somewhere the word appears. Prefixes count so
 * that "press" finds "pressing" and "colour" finds "colours".
 */
export function topicScore(topic: HelpTopic, words: string[]): number {
  if (!words.length) return 0
  const label = topic.label.toLowerCase()
  const terms = topic.terms.join(' ').toLowerCase()
  const body = topic.body.join(' ').toLowerCase()
  let total = 0
  for (const word of words) {
    const hit = label.includes(word) ? 6 : terms.includes(word) ? 4 : body.includes(word) ? 1 : 0
    if (!hit) return 0
    total += hit
  }
  return total
}

/** The topics that answer a query, best first. Empty query, empty result. */
export function searchTopics(query: string): HelpTopic[] {
  const words = queryWords(query)
  if (!words.length) return []
  return HELP_TOPICS.map((topic) => ({ topic, score: topicScore(topic, words) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.topic)
}

export function topicsInGroup(group: HelpGroupId): HelpTopic[] {
  return HELP_TOPICS.filter((t) => t.group === group)
}
