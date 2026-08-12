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
    related: ['the-back-four-reset', 'the-4-4-2-mid-block', 'the-pressing-trap'],
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
    related: ['how-to-beat-a-diamond', 'defending-in-a-back-four', 'how-spain-caged-france'],
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
    related: ['playing-out-from-the-back', 'the-4-4-2-mid-block', 'the-pressing-trap'],
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
    related: ['when-to-press', 'the-4-4-2-mid-block', 'how-spain-caged-france'],
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
    related: ['how-to-beat-a-diamond', 'salida-lavolpiana', 'the-pressing-trap'],
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

  {
    slug: 'the-back-four-reset',
    title: 'The Back Four Reset',
    question: 'Why does a defensive line step up when the ball goes backwards?',
    answer:
      'Because a backward pass is free time. Nobody has to be marked while the ball is travelling back to the opposition’s holding midfielder, so the line uses that half second to square up and step two and a half metres higher. Do it four times and the same four defenders are eight metres up the pitch, with less ground behind them and a smaller hole every time one of them jumps out.',
    description:
      'Why a back four steps up every time the ball goes back: the reset, drawn four reps over, until the door behind the pressing defender stops opening at all.',
    theme: 'defending',
    compId: 'BackFourResetShort',
    runtimeSeconds: 22,
    published: '2026-08-12',
    updated: '2026-08-12',
    principles: [
      'Every pass backwards is free time. Spend it squaring the line up, not catching your breath.',
      'One man goes to the ball. The other three do not follow him out; they step forward together.',
      'The higher the line starts, the smaller the hole the presser leaves. Height fixes it, not speed.',
    ],
    related: ['defending-in-a-back-four', 'the-4-4-2-mid-block', 'how-spain-caged-france'],
    phases: [
      {
        n: 1,
        title: 'Set, and waiting for the ball to go back',
        caption: 'Four defenders in a flat line, the goal on the right, the ball on their pivot.',
        body: 'The board is a defending half turned on its side: the goal being protected is on the right, the four green defenders are joined into one vertical line, and the shaded strip behind them is the ground they are responsible for. The ball is on the opposition’s holding midfielder, out at halfway on the left, and the ruler drawn between him and the line is the number this whole system is about. The state chip in the corner reads SET, which is the only moment in the next twenty seconds when nothing is happening. Everything from here is one movement repeated: the ball goes out to a man, that man is pressed, the ball comes straight back to the pivot, and the line does something with the half second that buys.',
        alt: 'Tactics board with the defended goal on the right: four green defenders (RB, two CBs, LB) joined in a flat vertical line, a shaded band behind them, four red attackers spread across the pitch and the red number six holding the ball at halfway, with a measured rule drawn between him and the line.',
        frame: 70,
      },
      {
        n: 2,
        title: 'The nearest man jumps, and a door opens',
        caption: 'The left-back steps out to press, and the channel he leaves is shaded gold.',
        body: 'The ball goes out wide and the nearest defender jumps to it. That part is uncontroversial: the left-back steps out to PRESS, and the two centre-backs beside him take COVER while the far full-back holds BALANCE, which is the pattern from the original back four clinic. What this board adds is the cost, drawn rather than described. The channel the presser has just vacated is shaded gold and hatched, and it is measured live from the two defenders either side of it, so the gold is not decoration: it is the actual width of the door his run has opened. Every press does this. The question the rest of the sequence answers is not how to avoid opening the door, but how to make it small enough not to matter.',
        alt: 'Tactics board: the green left-back steps out onto a red winger and is labelled PRESS, the two centre-backs behind him are labelled COVER, the right-back BALANCE, and the channel between the presser and his nearest team-mate is shaded gold and hatched.',
        frame: 280,
      },
      {
        n: 3,
        title: 'The ball goes back, the line goes up',
        caption: 'Nobody chases the backward pass; the four square up and step forward together.',
        body: 'The winger has no forward option, so he plays the ball back to the pivot at halfway. This is the moment the short exists for. Nobody presses it. Chasing a pass backwards is thirty metres of running to arrive out of breath at a player facing his own goal, and the ball will simply be moved again before you get there. Instead the four defenders use the second and a half the ball spends travelling to do two things at once: the presser returns to the line so the four are square again, and the whole unit steps two and a half metres up the pitch. The dashed marker labelled STARTED HERE is where they were standing before this rep, left on the board so the gain is visible rather than claimed. The state chip now reads STEP UP.',
        alt: 'Tactics board: the ball has been played back to the red number six at halfway. The four green defenders are square again and have moved forward, with a dashed line labelled STARTED HERE marking their previous position behind them, and the state chip reading STEP UP.',
        frame: 420,
      },
      {
        n: 4,
        title: 'Same question, asked inside',
        caption: 'A centre-back jumps this time, and the hole he leaves is a bigger one.',
        body: 'The second rep goes into the middle instead of down the line, and the job falls to a centre-back. He steps out to press the striker and the same gold channel appears behind him, except that it is wider now, because a centre-back leaving the line opens a hole in the centre of the goal rather than at the edge of it. Both his neighbours drop into COVER, one above and one below, exactly as they would in any back four. The point of running the pattern a second time from a different starting position is that the viewer can now predict both halves of it: who jumps, and that the line will not drop afterwards. By rep three that prediction is the whole lesson.',
        alt: 'Tactics board: a green centre-back has stepped out to press a red striker and is labelled PRESS, with COVER on the centre-back above him and the left-back below, BALANCE on the right-back, and a wide gold hatched channel through the middle of the line where he was standing.',
        frame: 590,
      },
      {
        n: 5,
        title: 'Less ground to cover',
        caption: 'The third rep, from a starting line already several metres higher.',
        body: 'Third time out, and nothing about the movement has changed. What has changed is where it starts from. The line is now clearly ahead of the STARTED HERE marker, which means the defender who jumps has less distance to travel to reach the ball, gets there sooner, and is therefore out of the line for less time. The gold channel behind him is correspondingly smaller. This is the compounding part of the system and the reason it is worth doing deliberately rather than occasionally: each reset makes the next press cheaper. A back four that drops back to its starting position after every rep pays the same price four times. A back four that keeps the ground it won pays less each time.',
        alt: 'Tactics board: a green centre-back presses a red number ten while the rest of the line holds COVER and BALANCE, with the whole unit standing well ahead of the dashed STARTED HERE marker and a narrower gold channel behind the presser.',
        frame: 880,
      },
      {
        n: 6,
        title: 'Now nothing opens',
        caption: 'The fourth rep: the presser is already there, and the channel is shaded green.',
        body: 'The fourth ball goes wide to the far winger and the right-back meets it almost where he was standing. He has barely left the line, because eight metres of accumulated ground means the man he has to press is now inside the shape rather than beyond it, and the channel behind him is shaded green and stamped SHUT instead of gold. That is the whole system in one frame. Nothing here is about tackling, aggression or reading the game. It is four players agreeing that a ball travelling backwards is time nobody is using, and spending it, every single time, on the two and a half metres that make the next press free.',
        alt: 'Tactics board: the green right-back presses a red winger and carries both a PRESS and a SHUT label, the channel behind him shaded green rather than gold, the two centre-backs on COVER and the left-back on BALANCE, with the whole line far ahead of the dashed STARTED HERE marker.',
        frame: 1200,
      },
    ],
  },

  {
    slug: 'how-to-beat-a-diamond',
    title: 'How To Beat A Diamond',
    question: 'How do you beat a midfield diamond?',
    answer:
      'A diamond has no wide midfielders, so its four men stand inside about twenty-two of the pitch’s sixty-eight metres. Put two players in the pockets either side of it and they follow you in, narrowing it to fourteen. Then switch the ball to the far touchline. The diamond has to travel the full width itself, and grass moves faster than legs.',
    description:
      'Beating a midfield diamond, measured on the board: pin the flanks, stand in the pockets until it narrows to fourteen metres, then switch. Six phases.',
    theme: 'attacking',
    compId: 'DiamondShort',
    runtimeSeconds: 26,
    published: '2026-08-12',
    updated: '2026-08-12',
    principles: [
      'A diamond is not a compact shape, it is a narrow one. Narrow is a decision you can punish.',
      'Stand in the pockets first. Making it narrower is what makes the switch worth playing.',
      'The ball crosses fifty-seven metres while their nearest man covers four. That is the whole idea.',
    ],
    related: ['the-4-4-2-mid-block', 'the-underlap', 'the-pressing-trap'],
    phases: [
      {
        n: 1,
        title: 'Four men, no wingers',
        caption: 'The diamond drawn as a figure, and the width it actually covers measured through it.',
        body: 'A midfield diamond is a holding midfielder, two shuttlers and a number ten, and the shape they make is drawn here as a technical figure: hatched face, doubled edges, rings at the four corners. It is rebuilt every frame from where the four players actually are, so it deforms as they move rather than being a graphic laid over the top. The dimension line runs straight through it at the shuttlers’ own depth and reads twenty metres of sixty-eight. That is the number the whole system turns on. The zone drawn around it is labelled the middle, theirs, and it is theirs: nobody is going to play through a diamond. What matters is that a diamond has no wide midfielders at all, which means the forty-eight metres that dimension line does not cover belong to nobody.',
        alt: 'Tactics board: four red midfielders drawn as a hatched diamond figure in the centre of the pitch, with a dimension line through it reading twenty metres of sixty-eight, a dashed zone around it labelled THE MIDDLE — THEIRS, and green players spread across both flanks.',
        frame: 240,
      },
      {
        n: 2,
        title: 'Stand inside it, and it gets narrower',
        caption: 'Two eights take the pockets, the shuttlers follow them in, twenty becomes fourteen.',
        body: 'The first move is not the switch. It is to put two midfielders in the pockets either side of the diamond, marked INSIDE on the board, and simply stand there. The shuttlers cannot ignore a man receiving between their lines, so they come across, and the moment they do, the dimension line drops from twenty metres to fourteen. That is the trap: the diamond’s virtue is that it is compact, and compactness is exactly what you use against it. Meanwhile both wingers are marked PIN and have not moved a step, which is the discipline the pattern needs. The two lanes outside the shape are now labelled OPEN, and they are open in the literal sense that there is nobody in them at all, twenty-seven metres of grass on either side of a four-man midfield.',
        alt: 'Tactics board: two green midfielders stand in the pockets either side of the red diamond, labelled INSIDE, with the red shuttlers labelled FOLLOWS. The dimension line through the shape now reads fourteen metres of sixty-eight, and the lanes above and below it are labelled OPEN, with the green wingers held wide and labelled PIN.',
        frame: 440,
      },
      {
        n: 3,
        title: 'Now it has to slide',
        caption: 'The ball goes out to the full-back and the whole shape travels, because nobody else can.',
        body: 'The ball is played out to the near full-back, and here is the structural problem a diamond cannot solve. A 4-4-2 sends a winger to the ball and keeps its shape. A diamond has no winger to send, so the nearest man it does have is a shuttler already standing in a pocket in the middle of the pitch, and covering the flank means the entire four-man unit travelling sideways with him. The figure on the board visibly slides across, still fourteen metres wide, still hatched, and the far lane is still labelled OPEN because closing it was never an option. The winger on the far side has been standing on the touchline doing nothing this whole time and is marked STAY WIDE. He is about to be the reason the move works.',
        alt: 'Tactics board: the ball is with a green full-back on the near flank and the red diamond has slid across toward him, still measured at fourteen metres wide, with the far lane still labelled OPEN and the green winger on the far touchline labelled STAY WIDE.',
        frame: 760,
      },
      {
        n: 4,
        title: 'Grass beats legs',
        caption: 'The switch, caught mid-flight: twenty-seven metres of ball against four of runner.',
        body: 'The cross-field pass is released and the board starts two odometers, both integrated live from the same coordinates it is drawing. At this instant the ball has travelled twenty-seven metres and the diamond’s nearest man has covered four. The dashed outline labelled WHERE THEY WERE is the shape frozen at the moment the pass left the boot, held on screen so the live figure can be seen pulling away from its own ghost and still losing the race. This is why the switch is the answer rather than a dribble or a through ball: you are not asking anyone to beat an opponent. You are asking a football to cross fifty-seven metres of pitch faster than four midfielders can, which it does, every time, and the man labelled TOO FAR is the one who was supposed to stop it.',
        alt: 'Tactics board: the ball in flight across the pitch, with two live readouts showing THE BALL at twenty-seven metres and THEIR NEAREST at four. A dashed outline labelled WHERE THEY WERE marks the diamond’s position when the pass was struck, the receiving flank is shaded and labelled THE FAR FLANK, and the nearest red shuttler is marked TOO FAR.',
        frame: 930,
      },
      {
        n: 5,
        title: 'Two on one, and no help coming',
        caption: 'The ball lands on a winger with his full-back overlapping, against one defender.',
        body: 'The ball arrives on the far flank and the picture is the point of everything before it. The winger has it, his own full-back is arriving outside him, and the opposition has exactly one player in the area: their full-back, ringed on the board with the pair of green shirts braced above him. Two against one, and the caption states the part that makes it decisive rather than merely favourable: no help is coming. The four men who would normally cover this are still on the other side of the pitch, forty metres away, because they were made narrow on purpose in phase two and then made to travel in phase three. A diamond does not lose this duel because its full-back is poor. It loses it because there is nobody within four seconds of him.',
        alt: 'Tactics board near the far touchline: a green winger on the ball with the green full-back overlapping beyond him, joined by a brace and labelled 2 v 1, AND NO HELP COMING, with the lone red full-back ringed, and the zone at the byline marked ahead of them.',
        frame: 1120,
      },
      {
        n: 6,
        title: 'Four passes, one switch',
        caption: 'The cutback is finished, and the diamond is still forty metres away.',
        body: 'The overlap reaches the byline, cuts the ball back, and it is finished first time. Count what it took: four passes, one of them a switch, and no player beating another player at any point. Then look at where the diamond is in this frame. It is still drawn, still hatched, still a perfectly good compact shape, sitting forty metres from the ball on the wrong side of the pitch. That is the honest verdict on the system. A diamond wins the middle of the pitch, and the middle of the pitch is only worth winning if the opposition agrees to play there. Make it narrow, then go round it.',
        alt: 'Tactics board: the ball in the net in front of the red goal after a cutback, with the red diamond still drawn as a hatched figure forty metres away in the centre circle, and a rule reading GOAL, FOUR PASSES · ONE SWITCH.',
        frame: 1320,
      },
    ],
  },

  {
    slug: 'how-spain-caged-france',
    title: 'How Spain Caged France',
    question: 'How do you defend against a counter-attacking team with pace?',
    answer:
      'You stop giving them the ball. A counter-attack needs a turnover, so the first rule is to keep possession and never hand one over. The second is to hold your two banks close enough that nothing can be received between them. The third is to put two players on the winger every time, so nobody ever gets a one-against-one. Sprung once, their fastest player just runs into a crowd.',
    description:
      'A defensive masterclass in three rules: keep the ball, shut the space between the lines, and double the winger every time. The World Cup semi-final, phase by phase.',
    theme: 'defending',
    compId: 'CageShort',
    runtimeSeconds: 47,
    published: '2026-08-12',
    updated: '2026-08-12',
    principles: [
      'The best defence against pace is possession. A turnover is the only ball they can run onto.',
      'Compact means the gap between your banks, not how deep you sit. Nothing receives in between.',
      'Never allow a one-against-one on the flank. Two shirts every time, even when it looks excessive.',
    ],
    related: ['the-4-4-2-mid-block', 'the-pressing-trap', 'the-back-four-reset'],
    phases: [
      {
        n: 1,
        title: 'One turnover is all they need',
        caption: 'Drawn before it can happen: three runs, one pass, and the game is gone.',
        body: 'Start with what you are actually defending against, played out as a hypothetical rather than a real ball. The three red arrows are the runs that arrive the instant possession is lost: one straight down the middle, two into the channels either side. The ghosted ball rolling into the space behind the green line is the pass that finds them, and it is one pass, not a build-up. This is why defending a counter-attacking side is not a matter of defending harder. By the time this picture exists you have already lost it, and no amount of tracking back covers fifty metres of grass against forwards who were moving before you were. Everything that follows is an attempt to make sure this frame never happens.',
        alt: 'Tactics board on a full pitch: three dashed red arrows showing the runs France would make on a turnover, one through the middle and two into the channels, with a ghosted ball rolling into the space behind the green defensive line and a label reading ONE TURNOVER = THIS.',
        frame: 540,
      },
      {
        n: 2,
        title: 'Rule one: do not give it back',
        caption: 'The ball circulates through the pivot; the runners have nothing to run onto.',
        body: 'The first rule is the one nobody thinks of as defending. Keep the ball. The green circulation ring runs through the holding midfielder and the two eights, the pivot is marked SHOW FOR IT, and the ball goes round rather than forward because forward is not the point. On the other side of the board the two players the whole plan is built around are marked NO BALL · NO RUN, greyed out and standing still. A forward whose entire value is what he does with fifty metres of space in front of him is worth nothing at all while the opposition has the ball at its own centre-back. This is possession used as a defensive act, and it is the cheapest of the three rules to execute and the one most often skipped.',
        alt: 'Tactics board: a green circulation ring drawn through the holding midfielder and two central midfielders, the pivot labelled SHOW FOR IT, and two red forwards greyed out and ringed with the label NO BALL · NO RUN.',
        frame: 824,
      },
      {
        n: 3,
        title: 'Rule two: shut the lines',
        caption: 'Two banks held close, and the pocket between them hatched shut.',
        body: 'Eventually the opposition gets the ball, and the ten does the obvious thing: he drops into the pocket between the midfield and the defence to receive and turn. The board draws the two banks as solid green rails with the corridor between them hatched over and stamped NOTHING BETWEEN THE LINES. Both centre-backs are marked HOLD THE LINE, which is the instruction that makes it work: the temptation when a ten drops in is to follow him, and following him is what opens the very gap he was looking for. The holding midfielder is marked SCREEN and does the actual work. The receiver gets the ball with his back to goal, no forward option and no room to turn, so he plays it backwards. That is a successful defensive action and nobody made a tackle.',
        alt: 'Tactics board: two green banks drawn as solid rails with the corridor between them hatched over and labelled NOTHING BETWEEN THE LINES, the two centre-backs labelled HOLD THE LINE, the holding midfielder labelled SCREEN, and the red number ten receiving in the pocket with his back to goal.',
        frame: 1321,
      },
      {
        n: 4,
        title: 'Rule three: two on the winger',
        caption: 'The ball goes wide and two shirts arrive together, so the duel never happens.',
        body: 'The ball is worked out to the winger, which is where a team with this attack expects to win the game. Two green players arrive on him at once: the full-back steps out, marked STEP OUT, and the midfielder tucks across to cover, marked COVER. The board calls it what it is, two against one and no dribble, and the counter that matters sits beside it reading zero. Doubling a winger looks wasteful, because it commits two players to one opponent and leaves someone free elsewhere. It is worth it anyway. A one-against-one on the flank against a genuinely elite dribbler is close to a coin flip; a two-against-one is not a duel at all, and the price of losing that coin flip is a shot at goal.',
        alt: 'Tactics board on the flank: a red winger on the ball with a green full-back labelled STEP OUT and a green midfielder labelled COVER converging on him inside a dashed ring, a label reading 2 v 1 — NO DRIBBLE, and a stat chip showing zero dribbles.',
        frame: 1633,
      },
      {
        n: 5,
        title: 'The proof: spring him, and see',
        caption: 'The vertical ball finally goes; the runner arrives into four defenders.',
        body: 'Now the ball everyone has been waiting for. It is played vertically into the striker running in behind, the single pass the entire defensive plan exists to prevent, and it gets through. Watch what he arrives into. Both centre-backs collapse in front of him, the holding midfielder folds back on top of him, and the full-back who was doubling the winger on the far side is sprinting into the middle. The polygon shrinking around him is drawn from those four positions, so it tightens frame by frame as they close. He receives it, and there is no shot, because a shot needs a metre of space and there is not one. The stat chip beside the picture is the summary of the night: zero on target.',
        alt: 'Tactics board near the penalty area: the red striker receives a vertical pass and is enclosed by four green defenders, two centre-backs, the holding midfielder and the recovering left-back, inside a shrinking green polygon labelled RUNS INTO A CAGE, with a stat chip reading zero shots on target.',
        frame: 1988,
      },
      {
        n: 6,
        title: 'The tackle is the goal',
        caption: 'The ball is won in the crowd, and the night ends at 0.26 xG.',
        body: 'The recovering full-back takes the ball off him and the board stamps it BALL WON, which in a defensive clinic is the equivalent of a net rippling. The number in the corner is the honest verdict on the whole method: 0.26 expected goals from ten shots, against an attack that spends the rest of the tournament scoring at will. Read the three rules backwards and they are all the same rule. Keep the ball so there is no turnover. Shut the lines so there is nothing to receive. Double the winger so there is no one-against-one. None of them is about being braver or quicker than the player you are facing. They are about arranging the game so that his best quality never gets a situation to happen in.',
        alt: 'Tactics board: the green left-back wins the ball inside the ring of defenders, marked with a burst and a BALL WON stamp reading THE BEST ATTACK, SHUT OUT, alongside a gold stat chip reading 0.26 for expected goals from ten shots.',
        frame: 2116,
      },
    ],
  },

  {
    slug: 'playing-out-from-the-back',
    title: 'Playing Out From The Back',
    question: 'How do you play out from the back against a man-to-man press?',
    answer:
      'You make an extra man. A man-to-man press has one presser for every player, so the fix is to field one more passer than they have pressers: the centre-backs split and the goalkeeper steps into the line, making three against two. Then invite a presser in, because every man who comes to the ball leaves the man he was marking free.',
    description:
      'Beating a man-to-man press: split the centre-backs, use the keeper as the extra man, bait a presser in, and bounce it first time. Six phases on the board.',
    theme: 'build-up',
    compId: 'PlayingOutShort',
    runtimeSeconds: 33,
    published: '2026-08-12',
    updated: '2026-08-12',
    principles: [
      'Man-to-man presses die to arithmetic. Add one passer and the marking runs out of bodies.',
      'The goalkeeper is a player. Refuse to use him and you are voluntarily a man short.',
      'Marked from behind? Do not turn. One touch back to the man who can see the whole pitch.',
    ],
    related: ['salida-lavolpiana', 'when-to-press', 'the-4-4-2-mid-block'],
    phases: [
      {
        n: 1,
        title: 'They press man for man',
        caption: 'Every green shirt has a red one attached to it, all the way up the pitch.',
        body: 'The board opens with the hardest version of the problem. This is not a block waiting to be played through: it is a man-to-man press, and the short red lines drawn on the diagram are the marking assignments, one red shirt hooked onto every green one from the centre-backs to the wingers. There is no free man anywhere on the pitch, and that is what makes this so uncomfortable to play against. A team facing a zonal block can move the ball until a gap appears. A team facing this has no gaps to wait for, because the shape is not arranged against the pitch at all. It is arranged against the players. Which is also, as it turns out, the weakness.',
        alt: 'Tactics board on a full pitch: green players building from their own goal on the left, each with a red opponent attached by a short marking line, showing a man-to-man press across the whole pitch.',
        frame: 240,
      },
      {
        n: 2,
        title: 'So you hoof it',
        caption: 'The easy way out, drawn and then crossed off.',
        body: 'The instinctive answer is the long one: put it in the sky, let the striker compete, and accept whatever happens. The board draws that pass as a grey arc and stamps it with a cross, and the label is the whole objection. A ball launched into a fifty-fifty is not safety, it is a coin flip you did not have to toss. You had the ball and full control of it, and you have converted that into an even-money contest sixty metres from your own goal, against defenders who are facing the right way and attacking it while your striker is moving backwards. Sometimes it is the correct choice. It is never a plan, and this short exists to show what a plan looks like.',
        alt: 'Tactics board: a long grey arc drawn from the green goalkeeper to the halfway line, marked with a red cross and the note that it is a fifty-fifty you do not need.',
        frame: 420,
      },
      {
        n: 3,
        title: 'Split, and let the keeper in',
        caption: 'The centre-backs go wide, the goalkeeper joins the line: three against two.',
        body: 'Now the fix, and it is arithmetic rather than courage. The two centre-backs split to the edges of the penalty area, marked SPLIT on the board, and the goalkeeper steps up between them, marked +1. That is three players on the first line against the two forwards who are pressing it, and the board says so directly: three against two. Notice what else moves. Both full-backs push up the pitch, which drags their markers with them and empties the ground the build-up needs. Nobody in this picture has done anything technically difficult. Two defenders walked sideways and a goalkeeper walked forward, and the press is now one body short of covering the players in front of it.',
        alt: 'Tactics board in the green team’s defensive third: the two centre-backs have split wide and are labelled SPLIT, the goalkeeper has stepped up between them labelled +1, and a badge reads 3 v 2 on the first line, with both full-backs pushing up.',
        frame: 660,
      },
      {
        n: 4,
        title: 'Invite him in',
        caption: 'The ball goes to a centre-back, and the presser has to come.',
        body: 'A spare man is only worth something if the opposition commits, so the next move is bait. The ball is played to one centre-back and held there, ringed in gold and captioned come and get it. Their forward has no choice: leave a man on the ball at the edge of the box and he is inviting a carry into midfield. So he goes. And the instant he goes, the player he had been marking is unmarked, because a man-to-man press has nobody spare to hand him over to. That is the mechanism the whole pattern is built on, and it is worth stating plainly: every man who presses leaves a man free. You are not beating the press. You are asking it to dismantle itself one runner at a time.',
        alt: 'Tactics board: the ball held by a green centre-back inside his own half, ringed in gold with the caption COME AND GET IT, as a red forward advances to press him and leaves the man he had been marking.',
        frame: 930,
      },
      {
        n: 5,
        title: 'One touch, because he cannot turn',
        caption: 'Into the pivot’s feet, marked from behind, and set straight back.',
        body: 'The pass goes into the holding midfielder, and it goes into his feet on purpose. He is marked from behind, and the board draws the consequence as a red wedge: the whole forward half of the pitch is a direction he cannot take. So he does not try. He plays it first time, one touch, into the space beside him, where the midfielder ringed in gold and labelled FREE is standing facing the right way. This is the least spectacular pass in the sequence and the one that beats the press. A midfielder who receives under pressure and attempts to turn is how possession is lost in the worst area of the pitch; a midfielder who receives and sets it back has used his marker as a wall.',
        alt: 'Tactics board: the ball into the green holding midfielder with a red marker behind him and a red wedge showing the directions he cannot take, while a green midfielder to his side is ringed in gold and labelled FREE.',
        frame: 1150,
      },
      {
        n: 6,
        title: 'Four passes, no fifty-fifties',
        caption: 'The whole move drawn on one board: split, bait, one touch, in behind.',
        body: 'The recap puts the entire sequence on a single pitch, each pass numbered and named. One: goalkeeper to the split centre-back. Two: the bait, held until the presser commits. Three: one touch into the free man. Four: in behind, into the space their own press left when it pushed up. Four passes from the goalkeeper’s hands into the opposition’s defensive third, and not one of them was a contest. That is the honest argument for building this way over hitting it long. It is not that playing out is braver. It is that a team pressing man for man has committed everybody, so the pass that beats the last presser is also the pass that beats the entire team.',
        alt: 'Tactics board recap on a full pitch: the four passes of the move drawn and numbered from the green goalkeeper into the opposition half, labelled SPLIT, BAIT, ONE TOUCH and the fourth still being drawn in behind.',
        frame: 1780,
      },
    ],
  },

  {
    slug: 'when-to-press',
    title: 'When To Press',
    question: 'When should you press in football?',
    answer:
      'Never when you decide to. Only when the ball tells you to, and the ball only says so four ways: it has been played backwards, it has got away from someone’s foot, the man receiving it has his back turned, or it is in the air. Each of those buys you a second in which the player on the ball cannot punish you for arriving.',
    description:
      'The four pressing triggers, timed on the board: the ball goes back, the heavy touch, his back is turned, it is in the air. Four signals, four options gone.',
    theme: 'pressing',
    compId: 'FourTriggersShort',
    runtimeSeconds: 22,
    published: '2026-08-12',
    updated: '2026-08-12',
    principles: [
      'A press is a reaction, not a decision. If nothing triggered it, you are just running.',
      'Compare two clocks: how long he needs to be safe against how long you need to reach him. Shorter clock goes.',
      'Each trigger only deletes one option. Four of them in a row is what actually wins the ball.',
    ],
    related: ['the-pressing-trap', 'playing-out-from-the-back', 'how-spain-caged-france'],
    phases: [
      {
        n: 1,
        title: 'The question nobody answers',
        caption: 'Twenty-two players, a settled shape, and the state word reading HOLD.',
        body: 'Almost every pressing lesson shows a team winning the ball back. Very few answer the question a player actually has to answer in the moment, which is not how to press but when. The board starts with the honest picture: the opposition has the ball at the back, the shape is set, and the single word in the corner reads HOLD. Nobody is moving, and nobody should be. A press launched because a player felt like pressing is the fastest way to open your own team, because the ten men behind the presser have not been told it is happening. The rest of this page is one unbroken possession, and the word in the corner only changes four times.',
        alt: 'Tactics board on a vertical full pitch: the red team in possession at the back with their goalkeeper, the green team holding a settled shape across the middle, and a grey state chip in the corner reading HOLD.',
        frame: 130,
      },
      {
        n: 2,
        title: 'Trigger one: the ball goes back',
        caption: 'It is travelling away from goal, so the ground in front of it is free.',
        body: 'The first signal is a pass played backwards, and the board explains why with the only two numbers it will show you: he needs 1.9 seconds to kill it and look up, we need 1.5 seconds to be on top of him. Shorter clock goes. That is the entire rule, and it is a comparison rather than an instinct. A backward pass is a gift because it is travelling away from the goal being defended, which means the ground in front of it belongs to nobody for as long as it is in flight, and because the man about to receive it will be facing his own goal when he does. The state word flips from HOLD to GO, and it is the ball that flipped it, not the player.',
        alt: 'Tactics board: the red team playing the ball backwards while a readout compares the 1.9 seconds the receiver needs against the 1.5 seconds the pressing team needs to reach him, with the state chip now reading GO.',
        frame: 330,
      },
      {
        n: 3,
        title: 'Trigger two: the heavy touch',
        caption: 'The ball gets away from his foot and his head goes down.',
        body: 'The second signal is a bad first touch, and the threshold is drawn rather than felt: the caption fixes it at five and a half metres between his foot and the ball. What makes it a trigger is not the distance itself but what the distance does to him. A player chasing his own touch has his head down, which means he cannot see a pass even if one exists, and he arrives at the ball moving away from where he wanted to go. The board tags him LOST IT and marks the nearest green player GO. Note that nobody has tackled anything yet. The press is simply arriving at a player who has, for about a second, no ability to punish it.',
        alt: 'Tactics board: a red player has taken a heavy touch and is chasing the loose ball, tagged LOST IT with a live distance readout beside it, while the nearest green presser is ringed in gold and marked GO.',
        frame: 505,
      },
      {
        n: 4,
        title: 'Trigger three: his back is turned',
        caption: 'He receives facing his own goal, so the forward pass does not exist.',
        body: 'The third signal is the cheapest of the four, because it requires nothing to go wrong for the opposition at all. A player who receives with his back to the goal he is attacking cannot play forward, and a player who cannot play forward cannot hurt you no matter how good he is. So you can arrive on him without any cover behind, which is normally the risk that makes pressing expensive. The board stamps the outcome FORCED BACK, and that word is the honest description of what has been achieved: not a turnover, just one more direction deleted. Three triggers in and the opposition have been pushed wide, then inside, then backwards, without a single duel being contested.',
        alt: 'Tactics board: a red midfielder receiving with his back to the goal he is attacking, closed down by two green players, with a red stamp reading FORCED BACK across the picture.',
        frame: 730,
      },
      {
        n: 5,
        title: 'Trigger four: it is in the air',
        caption: 'One and a half seconds of flight, and nine of ours move before it lands.',
        body: 'The last signal is the one that wins it, and it is the only one that involves the whole team. The ball has been launched, and the board labels the flight time: one and a half seconds. That is not much for one player and it is an enormous amount for eleven, which is why every green token on this frame has a short line drawn out in front of it. Nine players are already moving to where the ball will land rather than watching it get there. A ball in the air cannot be recalled, cannot change direction and cannot be shielded, so the team that starts moving at the moment of contact arrives with numbers around the drop and the team that waits arrives one at a time.',
        alt: 'Tactics board: a long ball drawn in flight with a gold tag reading 1.5s IN THE AIR, while nine green players each carry a short movement line showing they are already running toward where it will land.',
        frame: 920,
      },
      {
        n: 6,
        title: 'Won it, twenty-seven metres out',
        caption: 'Four signals, four options deleted, and the ball is theirs no longer.',
        body: 'The ball is won twenty-seven metres from the opposition goal, and the sub-line is the summary worth taking away: four signals, four options gone. Look back at what actually happened over the whole sequence. Nobody made a tackle until the very last moment. Each press deleted exactly one option — forced wide, then forced inside, then forced back — and the fourth trigger was simply the option they had left. That is the difference between pressing as an attitude and pressing as a system. A team that chases the ball spends its energy on the ninety per cent of moments where nothing is available. A team that waits for these four spends it only where the ball has already done half the work.',
        alt: 'Tactics board: a green player has won the ball twenty-seven metres from the red goal, marked with a green WON IT stamp, with the headline reading WON IT 27 m OUT.',
        frame: 1018,
      },
    ],
  },

  {
    slug: 'the-set-piece-masterclass',
    title: 'The Set-Piece Masterclass',
    question: 'How do teams score from corners and free-kicks?',
    answer:
      'Not by putting it in the mixer. Every routine that works does the same thing: it moves one specific defender out of one specific piece of grass, then puts the ball there. A near-post flick drags the zone forward, a legal screen takes the marker away from the target, a short corner pulls a man out to change the angle, and a worked free-kick uses a dummy to delay the wall’s reaction.',
    description:
      'Four dead-ball routines drawn step by step: the inswinger, the screen, the short corner and the worked free-kick, and why they decide tournament football.',
    theme: 'set-pieces',
    compId: 'SetPieceShort',
    runtimeSeconds: 47,
    published: '2026-08-12',
    updated: '2026-08-12',
    principles: [
      'A routine is not a delivery. It is a way of removing one defender from one specific patch of grass.',
      'Attack the near post. A ball flicked on travels away from the goalkeeper and toward the far post.',
      'Always leave two or three back. The counter off a defensive corner is the fastest goal in football.',
    ],
    related: ['the-underlap', 'defending-in-a-back-four', 'the-4-4-2-mid-block'],
    phases: [
      {
        n: 1,
        title: 'Tight games are decided by dead balls',
        caption: 'The set-up, and the reason it is worth this much preparation.',
        body: 'Knockout football is low-event football. Two well-organised teams cancel each other out for ninety minutes and the margin comes from the one situation where the ball is stationary, the positions are chosen rather than reacted to, and the whole thing can be rehearsed. The board opens with the figure it is built on: at the 2018 World Cup a record share of goals, around forty-three per cent, came from set pieces. That is why every serious side now employs someone whose entire job is dead balls. Note the two centre-backs left outside the box on the left of the picture, marked as the ones staying home: the first rule of attacking a corner is always leaving two or three back, because a counter-attack from a defensive corner is the cheapest goal in the game.',
        alt: 'Tactics board of an attacking corner: green attackers arranged in the penalty area against slate-coloured defenders and their goalkeeper, with two green centre-backs held outside the box and a note that a record share of goals at the 2018 World Cup came from set pieces.',
        frame: 330,
      },
      {
        n: 2,
        title: 'Routine one: the inswinger',
        caption: 'Attack the near post, flick it on, and let the far man finish.',
        body: 'The first routine is drawn as four numbered steps. One, the taker delivers an inswinger. Two, a runner attacks the near post, arriving early and in front of his marker. Three, he does not try to score: he flicks it on, glancing the ball across the six-yard box. Four, the far-post man finishes it. The reason this beats a good goalkeeper is geometry. An inswinging ball is already travelling toward the goal, so a defender who touches it helps it on its way, and a flick at the near post redirects it into the one strip of ground a keeper cannot come for, behind his own body and beyond his own line of vision. The near-post run is the whole routine. The finish is a formality.',
        alt: 'Tactics board of a corner: a green taker delivering an inswinger drawn as a curved line, with four numbered steps marked TAKER, NEAR-POST RUN, FLICK ON and FAR-POST FINISH across the six-yard box.',
        frame: 690,
      },
      {
        n: 3,
        title: 'Routine two: the screen',
        caption: 'A legal block takes the marker away, and the target heads it unopposed.',
        body: 'The second routine attacks the marking rather than the space. One green player, marked as the screen, positions himself in the path the defender must run to follow his man, and simply stands there. He is not holding anybody, which is what makes it legal; he is occupying ground first, and the defender has to go around him. In the two-tenths of a second that detour costs, the target has separated and the delivery arrives on a player nobody is close enough to challenge. The board highlights the block itself as the key moment rather than the header, which is the correct emphasis. A free header from eight metres is not a skill. Manufacturing one against a defender who was marking properly is.',
        alt: 'Tactics board of a corner: the delivery drawn in flight while a green screening player, ringed in gold and labelled BLOCK, stands in the path of the slate defender, freeing the green target to attack the header.',
        frame: 1170,
      },
      {
        n: 4,
        title: 'Routine three: the short corner',
        caption: 'Two against one at the flag, to drag a defender out and change the angle.',
        body: 'The third routine does not put the ball into the box at all, at first. A second attacker comes short to the corner flag, making it two against one in that corner, and the defending team has to send someone out to deal with it or concede a free crosser. The board labels the outcome plainly: make it two against one. Two things are gained at once. The defending box loses a body, and the delivery, when it does come, arrives from ten metres further infield and along the goal rather than across it, which is a far harder ball to defend and a far easier one to attack. A short corner is not caution. It is a way of improving the cross before you have taken it.',
        alt: 'Tactics board of a corner played short: a green taker and a second green player at the corner flag making it two against one, with numbered steps for the short pass, the whipped delivery and the finish at the back post.',
        frame: 1650,
      },
      {
        n: 5,
        title: 'Routine four: the worked free-kick',
        caption: 'A dummy, a delay, and a late run to the back post.',
        body: 'The last routine is the training-ground ball, and it works on the defenders’ eyes rather than their positions. One player runs over the ball and leaves it, which is the dummy, and the wall and the back line both react to a strike that never comes. A second player delays, holding the ball for the extra beat that the reaction costs them, before whipping it in. Meanwhile a runner who was standing still through all of it goes late to the back post. Every part of this is about timing rather than technique: the delivery is ordinary, the run is ordinary, and the goal comes from the half second in which eleven defenders were watching the wrong player.',
        alt: 'Tactics board of an attacking free-kick: a green player running over the ball as a dummy, a second green player delaying before whipping it in, and numbered steps marking the delivery and a late run to the back post.',
        frame: 2130,
      },
      {
        n: 6,
        title: 'Why this decides tournaments',
        caption: 'The one moment in football that can be rehearsed, in the games that need it most.',
        body: 'Everything else in football is a reaction to something an opponent did. A dead ball is the only moment where a team gets to choose all eleven positions in advance, against a defence that must also stand still, in a situation it can practise a hundred times. That is why the dedicated set-piece coach has gone from an oddity to a fixture on serious staffs, and why it matters most in tournament football, where preparation time is short, opponents are unfamiliar and knockout games are tight by definition. Open play rewards the better team over ninety minutes. Set pieces reward the better-prepared one over four seconds, and a tournament is decided in four-second increments.',
        alt: 'Tactics board: the settled attacking and defending shapes around the penalty area after the routines, with the caption DEAD BALLS WIN WORLD CUPS.',
        frame: 2530,
      },
    ],
  },
]

export const systemBySlug = (slug: string) => SYSTEMS.find((s) => s.slug === slug)

export const systemsByTheme = (theme: ThemeSlug) => SYSTEMS.filter((s) => s.theme === theme)

/** Resolve `related` slugs to systems, dropping any not yet published. */
export const relatedSystems = (system: System) =>
  system.related.map(systemBySlug).filter((s): s is System => Boolean(s))
