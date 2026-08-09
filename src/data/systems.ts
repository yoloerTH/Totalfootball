/**
 * The library: one entry per tactical system.
 *
 * This is the SEO engine of the site (docs/SPEC.md §0). Each entry becomes a
 * page that answers one real search query, illustrated phase by phase with
 * frames exported from the composition that already teaches it.
 *
 * Authoring rules:
 *  · `question` is the query as a human types it. `answer` is the direct reply,
 *    in one paragraph, in the first 40 words. That paragraph is what ranks.
 *  · `phases[].frame` is the SOURCE frame in the Remotion composition, taken
 *    from that composition's own timing constants, never eyeballed. It drives
 *    media/manifest.ts, so it must be exact.
 *  · `alt` is authored per phase. Never generated, never "diagram of tactics".
 *  · `related` uses the sibling graph already recorded in the project memory
 *    index rather than inventing associations.
 */

export type ThemeSlug = 'defending' | 'build-up' | 'pressing' | 'attacking' | 'set-pieces'

export interface Theme {
  slug: ThemeSlug
  title: string
  blurb: string
}

export const THEMES: Theme[] = [
  {
    slug: 'defending',
    title: 'Defending',
    blurb:
      'Keeping a shape when the ball moves. Lines, distances, and who is responsible for what.',
  },
  {
    slug: 'build-up',
    title: 'Build-up',
    blurb: 'Getting the ball from your own goalkeeper into the other half without losing it.',
  },
  {
    slug: 'pressing',
    title: 'Pressing',
    blurb: 'Winning the ball back on purpose: triggers, traps, and the cost of getting it wrong.',
  },
  {
    slug: 'attacking',
    title: 'Attacking',
    blurb: 'Creating and using space in the final third against a set defence.',
  },
  {
    slug: 'set-pieces',
    title: 'Set pieces',
    blurb: 'Dead-ball routines, and how they are defended.',
  },
]

export interface Phase {
  /** 1-indexed, used in the UI and the anchor id. */
  n: number
  title: string
  /** One line under the diagram. Short enough to read in a glance. */
  caption: string
  /** 90–180 words. The substance of the page. */
  body: string
  /** Authored alt text describing what the diagram actually shows. */
  alt: string
  /** Source frame in the Remotion composition. Exact. */
  frame: number
}

export interface System {
  slug: string
  /** The H1. */
  title: string
  /** The query this page exists to answer, phrased as a person types it. */
  question: string
  /** The direct answer. First 40 words carry it. */
  answer: string
  /** Meta description. ~150 chars, written for the click, not the keyword. */
  description: string
  theme: ThemeSlug
  /** Remotion composition id in editor/src/Root.tsx. */
  compId: string
  /** Source runtime in seconds (before the CapCut speed-up). */
  runtimeSeconds: number
  published: string
  updated: string
  /** Three takeaways. The thing a coach would write on a card. */
  principles: string[]
  /** Sibling slugs. */
  related: string[]
  phases: Phase[]
  /** Optional social proof, only where the number is real and checked. */
  plays?: number
}

export const SYSTEMS: System[] = [
  {
    slug: 'defending-in-a-back-four',
    title: 'Defending In A Back Four',
    question: 'How does a back four defend?',
    answer:
      'A back four defends as one connected unit, not as four individuals. One defender pressures the ball, the nearest covers behind him on a diagonal, and the far side tucks in to balance the shape. As the ball moves across the pitch those three jobs are handed down the line: the same four players, a different role each time.',
    description:
      'How a back four actually defends: pressure, cover and balance handed down the line as the ball moves. Six phases, drawn on the board.',
    theme: 'defending',
    compId: 'BackFourShort',
    runtimeSeconds: 20,
    published: '2026-06-05',
    updated: '2026-08-09',
    plays: 2000000,
    principles: [
      'Exactly one defender presses the ball. The other three are solving what happens after the pass.',
      'The presser always has cover behind him, and two neighbours if he is in the middle of the line.',
      'The far-side full-back marks nobody on purpose. His job is the switch, not his winger.',
    ],
    related: ['the-4-4-2-mid-block', 'the-pressing-trap', 'salida-lavolpiana'],
    phases: [
      {
        n: 1,
        title: 'The shape before anything happens',
        caption: 'Four defenders joined into one line, protecting the strip in front of goal.',
        body: "Start with the picture at rest. The goal being defended is on the right, the four defenders are the green counters, and the ball is with the deepest attacker on the far side of the pitch. Two things are worth noticing before anybody moves. The four are joined by a line, and that line is a shallow arc rather than a flat row: the two centre-backs sit fractionally deeper than the full-backs, which is what gives the shape depth. And the shaded band running from that line to the goal is what they are actually protecting: not the ball, not their opponents, but the strip of grass where goals get scored. Everything that follows is a consequence of those two facts.",
        alt: 'Tactics board: four green defenders (right-back, two centre-backs and left-back) joined in a shallow arc in front of the goal on the right, with a shaded band running from the line to the goal, and five red attackers spread across the pitch.',
        frame: 165,
      },
      {
        n: 2,
        title: 'The ball goes wide: pressure, cover, balance',
        caption: 'The full-back presses; the centre-back covers behind him; the far side tucks in.',
        body: "The ball is played out to the wide attacker and the three jobs appear at once, labelled on the board. The left-back steps out to PRESS, quickly at first, then slowing as he arrives so he is balanced and not beaten by the first touch, and angled to show the attacker away from goal rather than square to him. The centre-back beside him does not follow him out. He drops behind and inside on a diagonal, so that if the presser is beaten there is already a second defender in the path: COVER. The other two are marked BALANCE. They have left their direct opponents and tucked toward the middle. That is the part that looks wrong to beginners, two defenders apparently marking nobody, and it is the reason the shape holds.",
        alt: 'Tactics board: the ball is with the red winger on the near flank. The green left-back is labelled PRESS, the nearest centre-back COVER, and the far centre-back and right-back are both labelled BALANCE, tucked infield.',
        frame: 370,
      },
      {
        n: 3,
        title: 'The ball comes inside: the jobs hand over',
        caption: 'A centre-back presses, and now he has cover on both sides of him.',
        body: "The attacker plays the ball infield and every job changes owner without a word being said. The centre-back nearest the ball steps forward to PRESS, meeting the striker before the ball is settled, because a striker allowed to turn here is the entire problem. Look at what happens behind him: there are now two COVER labels, one above and one below. Because the presser is in the middle of the line rather than at its end, he can be beaten on either side, so both neighbours, the other centre-back and the left-back who was pressing a moment ago, drop in to protect a side each. That leaves exactly one man on BALANCE, the right-back, furthest from the ball. Nobody swapped positions. The ball moved, and the responsibilities moved with it.",
        alt: 'Tactics board: the ball has moved infield to a red striker. A green centre-back is labelled PRESS, with COVER labels on both the centre-back above him and the left-back below him, while the right-back is labelled BALANCE.',
        frame: 600,
      },
      {
        n: 4,
        title: 'The line slides, and no gap opens',
        caption: 'The ball climbs to the second striker; the jobs walk one seat up the line.',
        body: "The ball is worked to the other central attacker, higher up the pitch, and the whole line slides with it. The pressing job moves up one: a centre-back still presses, but now it is the ball-side one, and the labels behind him have rotated too: the right-back has become COVER, and the left-back, now furthest from the ball, is the lone BALANCE. The thing worth staring at is the connecting line itself. It has moved several metres up the pitch and changed shape slightly, but the distances between the four have not opened. That is the whole discipline. A line that slides together keeps every gap too small to pass into; a line where one man reacts late puts a door in the middle of the defence.",
        alt: 'Tactics board: the ball is with the higher of two red strikers. A green centre-back is labelled PRESS, the right-back above and the centre-back below are both COVER, and the left-back at the bottom is BALANCE, with the whole line shifted upward and evenly spaced.',
        frame: 830,
      },
      {
        n: 5,
        title: 'The switch: the moment it is decided',
        caption: 'The ball travels across; the whole line slides as one.',
        body: "The ball is released to the far flank and caught here in mid-flight, still travelling. This is the phase that separates a back four from four defenders: the line is already moving. The labels have not caught up yet: a centre-back is still shown pressing the man who has just released it, but the shape underneath is sliding toward where the ball is going, not toward where it is. That head start is the entire margin. A ball crossing the pitch takes something over a second; the defender who has to meet it only has to travel ten or twelve metres, and he can only make that in time if he set off while it was in the air. The right-back, who spent the earlier phases tucked in with no direct opponent, is the man about to receive the pressing job.",
        alt: 'Tactics board: the ball caught in flight on a pass toward the far winger. A green centre-back is still labelled PRESS with the right-back and other centre-back on COVER and the left-back on BALANCE, while the line shifts toward the arriving ball.',
        frame: 900,
      },
      {
        n: 6,
        title: 'Same shape, other side',
        caption: 'The roles hand over again and the picture is a mirror of phase two.',
        body: "The ball arrives and the picture is phase two, reflected. The right-back, the spare man who spent the whole sequence marking nobody, is now the one labelled PRESS. The centre-back inside him is COVER. The remaining centre-back and the left-back, who did the pressing and covering at the start, are now the two on BALANCE. Compare this frame with phase two and the only difference is which end of the line holds which job. That is the whole system. A back four is not four marking assignments; it is three jobs and a rule for who holds them, and the rule is always the position of the ball. Get that right and four players cover the full width of the pitch without any of them running more than a dozen metres.",
        alt: 'Tactics board: the ball is with the red winger on the far flank. The green right-back is now labelled PRESS, the centre-back inside him COVER, and the remaining centre-back and left-back are both BALANCE, a mirror image of phase two.',
        frame: 1090,
      },
    ],
  },

  {
    slug: 'the-4-4-2-mid-block',
    title: 'The 4-4-2 Mid-Block',
    question: 'How does a 4-4-2 mid-block work?',
    answer:
      'A mid-block defends by making the middle of the pitch unavailable and the outside of it inviting. Two banks of four hold a gap of roughly fourteen metres between them, the strikers screen the opponent’s deepest midfielder, and the whole unit slides across as the ball moves. The pass down the touchline is the trigger: the moment it travels, the block stops waiting and presses.',
    description:
      'The 4-4-2 mid-block explained: two banks of four, the gap held shut, the middle denied, and the wide pass as the trigger to press. Six phases on the board.',
    theme: 'defending',
    compId: 'MidBlockShort',
    runtimeSeconds: 24,
    published: '2026-06-14',
    updated: '2026-08-09',
    plays: 60000,
    principles: [
      'The distance between your two banks is the whole system. Roughly fourteen metres, held.',
      'You are not trying to win the ball in the middle. You are making the middle not worth trying.',
      'The touchline is an extra defender: press wide, because he only has half a pitch to escape into.',
    ],
    related: ['defending-in-a-back-four', 'the-pressing-trap', 'salida-lavolpiana'],
    phases: [
      {
        n: 1,
        title: 'Two banks of four',
        caption: 'The shape at halfway, with the gap between the lines measured.',
        body: 'The defending team is in green, its own goal on the left, and the whole thing starts around the halfway line rather than deep. What matters is drawn on the board as a number: the band between the back four and the midfield four is about fourteen metres, and holding it is the entire discipline. Too wide and a midfielder can receive between the lines and turn. Too narrow and the ball simply goes over the top into the space behind. The two strikers stay high as a pair. Nobody in this picture is marking anybody; the block is arranged against the pitch, not against opponents, and that is what lets ten players cover the dangerous ground with eight.',
        alt: 'Tactics board on a full pitch: eight green defenders in two banks of four with a shaded fourteen-metre band drawn between them, two green strikers ahead, and the red team building from the far half.',
        frame: 190,
      },
      {
        n: 2,
        title: 'Deny the middle',
        caption: 'The strikers screen the pivot, and every inside lane dies.',
        body: 'The first job of the two strikers is not to chase centre-backs. It is to stand in the passing lane to the opponent’s deepest midfielder so that the one player who could turn and play forward never receives the ball at all. The board marks the result rather than the effort: no pivot, no pocket, no way through. This is the least glamorous idea in defending and the most valuable. The opposition still has the ball and can pass it sideways all day, but every route that would actually hurt is closed before it is attempted. A team that shuts the middle properly barely has to tackle.',
        alt: 'Tactics board: two green strikers positioned in the passing lanes to the red pivot, with the central passing options crossed out and the two banks of four holding their shape behind.',
        frame: 410,
      },
      {
        n: 3,
        title: 'Slide as one',
        caption: 'The ball goes wide and the whole block shifts with it.',
        body: 'The ball is worked out to a full-back, and all ten players shift toward that side together. The near winger comes across, the far winger tucks all the way infield, and the block arrives on the ball side still holding its shape. It looks like the far side has been abandoned, and it has, deliberately. The furthest opponent is left completely free because a ball travelling all the way across the pitch takes long enough that the block can slide back before it arrives. You are conceding the pass that costs a second and a half in order to deny every pass that costs a tenth of one.',
        alt: 'Tactics board: the ball with a red full-back on one flank; all ten green players have shifted toward that side, the far winger tucked infield, leaving the far-side opponent unmarked.',
        frame: 670,
      },
      {
        n: 4,
        title: 'The trigger',
        caption: 'The pass down the line is the signal: now the block presses.',
        body: 'Everything so far has been patient. This is the moment it stops. The ball is played down the touchline, and because the receiver is facing his own goal with a white line at his shoulder, the whole unit launches at once: the near midfielder presses the ball, the midfielder inside him covers, the full-back steps up rather than dropping off, and the striker cuts back inside to kill the pass to the pivot. The board states why this pass and not another: the touchline is an extra defender. He has no half of the pitch to his left, no forward option, and the man behind him has already been screened.',
        alt: 'Tactics board: the ball played down the touchline to a red winger. Green players are labelled PRESS, COVER, STEP UP and CUT INSIDE, with a shaded touchline zone marked as an extra defender.',
        frame: 900,
      },
      {
        n: 5,
        title: 'Win it, and go',
        caption: 'The ball is won high, and the two who stayed up are the outlet.',
        body: 'The trap closes and the ball is turned over near the opposition’s own third. This is where the two strikers who spent the whole sequence apparently doing nothing earn their place. They never dropped in to help defend, so at the instant of the turnover there are already two attackers ahead of the ball with the opposition’s defence facing the wrong way. A block that wins possession with all ten players behind the ball has won nothing except a goal kick to come. Keeping two high is what converts defending into attacking without a single extra sprint.',
        alt: 'Tactics board: the ball won by a green midfielder near the touchline, with a BALL WON stamp and the two green strikers already positioned ahead of the play as the outlet.',
        frame: 1150,
      },
      {
        n: 6,
        title: 'Two passes, that is all',
        caption: 'The counter lands in exactly the space the press just vacated.',
        body: 'The finish takes two passes. That is not a flourish, it is arithmetic: the opponents committed players forward to build, so the space behind their midfield is at its largest precisely when you take the ball off them. The counter runs straight into the middle of the pitch, the same middle the block spent the whole sequence refusing to let anyone use. That is the quiet symmetry of a mid-block. You make the centre worthless to them for ninety seconds so that it is worth everything to you for four.',
        alt: 'Tactics board: a two-pass counter-attack running through the central space into the red team’s half, finishing in front of their goal.',
        frame: 1315,
      },
    ],
  },

  {
    slug: 'salida-lavolpiana',
    title: 'The Salida Lavolpiana',
    question: 'How do you beat a two-man press when building from the back?',
    answer:
      'You change the arithmetic. Two forwards pressing two centre-backs is a coin flip, so the holding midfielder drops between the centre-backs to make a back three. Two pressers cannot cover three players, which means one is always free, and he steps through the centre the pressers have just vacated.',
    description:
      'The Salida Lavolpiana: drop the six between the centre-backs, turn 2v2 into 3v2, and step through the gap the press leaves behind. Six phases on the board.',
    theme: 'build-up',
    compId: 'SalidaShort',
    runtimeSeconds: 42,
    published: '2026-07-06',
    updated: '2026-08-09',
    plays: 66000,
    principles: [
      'Build-up is arithmetic before it is technique. Add a body and the press stops working.',
      'The free man is created by the drop, not found by luck: two pressers cannot cover three.',
      'When a presser steps out, he leaves the space he was standing in. Play through that space.',
    ],
    related: ['the-4-4-2-mid-block', 'the-pressing-trap', 'defending-in-a-back-four'],
    phases: [
      {
        n: 1,
        title: 'The problem: two against two',
        caption: 'Two forwards, two centre-backs, and no clean way out.',
        body: 'Start where most teams lose the ball. The goalkeeper has it, two centre-backs are split either side of the box, and two opposition forwards are pressing them. That is two against two, and two against two is a coin flip: whichever centre-back receives, a presser arrives with him, and the pass has to be made under pressure with the goal directly behind. Teams respond to this by hitting it long and giving the ball away in a fairer position, or by playing through it and occasionally conceding in the worst place on the pitch. Neither is a plan. The problem is not the players’ nerve; it is the number.',
        alt: 'Tactics board: a green goalkeeper and two green centre-backs in their own third, with two red forwards pressing them one each, a two against two.',
        frame: 540,
      },
      {
        n: 2,
        title: 'Drop the six',
        caption: 'The holding midfielder falls in between the centre-backs.',
        body: 'The fix is one movement. The holding midfielder, the six, drops out of midfield and takes up a position between the two centre-backs, who spread wider to make room. What was a back two is now a back three, built in the moment the press commits rather than set up in advance. Note that nothing about this requires a special player or a rehearsed pattern. It is a body arriving in a place where the opposition has not allocated anyone, and the reason it is named after Ricardo La Volpe is simply that he was the one who insisted on doing it deliberately, every time, rather than as an improvisation.',
        alt: 'Tactics board: the green holding midfielder dropping backwards into the gap between the two centre-backs, who split wider, forming a back three.',
        frame: 920,
      },
      {
        n: 3,
        title: 'Three against two',
        caption: 'The board says it outright: one man free.',
        body: 'Now count. Three players building, two players pressing. Two pressers can cover two men; they cannot cover three, and the board rings the spare one in gold and labels him free. The opposition’s midfielders are marked as unable to follow: if one of them steps forward to make it three against three, he leaves a hole in the middle of their own team, which is a worse problem than the one he is solving. This is the whole idea, and it is worth being precise about it: the free man was not found. He was created, by adding a body the press had not accounted for.',
        alt: 'Tactics board: three green players building against two red pressers, with the dropped midfielder ringed in gold and labelled FREE, and a red midfielder marked as unable to follow.',
        frame: 1292,
      },
      {
        n: 4,
        title: 'Step through the line',
        caption: 'The free man carries into the space the pressers left.',
        body: 'The free man does not just receive; he carries. When the two forwards pressed, they ran past the space they had been standing in, and that space is now the most valuable ground on the pitch: directly through the middle, behind their first line, with nobody in front of the ball. So he steps into it. A pass here would let the defence reset; a carry drags their midfield toward him and forces someone to commit. The board stamps the outcome as the line being broken, which is the honest description. Two opposition players have been taken out of the game by one player walking forward.',
        alt: 'Tactics board: the free green midfielder carrying the ball forward through the central gap between the two red forwards, with a LINE BROKEN stamp.',
        frame: 1657,
      },
      {
        n: 5,
        title: 'The first pass forward',
        caption: 'Into the striker on the half-turn: the press is beaten.',
        body: 'With the first line gone and their midfield pulled toward the ball, the pass forward finally exists. It goes into the striker, who receives on the half-turn rather than with his back to goal, the small detail that turns a possession statistic into an attack. The sequence is now over and worth counting: the opposition committed two players to pressing and got nothing, the defending team has moved the ball from its own six-yard box into the opponent’s half in four passes, and the whole thing was triggered by one midfielder walking backwards ten metres.',
        alt: 'Tactics board: the ball played forward from the central area into a green striker positioned on the half-turn, with a stamp reading the press is beaten.',
        frame: 1986,
      },
      {
        n: 6,
        title: 'The masterclass, in three moves',
        caption: 'Drop · find the spare · step through.',
        body: 'The recap is three words long because the pattern is three moves long. Drop the six between the centre-backs. Find the spare man that the extra body creates. Step through the centre the pressers vacated. Every elite side at the World Cup does some version of this, and the variations are mostly about who drops (a full-back inverting, a centre-back stepping out, a second midfielder joining) rather than about the principle. The principle never changes: if the press has a number, beat the number before you try to beat the player.',
        alt: 'Tactics board recap panel showing the three moves of the pattern: drop the six, find the spare man, step through the middle.',
        frame: 2248,
      },
    ],
  },

  {
    slug: 'the-pressing-trap',
    title: 'The Pressing Trap',
    question: 'How do you press without pressing for the whole game?',
    answer:
      'You do not press constantly; you pick the moment and manufacture it. Shut the middle and leave one door open out to the touchline. When the ball travels through that door, the whole team launches at once, four players collapse on the receiver, and the sideline does the rest of the marking. The ball is won twenty yards from their goal.',
    description:
      'Pressing in bursts, not for ninety minutes: bait the ball wide, trigger on the pass, spring the touchline trap and win it high. Six phases on the board.',
    theme: 'pressing',
    compId: 'PressTrapShort',
    runtimeSeconds: 31,
    published: '2026-07-13',
    updated: '2026-08-09',
    principles: [
      'Nobody can press for ninety minutes. Choose the moment instead of chasing every ball.',
      'A trap needs bait: leave exactly one pass available, and make it the one you want.',
      'Press wide, not central. The touchline removes half of the receiver’s options for free.',
    ],
    related: ['the-4-4-2-mid-block', 'salida-lavolpiana', 'the-underlap'],
    phases: [
      {
        n: 1,
        title: 'You cannot press for ninety minutes',
        caption: 'The honest starting point, so pick your moment.',
        body: 'The high press is sold as an attitude, which is why so many teams fail at it. Physically it is not available for a whole match, let alone seven matches in a summer tournament, and a press that runs out of legs on seventy minutes has spent the game creating the gaps it was supposed to close. The alternative is not to press less hard. It is to press in bursts that you choose in advance, from a stable shape, at a moment when the odds are good. Everything that follows is about manufacturing that moment rather than waiting for it.',
        alt: 'Tactics board: the green team in a settled shape rather than pressing, with a caption stating that a team cannot press for ninety minutes.',
        frame: 330,
      },
      {
        n: 2,
        title: 'The bait',
        caption: 'Shut the inside, show the line, leave one door open.',
        body: 'A trap needs bait, and here the bait is a pass that looks safe. The central lanes are closed, the angles inside are covered, and the only available ball is the one out toward the touchline. From the point of view of the player on the ball this reads as an escape: nobody is within five metres of the receiver, and the pass is easy. That is exactly the impression you want. The board makes the intent explicit: shut the inside, show the line. You are not hoping he plays wide. You have arranged the picture so that it is the only sensible thing to do.',
        alt: 'Tactics board: green players covering the central passing lanes with the inside options crossed out, leaving one open lane out toward the touchline.',
        frame: 670,
      },
      {
        n: 3,
        title: 'The trigger',
        caption: 'The pass is the signal: go the moment it travels.',
        body: 'The trigger is not the receiver taking a touch, and it is not a shout. It is the ball leaving the passer’s foot. A ball in flight cannot be recalled, so the entire defensive unit gets a free head start of roughly a second, the time it takes the pass to arrive. Pressing a player who already has the ball under control is a duel you might lose. Arriving as the ball does is not a duel at all. This single rule is the difference between a press that looks frantic and one that looks coordinated, and it is the reason the whole team can move at the same instant without anyone calling it.',
        alt: 'Tactics board: the ball in flight toward the touchline while multiple green players are already sprinting toward the receiving zone.',
        frame: 900,
      },
      {
        n: 4,
        title: 'The trap',
        caption: 'Four collapse on him, and the sideline does the marking.',
        body: 'Four players arrive at once and each has a different job: one on the ball, one cutting the pass back inside, one on the man ahead down the line, one covering the ball over the top. What makes this affordable is the touchline. A player in the middle of the pitch has options in every direction and would need six defenders to surround; a player on the line has a white stripe doing the work of two of them, so four is enough. The board puts it plainly: the sideline does the marking. Everything the receiver can legally do is now covered by a body or by the edge of the pitch.',
        alt: 'Tactics board: four green players converging on a red player near the touchline, with his backward, inside and forward options each marked as covered.',
        frame: 1140,
      },
      {
        n: 5,
        title: 'The steal',
        caption: 'No way out, and he loses it twenty yards from his own goal.',
        body: 'With no pass available and no space to carry into, the ball is lost. Where it is lost is the entire point. A turnover in your own half gives you possession against a set defence; a turnover here happens with the opposition’s players committed upfield, their defenders isolated, and their goalkeeper the only organised thing between the ball and the net. Winning the ball twenty yards from the opponent’s goal is worth more than any pass you could have made from your own half, and it was produced by five seconds of coordinated running rather than ninety minutes of it.',
        alt: 'Tactics board: the ball won by a green player in the touchline zone deep in the red team’s third, with a stamp reading ball won high.',
        frame: 1360,
      },
      {
        n: 6,
        title: 'One pass from a goal',
        caption: 'Win it there and the shortest route to goal is already open.',
        body: 'The finish needs one pass. That is the return the whole method is built to collect: the reason for choosing the moment, baiting the door, triggering on the flight and accepting that you will spend the other eighty-five minutes in a block. A press is not a style, it is a transaction: you spend a burst of coordinated energy and you buy possession in the one area of the pitch where possession is nearly a chance. Spend it everywhere and you will be too tired to collect. Spend it here and two touches finish the move.',
        alt: 'Tactics board: a short pass from the turnover into a green striker in front of the red goal, with a stamp reading one pass from a goal.',
        frame: 1680,
      },
    ],
  },

  {
    slug: 'the-underlap',
    title: 'The Underlap',
    question: 'What is an underlap in football, and why does it work?',
    answer:
      'An underlap is a full-back running inside his winger rather than around him, into the space between the opposition full-back and centre-back. It works because it forces a decision on one defender who has two jobs: their holding midfielder must either stay with his man or step out to the ball. He cannot do both, and whichever he drops is the player you use.',
    description:
      'The underlap explained as a decision you force, not a lucky run: pin the flank, run inside, make the number six choose, punish the man he leaves.',
    theme: 'attacking',
    compId: 'UnderlapShort',
    runtimeSeconds: 22,
    published: '2026-07-02',
    updated: '2026-08-09',
    plays: 39381,
    principles: [
      'Run inside your winger, not around him. Outside leads to a cross; inside leads to a shot.',
      'The run is not trying to beat anyone. It is trying to make one defender do two jobs.',
      'Whichever job he drops is your goal. Watch the man he abandons, not the man on the ball.',
    ],
    related: ['salida-lavolpiana', 'the-pressing-trap', 'defending-in-a-back-four'],
    phases: [
      {
        n: 1,
        title: 'Hold the width',
        caption: 'The ball goes to the winger, who stays high and wide.',
        body: 'The move starts with the winger doing something deliberately unhelpful-looking: standing still, right on the touchline, as far from the goal as he can be. Width is not a way of attacking here, it is a way of stretching. As long as he stays out there, the opposition full-back has to stay out there with him, and the gap between that full-back and his nearest centre-back is being held open by nothing more than the winger’s refusal to come inside. The whole pattern depends on this first, static beat, which is why it is the one most often skipped.',
        alt: 'Tactics board: the ball played out to a green winger holding a wide position on the touchline, with the red full-back stationed opposite him.',
        frame: 280,
      },
      {
        n: 2,
        title: 'Pin the flank',
        caption: 'The full-back jumps out to the ball, and the space appears behind him.',
        body: 'The winger receives, and the opposition full-back has no choice but to jump out and engage him. He cannot let a winger turn and run at the back four. But the moment he steps forward, the gap he was guarding, the half-space between him and his centre-back, is no longer guarded by anybody, and the board marks him as pinned. Nothing clever has happened yet. One player was made to move by another player standing still, and the space that opened was not created by skill but by the geometry of a defender being in two places at once.',
        alt: 'Tactics board: the red full-back stepping forward to press the green winger, labelled PINNED, with the space behind and inside him now empty.',
        frame: 385,
      },
      {
        n: 3,
        title: 'The underlap',
        caption: 'The full-back runs inside his winger, into the gap behind.',
        body: 'Now the run. The green full-back arrives from deep and goes inside his own winger rather than around the outside of him, straight into the space the pinned defender has vacated. This is the detail the name is about. An overlap goes outside and ends with a cross from near the byline; an underlap goes inside and ends in a shooting position. The winger slips the ball into that channel with the simplest pass available, because the run has already done all the work: nobody is tracking it, since the only player whose job it was is currently facing the other way.',
        alt: 'Tactics board: the green full-back running inside the winger into the half-space, with the ball slipped into that channel behind the pinned red full-back.',
        frame: 480,
      },
      {
        n: 4,
        title: 'Make him choose',
        caption: 'Received in the half-space, and now their six has a problem.',
        body: 'The ball is collected in the half-space, level with the edge of the box, facing goal. This is where the pattern stops being about running and starts being about a decision. Their holding midfielder is currently doing a job: marking the green number eight in the middle. He is also now the only player who can get to the ball. He can do exactly one of those things. The board draws both at once, and it is worth pausing on: the attacking team has not beaten anyone yet. It has simply arranged the pitch so that one opponent has been given two tasks and one body.',
        alt: 'Tactics board: the green full-back on the ball in the half-space near the penalty area, with the red number six shown both marking the green eight and needing to close the ball.',
        frame: 560,
      },
      {
        n: 5,
        title: 'He leaves his man',
        caption: 'The six steps out to the ball, and the eight is free.',
        body: 'He steps out, because he has to: a player on the ball in a shooting position at the edge of the box is the more urgent of his two problems. The instant he does, the man he was marking is free, ringed in gold on the board, standing in the middle of the penalty area with nobody near him. The lay-off is a two-metre pass. Everything that made this goal possible happened before it: a winger who stood still, a full-back who ran the right side of him, and a defender who was asked a question with no good answer. The finish is the least interesting part.',
        alt: 'Tactics board: the red number six stepping out toward the ball, with the green number eight now ringed in gold and labelled the free man in the centre of the box.',
        frame: 635,
      },
      {
        n: 6,
        title: 'The punish',
        caption: 'Laid off to the free man, first time, finished.',
        body: 'The ball is squared and the free man finishes first time. Look back at what actually beat the defence: no dribble, no one-two, no moment of individual brilliance, just four movements, each one forcing a specific defender to make a specific choice, and a finish from the player nobody was left to watch. That is why the underlap survives against organised teams while a lot of prettier patterns do not. It does not ask a defender to be beaten. It asks him to be in two places, which no defender has ever managed.',
        alt: 'Tactics board: the ball laid off square to the free green number eight, who finishes first time past the red goalkeeper.',
        frame: 755,
      },
    ],
  },
]

export const systemBySlug = (slug: string) => SYSTEMS.find((s) => s.slug === slug)

export const systemsByTheme = (theme: ThemeSlug) => SYSTEMS.filter((s) => s.theme === theme)

/** Resolve `related` slugs to systems, dropping any not yet published. */
export const relatedSystems = (system: System) =>
  system.related.map(systemBySlug).filter((s): s is System => Boolean(s))
