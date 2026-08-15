/**
 * The site's questions, in one place.
 *
 * WHY THIS FILE EXISTS RATHER THAN FAQ MARKUP SPRINKLED INTO PAGES
 *
 * Four surfaces need the same answers and must never disagree: /faq/, the FAQ
 * block at the foot of the page each group belongs to, the FAQPage JSON-LD, and
 * (eventually) llms.txt. Authoring them once here is what stops the homepage
 * saying the Studio is free while /faq/ hedges.
 *
 * AUTHORING RULES
 *
 *  · An answer states a fact the product actually has. Every claim below is
 *    traceable to code or to a data file — the seven-character link is
 *    studio/share.ts, the 900px door is editor/SmallScreen.tsx, the ledger
 *    numbers are data/intelligence.ts. If you cannot point at the source, do
 *    not write the sentence.
 *  · Plain text, no HTML. These strings go into JSON-LD verbatim, and a stray
 *    tag there is a validation error rather than a link. When an answer wants
 *    to send somebody somewhere, use `more`.
 *  · `id` is authored and permanent. It is the anchor a link points at, so it
 *    must survive the question being reworded — which is exactly the thing a
 *    slugified-from-the-question id cannot do.
 *  · One question, one job. Two questions bolted together with "and" is two
 *    entries, because a reader scanning the list is reading only the summaries.
 */

export interface FaqItem {
  /** Permanent anchor. Never regenerate from the question text. */
  id: string
  q: string
  /** Plain text. Ends up in JSON-LD as-is. */
  a: string
  /** Optional follow-through, rendered under the answer. Not in the schema. */
  more?: { href: string; label: string }
}

export interface FaqGroup {
  id: string
  /** Heading on /faq/, and the nav label in the jump list. */
  title: string
  /** One line under the heading. Also the group's summary on /faq/. */
  blurb: string
  items: FaqItem[]
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'basics',
    title: 'The short version',
    blurb: 'What this is, who makes it, and what it costs.',
    items: [
      {
        id: 'what-is-total-football',
        q: 'What is Total Football?',
        a: 'A football tactics library, published as diagrams rather than clips. Every system is drawn from scratch on a scale pitch and taken apart phase by phase: how a back four slides across, how a press is triggered, how a low block is opened. The short videos run on social; this site is the written, illustrated version of the same library, plus the board the videos are made on.',
        more: { href: '/library/', label: 'Browse the library' },
      },
      {
        id: 'real-footage',
        q: 'Do you use real match footage?',
        a: 'Never. Every frame is drawn. A broadcast clip shows you one camera angle of one moment, and the four players who moved at the same time are usually outside the frame, which is the part you actually needed to see. Drawing it means the whole shape is visible at once and the distances are geometrically real rather than guessed from a camera angle.',
        more: { href: '/about/', label: 'How the videos are made' },
      },
      {
        id: 'is-it-free',
        q: 'Is any of this free?',
        a: 'The whole library is free to read, the Studio is free to use, and the daily card on Telegram is free to follow. There is no paywall and no trial anywhere on the site. The only thing that will ever be paid is the course, and that is not built yet.',
      },
      {
        id: 'who-makes-it',
        q: 'Who makes it?',
        a: 'Total Football is published by NAURRA AI LTD, a company registered in Cyprus, number HE 493756. The same operation draws the videos, writes this site, builds the Studio and runs the Total Stats model. You can reach it at athanasios@naurra.ai.',
        more: { href: '/about/', label: 'About Total Football' },
      },
      {
        id: 'who-is-it-for',
        q: 'Do I need to be a coach to get anything out of it?',
        a: 'No. Everything here assumes you watch football and nothing beyond that. Coaches use the boards in sessions, players use them to understand what their role is asking of them, and supporters use them to see what is happening away from the ball. Nothing is written in badge-course language.',
      },
      {
        id: 'how-often',
        q: 'How often is something new published?',
        a: 'Roughly one system a week into the library, and the same one goes out in the weekly email. Eighty-eight breakdowns have been published across the channels so far, watched more than five million times.',
      },
      {
        id: 'reuse',
        q: 'Can I use the diagrams with my own team?',
        a: 'Yes, and that is what they are for: show them in a session, put them on a screen in a dressing room, send them to a player. If you want to republish one publicly, credit Total Football and link to the page rather than rehosting the image.',
      },
    ],
  },

  {
    id: 'library',
    title: 'The library',
    blurb: 'Reading a system, and finding the right one.',
    items: [
      {
        id: 'where-to-start',
        q: 'Which system should I read first?',
        a: 'Defending In A Back Four. It is the most-watched breakdown on the channel by a distance, and it teaches the idea every other defending system is built on: pressure, cover and balance handed down a line of four as the ball moves.',
        more: { href: '/library/defending-in-a-back-four/', label: 'Start there' },
      },
      {
        id: 'video-required',
        q: 'Do I have to watch the video to follow a page?',
        a: 'No. Each page carries every phase in order (the diagram, a caption and the explanation) and reads top to bottom as an illustrated article on its own. The video is the same lesson compressed into twenty seconds.',
      },
      {
        id: 'board-colours',
        q: 'What do the colours on the board mean?',
        a: 'Green is the team being taught and slate is the opposition. A gold ring or a label marks the one thing that phase is about: the player pressing, the free man, the block, the door being left open. If something is highlighted, it is the point of that frame.',
      },
      {
        id: 'organisation',
        q: 'How is the library organised?',
        a: 'By theme: defending, build-up, pressing, attacking and set pieces. Each theme has its own page listing every system in it, and each system links to three siblings at the foot of the page, so following the game rather than the menu gets you somewhere sensible.',
        more: { href: '/library/', label: 'All themes' },
      },
      {
        id: 'phase-count',
        q: 'How long does a system take to read?',
        a: 'Five to seven minutes. A system is five to seven phases, each one a diagram and about a hundred and fifty words, and the phases are numbered so you can leave one half-read and come back to it.',
      },
      {
        id: 'request',
        q: 'Can I ask for a system to be covered?',
        a: 'Yes. Reply to any newsletter or email athanasios@naurra.ai with the question you actually want answered, phrased the way you would ask a coach, not the way you would title a video. A good share of the library started as one of those.',
      },
    ],
  },

  {
    id: 'studio',
    title: 'The Studio',
    blurb: 'The board itself: what it does, what comes out, and what it costs.',
    items: [
      {
        id: 'studio-what',
        q: 'What is the Studio?',
        a: 'The same board the videos are drawn on, handed over. Pick a pitch, pick one of twenty-four formations and eleven counters stand in it. Move them to where the ball takes them, and the movement between the two positions comes back as film.',
        more: { href: '/studio/', label: 'See the Studio' },
      },
      {
        id: 'studio-cost',
        q: 'Does the Studio cost anything?',
        a: 'No. It is free, there is nothing to install, and there is no trial that expires. It runs in the browser you already have open.',
      },
      {
        id: 'studio-account',
        q: 'Do I need an account?',
        a: 'To build a board, yes: sign in with Google and you are on it. To watch one, no: a board somebody shares with you opens on any device with no app, no account and no sign-in at the other end.',
      },
      {
        id: 'studio-animate',
        q: 'Do I have to animate anything?',
        a: 'No, and there is no timeline to learn. You pose the board at one moment, add a phase and pose it at the next. The movement between the two poses is worked out for you. It asks you to think the way you already do at a whiteboard.',
      },
      {
        id: 'studio-phone',
        q: 'Does it work on a phone?',
        a: 'It works, but it is honestly better on a laptop: the editor has a panel of controls down each side of the board and they need about nine hundred pixels of width to sit alongside it. On a small screen the Studio says so once and offers to send you the link for later, then lets you carry on anyway. Finished boards play perfectly on a phone.',
      },
      {
        id: 'studio-share',
        q: 'How do I send somebody a board?',
        a: 'You get a seven-character link. It opens on any phone, needs no app and no account, and if you change a phase afterwards everyone who already has the link sees the new version, so you do not have to send it again.',
      },
      {
        id: 'studio-file',
        q: 'Can I get a video file rather than a link?',
        a: 'Yes. The Studio encodes an MP4 on your own machine, landscape or vertical, with the ball audible every time it moves. It needs a reasonably recent browser (Chrome 94, Edge, Safari 16.4 or Firefox 130 and up), and because the encoding happens locally, the board never leaves your computer to make the file.',
      },
      {
        id: 'studio-pdf',
        q: 'Can I print a board for a session?',
        a: 'Yes. Print any shared board and you get one phase a page with your notes underneath. It prints as vector rather than a screenshot, so it stays sharp at any size, which makes the same print sheet a perfectly good PDF to hand out.',
      },
      {
        id: 'studio-saving',
        q: 'Where is my work saved?',
        a: 'In your own browser first, within a keystroke of every change, then synced up to your account behind that. A dropped connection in the middle of a session cannot cost you the board, because the local copy is the one that was always authoritative.',
      },
      {
        id: 'studio-private',
        q: 'Is what I build private?',
        a: 'Yes. Your boards sit in your account and nobody else can see them. A board becomes visible to other people only when you create a share link for it, and only to whoever you send that link to.',
      },
      {
        id: 'studio-branding',
        q: 'Can I put my club on it?',
        a: 'Yes. Your name and your club sit at the foot of every board, with ours beside them. Set it once in settings and everything you share after that is signed.',
      },
    ],
  },

  {
    id: 'intelligence',
    title: 'Total Stats',
    blurb: 'The daily card on Telegram, and the record behind it.',
    items: [
      {
        id: 'stats-what',
        q: 'What is Total Stats?',
        a: 'A rated model that prices a match before any bookmaker price is looked at, compares its own probability to the median across the market, and backs only the disagreement. One card a day, free on Telegram.',
        more: { href: '/intelligence/', label: 'See the record' },
      },
      {
        id: 'stats-cost',
        q: 'Is it free, and is there an upsell?',
        a: 'It is free and there is nothing to buy. The channel is public and every card posted in it is posted to everybody at the same time.',
      },
      {
        id: 'stats-record',
        q: 'What is the actual record?',
        a: 'Ninety-eight graded picks across seventeen cards on national sides: plus 9.63 units returned on 28.2 units staked. The rate quoted as the headline is plus seven percent over the last ten cards, not the plus thirty-four percent all-time figure, because the all-time number is still carried by a hot start in late June and saying otherwise would be flattering the record.',
      },
      {
        id: 'stats-losers',
        q: 'Do you publish the losing bets?',
        a: 'Every one, in the same detail as the winners, in a table anybody can read. Every pick is written down before kickoff and graded after it. That is the only part of this that cannot be faked, which is why it is the part the page leads with.',
      },
      {
        id: 'stats-frequency',
        q: 'Why are there days with no card?',
        a: 'Because on most days, on most matches, the model and the market agree closely enough that there is nothing worth backing after the margin. On those days nothing gets posted. A tipster who finds a bet every day is not finding bets.',
      },
      {
        id: 'stats-advice',
        q: 'Is this betting advice?',
        a: 'No. It is 18+, it is published for information only, it is not financial or betting advice, and nothing about it is guaranteed. Never stake money you cannot afford to lose.',
      },
    ],
  },

  {
    id: 'course',
    title: 'The course',
    blurb: 'Two AI skills, and the three systems that turn them into income.',
    items: [
      {
        id: 'course-what',
        q: 'What is the course?',
        a: 'Twelve parts in three tracks. The first is AI motion graphics: the two video styles, the reusable engine, choreography, sound you own the rights to, and shipping. The second is AI automation and engineering: agentic workflows that watch a source, pull the data, draft the asset and queue the post, and what it takes to run one for somebody other than yourself. The third is the money: the three systems that sell either skill.',
        more: { href: '/course/', label: 'The full outline' },
      },
      {
        id: 'course-money',
        q: 'Does it actually teach how to make money from this?',
        a: 'Yes, and it is a third of the course rather than a bonus module at the end. Three routes are covered in the detail it takes to run one: social, where an audience pays through platform programmes, sponsors and affiliates; B2B, where the same two skills are sold to clubs, agencies, brands and any operation with a manual process eating its week; and B2C, where you build a template, a membership or a course once and sell it repeatedly. The offer, the pricing, and the part that goes wrong first, for each.',
      },
      {
        id: 'course-claims',
        q: 'Are there income guarantees?',
        a: 'None, and there are no revenue screenshots on the page either. What is taught is the method, plus the real numbers behind this operation: eighty-eight published shorts, measured, and the automation running on top of them. What you earn with it depends on you, your market and your effort. Anybody in this category who promises otherwise is selling you the screenshot.',
      },
      {
        id: 'course-why-you',
        q: 'Why learn this from you?',
        a: 'Because it is the day job, not a side project. Total Football is published by Naurra AI, which builds these systems for paying clients: ten are published as case studies, across travel, automotive, legal, e-commerce, HVAC, CRM and media. One of the ten is this channel, built with the same method and now past five million plays. Everything in the course has been shipped for somebody who paid for it.',
        more: { href: 'https://naurra.ai/case-studies/', label: 'Read the case studies' },
      },
      {
        id: 'course-when',
        q: 'When does it open?',
        a: 'It is not built yet, and the page says so rather than pretending otherwise. The waitlist is what decides the order it gets built in, and everyone on it hears first.',
      },
      {
        id: 'course-price',
        q: 'What will it cost?',
        a: 'Early access is a founding rate of 39 euro a month, locked for the life of the membership, and the number of places at that rate is limited. Nothing is charged now: joining the list takes a name and an email and nothing else.',
      },
      {
        id: 'course-for-who',
        q: 'Who is it for?',
        a: 'Somebody who wants to make this kind of work rather than watch more of it: an editor or designer adding AI motion graphics, a creator who wants the machine that posts without them, a freelancer looking for a service worth retaining, or an analyst or coach with a channel. You finish with one finished video, one workflow still running, and one offer written down and priced.',
      },
      {
        id: 'course-football',
        q: 'Do I need to care about football?',
        a: 'No. Football is the worked example because it is what this operation has measured to death, but nothing in the three tracks is sport-specific. The engine pattern is the same for a product tour or a process diagram, the agents do not know what a fixture is, and the three ways of selling are the three ways anything like this gets sold.',
      },
      {
        id: 'course-coding',
        q: 'Do I need to be able to code?',
        a: 'You need to be comfortable with tools, not with computer science. The automation half is built from nodes, triggers and the services you already pay for rather than written from scratch, and where code does appear it is short and handed to you. If you have ever wired two apps together and been annoyed at the seam, you are the right level.',
      },
    ],
  },

  {
    id: 'practical',
    title: 'Email, privacy and contact',
    blurb: 'What you get if you subscribe, and what happens to your data.',
    items: [
      {
        id: 'newsletter',
        q: 'What do I get if I subscribe?',
        a: 'One system a week: the diagram, the principle behind it, and the detail most people miss. No spam, no filler, no daily digest, and one click unsubscribes you.',
      },
      {
        id: 'tracking',
        q: 'Do you track me?',
        a: 'Not in the way that word usually means. The site sets no cookies, stores nothing that identifies you, and uses no third-party analytics SDK. It counts page views so it is possible to tell which systems people read. That is also why there is no cookie banner: there is nothing to consent to.',
        more: { href: '/privacy/', label: 'The privacy policy' },
      },
      {
        id: 'optout',
        q: 'Can I opt out of being counted?',
        a: 'Yes, and it takes one click. "Do not count my visit" sits at the foot of every page on the site, and it holds until you undo it.',
      },
      {
        id: 'contact',
        q: 'How do I get in touch?',
        a: 'Email athanasios@naurra.ai. Corrections to anything in the library are especially welcome, because the boards are drawn to scale and if one of them is wrong it should be fixed rather than defended.',
      },
      {
        id: 'follow',
        q: 'Where else can I follow it?',
        a: 'Facebook, Instagram, TikTok and YouTube for the videos, and Telegram for the daily Total Stats card. Every link is in the footer of this page.',
      },
    ],
  },
]

export const faqGroup = (id: string): FaqGroup => {
  const group = FAQ_GROUPS.find((g) => g.id === id)
  // Loud rather than silent: a mistyped id would otherwise ship a page with a
  // missing section that nobody notices until it is indexed that way.
  if (!group) throw new Error(`Unknown FAQ group: ${id}`)
  return group
}

/** Every question on the site, for the /faq/ page's schema and for llms.txt. */
export const ALL_FAQS: FaqItem[] = FAQ_GROUPS.flatMap((g) => g.items)

/**
 * FAQPage JSON-LD.
 *
 * docs/SPEC.md §7 rules out FAQPage markup for the *rich result*, and that is
 * still right: Google restricted the FAQ rich result to authoritative
 * government and health sites in August 2023, so nobody is getting an
 * accordion in the SERP out of this. The narrow case where it still earns its
 * bytes is a page whose main content genuinely IS a list of questions, where
 * the markup is a true description of the document and the readers that matter
 * are the answer engines — which the same section of the spec identifies as a
 * real channel for this site.
 *
 * So: emitted on /faq/ only. Not on the homepage, not on a system page, not on
 * any page carrying an FAQ block as one section among many, because on those
 * pages the markup would be a claim about the document that is not true.
 */
export function faqPageSchema(items: FaqItem[], url: string, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name,
    url,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}
