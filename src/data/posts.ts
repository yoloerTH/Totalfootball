/**
 * The writing. One entry per post.
 *
 * ── READ THIS BEFORE ADDING A POST ───────────────────────────────────────────
 *
 * docs/SPEC.md §0 says, in as many words, "do not build this as a blog", and it
 * says it on evidence: the naurra.ai audit measured 46 blog pages producing 16
 * clicks in 90 days. That decision was reversed by the owner on 2026-08-22 with
 * the evidence in front of him, so this exists. What has NOT been reversed is
 * the reason behind it, so the format is constrained to the one shape that is
 * not a prose-volume play:
 *
 *  1. A post must THREAD THROUGH AT LEAST THREE LIBRARY SYSTEMS. It exists to
 *     say the thing no single system page can say, and to link the systems that
 *     demonstrate it. A post that could have been a system page should have
 *     been one.
 *  2. It must not target a system page's query. `how does a back four defend`
 *     belongs to /library/defending-in-a-back-four/ and competing with our own
 *     page for it costs us both. Posts take the queries a diagram cannot
 *     answer: comparisons, vocabulary, and decisions.
 *  3. Every tactical claim must already be true on the boards. Same rule as the
 *     library (docs/SPEC.md §13, lesson 1): write from what the diagrams show,
 *     not from knowledge of the game. Each post below was written from the
 *     `answer` and `principles` of the systems in its `systems` list, and
 *     nothing in it teaches something those boards do not.
 *  4. Numbers about this operation come from src/data/channel.ts and nowhere
 *     else. An invented number is the one mistake this site cannot afford.
 *
 * There are deliberately no /blog/topic/ hub pages. Two topics over five posts
 * would be two near-empty pages competing with /library/theme/ hubs that cover
 * the same ground with real content behind them. The index groups by topic
 * instead, which is organisation without thin duplicates.
 *
 * DATES ARE NOT BACKDATED. All five launch posts carry the day they were
 * written. Staggering them across the previous fortnight would have looked like
 * a habit rather than a launch, and this site's whole position is that the
 * checkable version beats the impressive one.
 */

/** Blog topics. Deliberately NOT the library's themes: see note 2 above. */
export type PostTopic = 'principles' | 'method'

export interface Topic {
  slug: PostTopic
  title: string
  blurb: string
}

export const TOPICS: Topic[] = [
  {
    slug: 'principles',
    title: 'Principles',
    blurb:
      'The ideas that run underneath more than one system. Vocabulary, comparisons, and the decisions a diagram cannot make for you.',
  },
  {
    slug: 'method',
    title: 'The method',
    blurb:
      'How this is made, and what the numbers said when we checked. Every frame drawn, nothing claimed that is not measured.',
  },
]

/**
 * A block of a post.
 *
 * Prose is authored as blocks rather than as a markdown blob because the
 * typography rules then live in one component instead of in a stylesheet that
 * has to guess. `system` is the important one: it drops a real card into the
 * flow at the moment a system is named, which is what makes a post a route into
 * the library rather than a page about it.
 *
 * Inline, `p`/`list`/`pull` text supports exactly two marks, and no others:
 *   [text](/path/)   a link
 *   **text**         bold
 * See `inline()` at the foot of this file.
 */
export type Block =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'list'; items: string[] }
  /** A line worth stopping on. One per post at most; two is a poster, not an article. */
  | { t: 'pull'; text: string }
  /** The caveat, the correction, the thing that would be dishonest to leave out. */
  | { t: 'note'; text: string }
  /** A card into the library, in the flow. */
  | { t: 'system'; slug: string; label: string }
  /**
   * A board, in the flow. The whole reason this site can write prose at all: a
   * post that makes a claim about shape should show the shape.
   *
   * `caption` is optional and defaults to the phase's OWN caption from
   * systems.ts, which is already authored and already true. Override it only
   * when the post is pointing at the board for a different reason than the
   * library page was — never to restate the same line in new words.
   */
  | { t: 'figure'; system: string; phase: number; caption?: string }

export interface Post {
  slug: string
  /** The H1. */
  title: string
  /** The standfirst. One sentence, under the title, before anything else. */
  dek: string
  /** Meta description, ~150 chars, written for the click. */
  description: string
  topic: PostTopic
  published: string
  updated: string
  /** Library slugs this post threads through. Three minimum: see note 1. */
  systems: string[]
  body: Block[]
}

export const POSTS: Post[] = [
  // ── principles ───────────────────────────────────────────────────────────
  {
    slug: 'narrow-is-not-compact',
    title: 'Narrow is not compact',
    dek: 'Two words used as if they mean the same thing. One of them is a strength you build. The other is a weakness you can punish.',
    description:
      'Compact is the vertical gap between your lines. Narrow is how much width your players occupy. Confusing them is why teams defend the middle and concede anyway.',
    topic: 'principles',
    published: '2026-08-22',
    updated: '2026-08-22',
    systems: ['how-to-beat-a-diamond', 'how-spain-caged-france', 'the-4-4-2-mid-block'],
    body: [
      {
        t: 'p',
        text: 'Listen to enough analysis and the two words arrive together, as if one implies the other: the block was compact and narrow, they stayed narrow and compact. They are not the same measurement. They are not even measured in the same direction, and the difference decides whether a shape is a fortress or a target.',
      },
      {
        t: 'p',
        text: '**Compact is vertical.** It is the distance between your lines, and specifically the gap a pass can be received in. **Narrow is horizontal.** It is how much of the pitch’s sixty-eight metres your players actually stand on. A team can be one without the other, and the interesting cases are exactly the ones where it is.',
      },
      { t: 'h2', text: 'Compactness is a number you hold' },
      {
        t: 'p',
        text: 'The 4-4-2 mid-block is the cleanest illustration of the vertical version, because in that system compactness is not a feeling, it is roughly fourteen metres between the two banks of four, held while the whole unit slides. Nothing is supposed to be receivable in between. That is the entire mechanism: not the position of the block on the pitch, but the size of the gap inside it.',
      },
      {
        t: 'system',
        slug: 'the-4-4-2-mid-block',
        label: 'The gap between the banks, phase by phase',
      },
      {
        t: 'p',
        text: 'Which is why depth and compactness get confused too. Sitting deeper does not make you compact; it just moves the same gap closer to your own goal. Spain against France is the version of this worth copying, because holding the banks close enough that nothing receives between them is the second of the three things that stopped a team built entirely on running into space.',
      },
      { t: 'figure', system: 'how-spain-caged-france', phase: 3 },
      {
        t: 'system',
        slug: 'how-spain-caged-france',
        label: 'Compact, and what it actually cost France',
      },
      {
        t: 'pull',
        text: 'Compact means the gap between your banks, not how deep you sit.',
      },
      { t: 'h2', text: 'Narrowness is a decision, and it can be forced' },
      {
        t: 'p',
        text: 'Now the horizontal one, where it stops being a virtue. A midfield diamond has no wide midfielders at all, so its four players stand inside about twenty-two of the pitch’s sixty-eight metres. That is narrow. It is not compact in any sense that helps, because the compression is in the direction the ball does not have to travel.',
      },
      {
        t: 'p',
        text: 'And it gets worse if you help it. Put two players in the pockets either side of the diamond and it follows you in, down to something like fourteen metres of occupied width. You have made an already narrow shape narrower, on purpose, and now the switch to the far touchline is worth playing: the diamond has to travel the whole width itself, and grass moves faster than legs.',
      },
      {
        t: 'system',
        slug: 'how-to-beat-a-diamond',
        label: 'Narrow it first, then switch it',
      },
      { t: 'h2', text: 'Why it matters if you are the one defending' },
      {
        t: 'p',
        text: 'Because the instruction "get compact" is heard by most players as "come inside", and coming inside is the horizontal move. A team that hears it that way ends up occupying less width with the same vertical holes it started with: narrower, no more compact, and now with two touchlines nobody is responsible for.',
      },
      {
        t: 'list',
        items: [
          'Compact is a vertical distance between your own lines. You hold it by moving together, not by dropping.',
          'Narrow is horizontal occupation. Against a shape that is already narrow, making it narrower is the attack.',
          'A block that is narrow and not compact has a hole in the middle of it and no width. That is the worst of both.',
        ],
      },
      {
        t: 'note',
        text: 'Every distance quoted here is one the boards are drawn to, not an estimate typed into a paragraph. Fourteen metres between the banks, sixty-eight metres of pitch, twenty-two occupied by a diamond and fourteen once it follows you in.',
      },
      {
        t: 'p',
        text: 'Two words, two directions. Ask which one somebody means the next time they use both in the same sentence, and quite often the answer is that they have not decided.',
      },
    ],
  },

  {
    slug: 'the-extra-man',
    title: 'The extra man',
    dek: 'Build-up is arithmetic before it is technique. Two ways to make three against two, and what the pressing team does about it.',
    description:
      'A two-man press against two centre-backs is a coin flip. Drop the six or step the goalkeeper in and it stops being one. How the salida and playing out from the back solve the same sum.',
    topic: 'principles',
    published: '2026-08-22',
    updated: '2026-08-22',
    systems: ['salida-lavolpiana', 'playing-out-from-the-back', 'the-pressing-trap'],
    body: [
      {
        t: 'p',
        text: 'Most coaching about playing out of the back is about technique: body shape, the weight of the pass, the first touch away from pressure. All of it true, all of it downstream of a sum that has usually already been lost.',
      },
      {
        t: 'p',
        text: 'Two forwards pressing two centre-backs is two against two. Nobody is free. Every pass is contested, and whether the ball survives depends on whether your centre-back is better under pressure than their striker is at pressing. That is a coin flip, and you do not build a plan on a coin flip. You change the arithmetic instead.',
      },
      { t: 'pull', text: 'Add a body and the press stops working.' },
      { t: 'h2', text: 'Solution one: drop the six' },
      {
        t: 'p',
        text: 'The salida lavolpiana takes the holding midfielder and drops him between the two centre-backs, making a back three. Two pressers cannot cover three players. One of the three is therefore always free, and because the two forwards have committed forward to press, the middle they left is exactly where he steps through.',
      },
      {
        t: 'p',
        text: 'The important part is that the free man is created rather than found. Nothing about it depends on the pressers making a mistake. They can do their job perfectly and there is still a spare player, because there are three of them and two of you.',
      },
      { t: 'figure', system: 'salida-lavolpiana', phase: 3 },
      { t: 'system', slug: 'salida-lavolpiana', label: 'The drop, and the man it frees' },
      { t: 'h2', text: 'Solution two: use the goalkeeper' },
      {
        t: 'p',
        text: 'Against a man-to-man press the same sum appears in a harder form: they have a presser for every one of your players, so dropping a midfielder just drags his marker down with him. The fix is to field one more passer than they have pressers. The centre-backs split, the goalkeeper steps into the line, and it is three against two again.',
      },
      {
        t: 'p',
        text: 'Then you invite one in. Under man-to-man marking every presser who comes to the ball leaves the player he was responsible for, so pressure is not something that happens to you, it is something you spend. The team that refuses to use its goalkeeper here is choosing to be a man short in a system that is decided by counting.',
      },
      {
        t: 'system',
        slug: 'playing-out-from-the-back',
        label: 'Splitting the centre-backs, and the invitation',
      },
      { t: 'h2', text: 'And what the pressing team does about it' },
      {
        t: 'p',
        text: 'If build-up is arithmetic, then pressing well means refusing to be outnumbered by the sum. The answer is not more pressers. It is to stop pressing everywhere and press one place: shut the middle, leave a single door open out to the touchline, and go when the ball travels through it. Four players collapse on the receiver and the sideline does the rest of the marking.',
      },
      {
        t: 'p',
        text: 'A trap turns the numbers back around, because the whole team arrives at one player at once instead of two forwards arriving at three. It also explains why the extra man works even against very good pressing teams: they are not trying to beat your build-up everywhere. They are waiting for one pass.',
      },
      { t: 'system', slug: 'the-pressing-trap', label: 'The door you leave open on purpose' },
      {
        t: 'list',
        items: [
          'Count before you coach. Two against two is a coin flip whatever the technique.',
          'Drop the six against a two-man press, step the goalkeeper in against man-to-man.',
          'The free man is produced by the structure, not discovered. If it depends on an opponent’s error, it is not a build-up plan.',
        ],
      },
      {
        t: 'note',
        text: 'None of this is an argument for playing out under all circumstances. It is an argument that if you are going to, the sum comes first and the technique carries it afterwards.',
      },
    ],
  },

  {
    slug: 'one-presses-three-solve',
    title: 'One presses, three solve',
    dek: 'Watch a back four for one phase and you see four defenders. Watch it for six and you see four jobs being handed down a line.',
    description:
      'Exactly one defender presses the ball at any moment. The other three are already solving the next pass. How the jobs move, and what a backward pass buys you.',
    topic: 'principles',
    published: '2026-08-22',
    updated: '2026-08-22',
    systems: ['defending-in-a-back-four', 'the-back-four-reset', 'how-spain-caged-france'],
    body: [
      {
        t: 'p',
        text: 'The most common way to watch a defensive line is to watch the ball, which means watching whichever defender is nearest to it. Do that and a back four looks like four individuals taking turns. Watch the other three instead and something more organised appears: at any moment exactly one of them is pressing, and the rest are not watching him. They are solving what happens after the pass.',
      },
      { t: 'h2', text: 'The jobs, and how many of each' },
      {
        t: 'p',
        text: 'There is one press. There is cover behind the presser, always, and two neighbours covering when the presser is in the middle of the line rather than at its end. Whoever is furthest from the ball tucks in to balance the shape, which is the least visible job and the one that decides whether a switch of play hurts.',
      },
      {
        t: 'p',
        text: 'The count is the tell. A line where two players go to the ball has stopped being a line, because the cover the presser was promised has left to press as well. A line where nobody goes has invited the ball to be carried into it.',
      },
      { t: 'pull', text: 'Exactly one defender presses the ball. The other three are solving what happens after the pass.' },
      { t: 'h2', text: 'The jobs walk, the players do not' },
      {
        t: 'p',
        text: 'Then the ball moves across the pitch, and the jobs move with it: the same four players, one role each, a different role than they had a moment ago. The man who was pressing becomes the cover, the cover becomes the balance, and the far side steps in. Nobody swaps positions. The responsibilities walk one seat up the line.',
      },
      {
        t: 'p',
        text: 'This is why a back four can be taught as a unit and not as four jobs learned separately. There is one system with four seats in it, and every defender will sit in all of them within a phase or two.',
      },
      { t: 'figure', system: 'defending-in-a-back-four', phase: 2 },
      {
        t: 'system',
        slug: 'defending-in-a-back-four',
        label: 'The four jobs, handed down the line',
      },
      { t: 'h2', text: 'What a backward pass is worth' },
      {
        t: 'p',
        text: 'The line also has to get up the pitch, and it cannot do it while it is being asked to mark. So it uses the moments when it is not: while the ball is travelling backwards to the opposition’s holding midfielder, nobody has to be marked at all. That half second is free time, and it is spent squaring up and stepping about two and a half metres higher.',
      },
      {
        t: 'p',
        text: 'Do it four times and the same four defenders are eight metres further up, with less grass behind them and a smaller hole every time one of them jumps out to press. It is the least athletic way to win territory available: the line does not sprint, it collects.',
      },
      {
        t: 'system',
        slug: 'the-back-four-reset',
        label: 'Two and a half metres, four times',
      },
      { t: 'h2', text: 'What it is worth against pace' },
      {
        t: 'p',
        text: 'The obvious objection is a fast forward and the space behind a high line. The answer Spain used against France is that a counter-attack needs a turnover to exist, so the first defence against pace is possession: never hand one over. The second is compactness, so nothing can be received between the lines. The third is doubling up on the winger every single time, so nobody ever gets a one-against-one.',
      },
      {
        t: 'p',
        text: 'Sprung once, their fastest player runs into a crowd. That crowd is the same four jobs, being done in the same order, by four players who never had to be told which one was theirs.',
      },
      {
        t: 'system',
        slug: 'how-spain-caged-france',
        label: 'Two players on the winger, every time',
      },
      {
        t: 'note',
        text: 'One structural detail worth watching for, because it holds across every phase we have drawn: the presser has one cover when he is at the end of the line, and two when he is in the middle of it. The line does not decide that. Geometry does.',
      },
    ],
  },

  {
    slug: 'four-triggers-two-clocks',
    title: 'Four triggers and two clocks',
    dek: 'A press is a reaction, not a decision. What the ball has to do first, and how to know whether you can get there.',
    description:
      'The ball only invites a press four ways: backwards, loose, received with the back turned, or in the air. Then compare two clocks and go.',
    topic: 'principles',
    published: '2026-08-22',
    updated: '2026-08-22',
    systems: ['when-to-press', 'the-pressing-trap', 'the-4-4-2-mid-block'],
    body: [
      {
        t: 'p',
        text: 'Nobody presses for ninety minutes. Everybody knows it, and most teams still press as though the alternative were laziness, which is how you end up with players sprinting at a centre-back who has time to look up and play over the top of everyone who just left.',
      },
      {
        t: 'p',
        text: 'The useful reframing is that a press is not something you decide to do. It is something the ball invites, and it only issues that invitation four ways.',
      },
      { t: 'h2', text: 'The four triggers' },
      {
        t: 'list',
        items: [
          '**The ball goes backwards.** It is travelling away from your goal and the receiver is facing the wrong way at the moment it arrives.',
          '**The ball gets away from someone’s foot.** A heavy touch is time, and it is time the receiver did not plan on spending.',
          '**The receiver has his back turned.** He cannot see what is behind him, and turning is the only way to find out.',
          '**The ball is in the air.** Nobody can play a pass while it is up there, so the clock runs for free.',
        ],
      },
      {
        t: 'p',
        text: 'Each of those buys you a second in which the player on the ball cannot punish you for arriving. That second is the whole product. If none of them has happened, the run is not a press, it is running.',
      },
      { t: 'figure', system: 'when-to-press', phase: 3 },
      { t: 'system', slug: 'when-to-press', label: 'The four triggers, on the board' },
      { t: 'h2', text: 'Then compare two clocks' },
      {
        t: 'p',
        text: 'A trigger tells you a press is available. It does not tell you it is yours. That is a comparison of two clocks: how long the man on the ball needs to be safe, against how long you need to reach him. If your clock is shorter, go. If it is not, going is a gift.',
      },
      {
        t: 'pull',
        text: 'If nothing triggered it, you are just running.',
      },
      {
        t: 'p',
        text: 'It is a comparison a player can actually make at speed, which is more than can be said for most pressing instructions. Distance and body shape are both visible from where he is standing.',
      },
      { t: 'h2', text: 'Or stop waiting and manufacture one' },
      {
        t: 'p',
        text: 'The four triggers are things that happen to you. A trap is the same idea run forwards: shut the middle, leave exactly one pass available out to the touchline, and make it the pass you want played. When the ball goes through that door the whole team launches at once, four players collapse on the receiver, and the sideline marks for you.',
      },
      {
        t: 'p',
        text: 'The bait is the part people leave out. A trap with no open pass is just a compact block, and a compact block is a fine thing to be, but it is waiting rather than hunting.',
      },
      { t: 'system', slug: 'the-pressing-trap', label: 'Bait, door, and the four who arrive' },
      { t: 'h2', text: 'Where the block fits' },
      {
        t: 'p',
        text: 'This is also the honest answer to "press or sit". A mid-block is not the opposite of pressing. It makes the middle of the pitch unavailable and the outside of it inviting, holds about fourteen metres between its banks, and waits. Then the pass down the touchline travels, and the block stops waiting.',
      },
      {
        t: 'p',
        text: 'The block is the setup, the trigger is the cue, and the press is the last two seconds of a plan that started long before anybody ran. Teams that look like they press constantly are usually just very good at arranging the moments.',
      },
      { t: 'system', slug: 'the-4-4-2-mid-block', label: 'Inviting the pass you are ready for' },
      {
        t: 'note',
        text: 'Nothing here argues for pressing less. It argues for pressing at the four moments when it is nearly free, and for building the shape that produces a fifth.',
      },
    ],
  },

  // ── method ───────────────────────────────────────────────────────────────
  {
    slug: 'why-we-stopped-making-technique-shorts',
    title: 'Why we stopped making technique shorts',
    dek: 'Eighty-eight shorts, one honest look at the numbers, and a format change we did not want to make.',
    description:
      'Seven of 23 whole-team system clinics broke 20,000 plays. One of 36 individual-technique shorts did. What that changed about everything we publish.',
    topic: 'method',
    published: '2026-08-22',
    updated: '2026-08-22',
    systems: ['the-underlap', 'defending-in-a-back-four', 'the-4-4-2-mid-block'],
    body: [
      {
        t: 'p',
        text: 'For a long time this channel made two kinds of video. One kind taught a technique: how to strike a ball with the outside of the foot, how to turn away from a marker, how to time a jump. The other kind put a whole team on the board and explained a system.',
      },
      {
        t: 'p',
        text: 'They felt like the same product. Same board, same drawing, same voice. The numbers say they are not the same product at all.',
      },
      { t: 'h2', text: 'The number that decided it' },
      {
        t: 'p',
        text: 'Across everything published: **7 of 23 whole-team system clinics broke 20,000 plays. 1 of 36 individual-technique shorts did.** Not a small edge. Roughly a seven-fold difference in the rate at which a video finds an audience, on the same channel, in the same style, in the same week.',
      },
      {
        t: 'pull',
        text: '7 of 23 system clinics broke 20,000 plays. 1 of 36 technique shorts did.',
      },
      {
        t: 'p',
        text: 'The temptation at that point is to explain it away, and there is always a way to. Different thumbnails, different weeks, the algorithm. But 36 attempts is not a sample you get to dismiss, and the one that did break through was not a technique short that worked, it was a technique short about a decision.',
      },
      { t: 'h2', text: 'Why we think it happens' },
      {
        t: 'p',
        text: 'A technique is something you already know exists. You have seen the outside-of-the-foot pass a thousand times, and watching a diagram of it confirms rather than reveals. A system is a thing you have watched for years without being able to name. Seeing it drawn is the first time it holds still.',
      },
      {
        t: 'p',
        text: 'The best watch-through rate on the channel is 65%, on the underlap, and the underlap is the smallest system we have ever drawn: one full-back running inside his winger instead of around him. It is not big. It is a decision that forces another decision, and that is apparently the shape of thing people finish watching.',
      },
      { t: 'figure', system: 'the-underlap', phase: 4 },
      { t: 'system', slug: 'the-underlap', label: 'The 65% one' },
      { t: 'h2', text: 'What changed downstream' },
      {
        t: 'p',
        text: 'Every video became a system, and the library on this site is built from the ones that already proved it. That is also why the pages here are structured as phases rather than as articles: the phase is the unit that worked on video, so it is the unit the page is built from.',
      },
      {
        t: 'system',
        slug: 'defending-in-a-back-four',
        label: 'The one that has been watched the most',
      },
      {
        t: 'p',
        text: 'It changed the shape of individual videos too. A system needs a state to change, so there is always a before and an after: a block that holds and then goes, a line that sits and then steps. A technique short has one state and a repetition, which is a demonstration rather than a story.',
      },
      { t: 'system', slug: 'the-4-4-2-mid-block', label: 'A block that waits, then does not' },
      { t: 'h2', text: 'The part that is not about the numbers' },
      {
        t: 'p',
        text: 'One thing did not change and will not: every frame is drawn. There is not a single clip of broadcast footage in 88 shorts. That started as an ethical position about using other people’s pictures and turned out to be a practical one as well, since nothing here can be claimed by anybody.',
      },
      {
        t: 'p',
        text: 'It also means the board can show things a camera cannot. A camera films where the ball is. A diagram can hold the far side of the pitch on screen while the ball is nowhere near it, and the far side is usually where the system is.',
      },
      {
        t: 'note',
        text: 'Every figure here comes from src/data/channel.ts, which is the site’s single source for its own numbers and carries the date each was confirmed. If a number appears on this site without a source behind it, that is a bug.',
      },
      {
        t: 'p',
        text: 'The honest summary is that we made 36 of something before checking whether it worked. The library is what happened after we checked.',
      },
    ],
  },
]

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug)

export const postsByTopic = (topic: PostTopic) => POSTS.filter((p) => p.topic === topic)

/** Newest first, which is the only order a dated blog is allowed to have. */
export const postsNewestFirst = () =>
  [...POSTS].sort((a, b) => b.published.localeCompare(a.published))

/**
 * Siblings: same topic first, then anything, never itself. Three of them,
 * because a post with no way onward is a dead end and a dead end is where a
 * session stops.
 */
export const relatedPosts = (post: Post, count = 3) =>
  [...POSTS]
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => Number(b.topic === post.topic) - Number(a.topic === post.topic))
    .slice(0, count)

/** Words of body prose, for the reading estimate. */
export const wordCount = (post: Post) =>
  post.body.reduce((n, block) => {
    // Cards and boards are furniture, not prose: counting them would inflate
    // the reading estimate with words nobody reads as a sentence.
    if (block.t === 'system' || block.t === 'figure') return n
    const text = block.t === 'list' ? block.items.join(' ') : block.text
    return n + text.split(/\s+/).length
  }, 0)

/** 220 wpm, rounded up, floor of one. Nobody wants "0 min read". */
export const readMinutes = (post: Post) => Math.max(1, Math.round(wordCount(post) / 220))

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The only two inline marks a post may use, applied AFTER escaping so authored
 * text can never inject markup. Anything else is a paragraph, a list or a
 * block, which is the point: a post that needs a third mark needs a new block
 * type and a decision about how it should look, not a stray <span>.
 */
export function inline(text: string): string {
  return escapeHtml(text)
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="font-medium text-ink underline decoration-ink-hair underline-offset-4 transition-colors hover:decoration-ink">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
}

/**
 * The board a post leads with, for the OG card and the Article schema.
 *
 * DERIVED, never authored: the post's first figure, or failing that phase 1 of
 * the first system it threads through. A hand-set hero would be one more field
 * that can point at a diagram the post no longer uses. Every post threads at
 * least three systems (rule 1), so this always resolves.
 */
export const heroFor = (post: Post) => {
  const fig = post.body.find((b) => b.t === 'figure') as
    | Extract<Block, { t: 'figure' }>
    | undefined
  const slug = fig?.system ?? post.systems[0]
  const n = fig?.phase ?? 1
  return { slug, n, path: `/library/${slug}/phase-${String(n).padStart(2, '0')}.png` }
}
