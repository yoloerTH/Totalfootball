/**
 * Every help topic points at a control that is really there.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A CODE REVIEW ───────────────────────────────
 *
 * The help panel's promise is that Show me rings the thing. A topic whose
 * `anchor` names a panel that has since been renamed does not fail loudly — it
 * scrolls nowhere, waits its 800ms, and tells a coach the control is "not on
 * screen at the moment", which is a confident lie that will survive for a year
 * because nobody opens the help panel while shipping a rename. The panel titles
 * in StudioEditor.tsx are edited for copy reasons all the time and there is
 * nothing in the type system tying one to the other, so this is the tie.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 *
 * Collects every address a control can be reached by — `Section` and `Panel`
 * headings, which become `data-help` for free (ui.tsx), plus explicit
 * `help=` props on tips and literal `data-help` attributes — then checks every
 * target in guide.ts against that set.
 *
 * It COLLECTS. One run gives the whole punch list, and every fault line carries
 * the nearest real anchor, so the fix is a copy-paste rather than a hunt.
 *
 * Run: node scripts/check-help.mjs
 */

import { readFileSync } from 'node:fs'

/**
 * Every file that can put an address on the screen.
 *
 * THE RAIL IS NO LONGER ONE FILE, and this list is what keeps the check honest
 * about that. `Panel` earns its `data-help` from its own title (ui.tsx), so a
 * panel is an address wherever it is written — and the moment one moved out of
 * StudioEditor.tsx into a component of its own, this check started reporting
 * the topic aimed at it as broken while the ring worked perfectly. Reported the
 * wrong way round, which is the worse direction: a check that cries wolf gets
 * argued with, and the next real fault gets argued with too.
 *
 * ADD A FILE HERE WHEN YOU MOVE A PANEL INTO IT. Hand-listed rather than
 * globbed, so that the set of things that can claim an address stays something
 * a reader can see at the top of this file.
 */
const SOURCES = ['src/studio/editor/StudioEditor.tsx', 'src/studio/editor/Lineup.tsx']
const EDITOR = SOURCES.map((f) => f.replace('src/studio/editor/', '')).join(' or ')
const GUIDE = 'src/studio/editor/guide.ts'

const editor = SOURCES.map((f) => readFileSync(f, 'utf8')).join('\n')
const guide = readFileSync(GUIDE, 'utf8')

/**
 * The substitutions a heading can contain.
 *
 * Hand-listed rather than evaluated, because evaluating a TSX file to read a
 * string literal means a build step for a check whose whole point is to be
 * cheap enough to run every time. If a new one appears the check says so rather
 * than guessing — an unresolved heading is reported, not silently skipped.
 */
const VARS = {
  'PHASE.one': 'phase',
  'PHASE.One': 'Phase',
  'PHASE.many': 'phases',
  'PHASE.Many': 'Phases',
  'DRAWER.board': 'The board',
  'DRAWER.teams': 'Teams and kit',
  'DRAWER.equipment': 'Equipment',
  'DRAWER.phase': 'On this phase',
  'DRAWER.film': 'The film',
  'DRAWER.system': 'This system',
  'DRAWER.sequences': 'My Sequences',
  TEXT_TOOL_ID: 'text',
}

const ARROW_TOOLS = ['pass', 'run', 'carry', 'press', 'switch']

const faults = []
const anchors = new Set()

/** Resolve a template literal's `${...}` against VARS. Null if it cannot be. */
function resolve(raw) {
  let out = raw
  for (const [name, value] of Object.entries(VARS)) {
    out = out.split('${' + name + '}').join(value)
  }
  return out.includes('${') ? null : out
}

/**
 * Headings that cannot be resolved to one string.
 *
 * NOT a fault. Three panels in the right-hand rail are titled from what is
 * selected — "Selected pass", "Phase 2 of 5" — and a heading that is different
 * every render is not an address, by design. They are collected only so that a
 * failing run can show them: if somebody writes a topic aimed at one, the
 * anchor check below is what catches it, and this list is the explanation.
 */
const dynamic = []

// ── 1. headings, which are addresses by virtue of ui.tsx ─────────────────────
for (const m of editor.matchAll(
  /<(Section|Panel)\b[^>]*?\btitle=(?:"([^"]*)"|\{`([^`]*)`\}|\{([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\})/gs,
)) {
  if (m[2] !== undefined) {
    anchors.add(m[2])
    continue
  }
  const raw = m[3] ?? m[4]
  const resolved = m[3] !== undefined ? resolve(raw) : (VARS[raw] ?? null)
  if (resolved === null) dynamic.push(`<${m[1]}> titled \`${raw}\``)
  else anchors.add(resolved)
}

// ── 2. explicit addresses: help= on a Tip, data-help= anywhere ───────────────
for (const m of editor.matchAll(/\bhelp="([^"]+)"/g)) anchors.add(m[1])
for (const m of editor.matchAll(/\bdata-help="([^"]+)"/g)) anchors.add(m[1])

// The two templated ones, expanded by hand for the same reason as VARS.
for (const m of editor.matchAll(/\bhelp=\{`([^`]+)`\}/g)) {
  const raw = m[1]
  if (raw === 'tool:${id}') for (const t of ARROW_TOOLS) anchors.add(`tool:${t}`)
  else {
    const resolved = resolve(raw)
    if (resolved) anchors.add(resolved)
    else
      faults.push({
        kind: 'unresolved',
        detail: `help={\`${raw}\`} uses a substitution this check does not know.`,
        fix: 'Add it to VARS in scripts/check-help.mjs.',
      })
  }
}

// ── 3. the targets, out of guide.ts ──────────────────────────────────────────

/*
 * Read topic by topic rather than with one regex over the file.
 *
 * A target's `anchor` can be a template literal, and a template literal
 * contains a closing brace of its own — so the obvious `target:\s*\{([^}]*)\}`
 * stops in the middle of `${PHASE.one}` and then runs on into the NEXT topic,
 * which is how the first version of this check reported three topics as having
 * no target while quietly reading a fourth one twice. Splitting on the topic
 * boundary first makes every field unambiguous.
 */
const blocks = guide
  .slice(guide.indexOf('export const HELP_TOPICS'))
  .split(/\n  \{\n    id: /)
  .slice(1)

const topics = []
const targets = []

for (const block of blocks) {
  const idMatch = block.match(/^(?:'([^']+)'|`([^`]+)`)/)
  if (!idMatch) continue
  const id = idMatch[1] ?? idMatch[2]
  topics.push(id)

  const anchor = block.match(/anchor:\s*(?:'([^']*)'|`([^`]*)`)/)
  const drawer = block.match(/drawer:\s*DRAWER\.(\w+)/)
  const action = block.match(/action:\s*'(\w+)'/)
  // A `fallback` does NOT excuse a broken anchor. It covers the case where a
  // real control is conditionally absent at runtime; a topic pointing at a
  // heading that has been renamed is still a fault, and would otherwise send
  // every coach to the settings page for an answer that is in the rail.
  const fallback = block.match(/fallback:\s*'(\w+)'/)
  if (fallback && !anchor) {
    faults.push({
      kind: 'orphan',
      detail: `Topic "${id}" has a fallback but no target, so there is nothing for it to fall back FROM.`,
      fix: 'Give it a target, or make the fallback its `action` instead.',
    })
  }
  if (anchor) {
    const raw = anchor[1] ?? anchor[2]
    targets.push({
      id,
      raw,
      anchor: anchor[1] !== undefined ? raw : resolve(raw),
      drawer: drawer ? VARS[`DRAWER.${drawer[1]}`] : null,
    })
  }
  if (!anchor && !action) {
    faults.push({
      kind: 'orphan',
      detail: `Topic "${id}" has neither a target nor an action, so Show me does nothing.`,
      fix: "Give it a target that names a control, or make it a what's-new entry instead.",
    })
  }
}

// The five arrow tools are generated from TOOL_DOC above HELP_TOPICS, so they
// are not blocks and have to be added by hand. They are still checked: a
// toolbar that stopped setting help={`tool:${id}`} would fail here.
for (const t of ARROW_TOOLS) {
  targets.push({ id: `tool-${t}`, anchor: `tool:${t}`, drawer: null })
  topics.push(`tool-${t}`)
}

/** The closest real anchor to a broken one, so the fault line carries the fix. */
function nearest(broken) {
  const want = String(broken).toLowerCase()
  let best = null
  let bestScore = 0
  for (const a of anchors) {
    const have = a.toLowerCase()
    let score = 0
    for (const word of want.split(/[\s:]+/)) if (word.length > 2 && have.includes(word)) score += 1
    if (have.includes(want) || want.includes(have)) score += 3
    if (score > bestScore) {
      bestScore = score
      best = a
    }
  }
  return best
}

for (const t of targets) {
  if (t.anchor === null) {
    faults.push({
      kind: 'unresolved',
      detail: `Topic "${t.id}" has anchor \`${t.raw}\`, which this check cannot resolve.`,
      fix: 'Add the substitution to VARS in scripts/check-help.mjs.',
    })
    continue
  }
  if (!anchors.has(t.anchor)) {
    const near = nearest(t.anchor)
    faults.push({
      kind: 'anchor',
      detail: `Topic "${t.id}" points at "${t.anchor}", and nothing in ${EDITOR} answers to that.`,
      fix: near
        ? `Set anchor to "${near}" — that is the closest heading that exists.`
        : `Add help="${t.anchor}" to the control's <Tip>, or data-help="${t.anchor}" to its wrapper.`,
    })
  }
  if (t.drawer && !anchors.has(t.drawer)) {
    faults.push({
      kind: 'drawer',
      detail: `Topic "${t.id}" opens the drawer "${t.drawer}", and no <Section> has that heading.`,
      fix: `Set it to one of: ${Object.entries(VARS)
        .filter(([k]) => k.startsWith('DRAWER.'))
        .map(([, v]) => `"${v}"`)
        .join(', ')}.`,
    })
  }
}

// ── the punch list ───────────────────────────────────────────────────────────
if (!faults.length) {
  console.log(
    `help check: ${targets.length} targets across ${topics.length} topics, ${anchors.size} addresses. All good.`,
  )
  process.exit(0)
}

const GROUPS = {
  anchor: 'Topics pointing at a control that is not there',
  drawer: 'Topics opening a drawer that is not there',
  orphan: 'Topics with nowhere to go',
  unresolved: 'Headings this check could not read',
}

console.error(`help check: ${faults.length} fault${faults.length === 1 ? '' : 's'}.\n`)
for (const [kind, heading] of Object.entries(GROUPS)) {
  const mine = faults.filter((f) => f.kind === kind)
  if (!mine.length) continue
  console.error(`${heading} (${mine.length}):`)
  for (const f of mine) {
    console.error(`  · ${f.detail}`)
    console.error(`    → ${f.fix}`)
  }
  console.error('')
}
console.error(`Addresses that do exist:\n  ${[...anchors].sort().join('\n  ')}`)
if (dynamic.length) {
  console.error(
    `\nHeadings that are NOT addresses, because they change with what is selected:\n  ${dynamic.join('\n  ')}`,
  )
}
process.exit(1)
