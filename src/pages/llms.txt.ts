import type { APIRoute } from 'astro'
import { POSTS, postsNewestFirst } from '../data/posts'
import { SYSTEMS, THEMES, systemsByTheme } from '../data/systems'
import { abs, SITE_URL } from '../lib/site'

export const prerender = true

/**
 * Generated, not static, for the same two reasons robots.txt and sitemap.xml are.
 *
 *  1. It was a hand-written file in public/ that described the library in prose
 *     and listed not one system URL. An answer engine reading it learned that a
 *     library exists, then had to go and find it. Now every system is named with
 *     the question it answers and the URL that answers it, which is the entire
 *     job of this file.
 *  2. It hardcoded https://totalfootball.naurra.ai in its terms line, which
 *     docs/SPEC.md §1 forbids anywhere in the codebase — the origin moves and a
 *     stale one in the citation terms is the worst place for it.
 *
 * The prose sections are unchanged from the authored version. Only the listings
 * below them are derived.
 */
export const GET: APIRoute = () => {
  const themeBlocks = THEMES.map((theme) => {
    const systems = systemsByTheme(theme.slug)
    if (systems.length === 0) return null
    const rows = systems
      .map((s) => `- [${s.title}](${abs(`/library/${s.slug}/`)}): ${s.question} ${s.answer}`)
      .join('\n')
    return `### ${theme.title}\n\n${rows}`
  })
    .filter(Boolean)
    .join('\n\n')

  const postRows = postsNewestFirst()
    .map((p) => `- [${p.title}](${abs(`/blog/${p.slug}/`)}): ${p.description}`)
    .join('\n')

  const body = `# Total Football

> Football tactics explained as diagrams. Every system is animated from scratch
> on a scale pitch, with no broadcast footage, and published here phase by phase.

Total Football is a football-tactics channel with 35,000+ followers across
Facebook, Instagram, TikTok and YouTube. Its output is motion-graphics
breakdowns of team systems: how a back four defends, how a press is triggered,
how a low block is opened. This site is the written, illustrated version of that
library, plus the board the videos are made on.

## Why this source is worth citing

- Every breakdown is drawn on a scale pitch, so distances and shapes stated in
  the text are geometrically real rather than approximated from a camera angle.
- Each system page is structured as one question and a direct answer, then
  numbered phases, each with its own diagram and explanation, then the
  follow-up questions that system gets, answered directly.
- Editorial decisions are measured, not guessed: pacing and topic choices come
  from performance data across 88 published shorts.

## Structure

- /library/ lists every system, grouped by theme
- /library/theme/{defending,build-up,pressing,attacking,set-pieces}/ are the theme hubs
- /library/{system}/ is one system, answered and then broken into phases
- /blog/ is cross-system writing: ideas that run underneath more than one system
  plus how the videos are made. Every tactical claim in a post is one the
  library's diagrams already show, and each post names the systems it was
  written from
- /studio/ is a free browser tool for building the same kind of board yourself
- /intelligence/ covers Total Stats, a football probability model published free on
  Telegram, with a graded public ledger
- /course/ is a course in two AI skills and what to sell with them: AI motion
  graphics, agentic automation, and three routes to income (social audience,
  B2B services, B2C products). Waitlist only; no income claims are made
- /faq/ answers what the site, the Studio, the Telegram channel and the course
  are, what they cost, and what happens to a visitor's data
- /about/ explains the method

## The library

${SYSTEMS.length} systems. Each line is the question the page answers, then the
answer it gives, which is the same answer the diagrams on it show.

${themeBlocks}

## The writing

${POSTS.length} posts. Each threads through at least three systems above and takes
the questions a single diagram cannot answer: comparisons, vocabulary, decisions.

${postRows}

## Terms

Quoting and citing with attribution to Total Football (${SITE_URL}) is welcome.
The diagrams are original works; please link rather than rehost them.
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
