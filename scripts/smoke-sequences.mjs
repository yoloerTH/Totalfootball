/**
 * The two things a coach does that no unit test can prove: change the pitch
 * view, and drop a saved sequence on a board.
 *
 * ── WHY A BROWSER ────────────────────────────────────────────────────────────
 *
 * scripts/check-transform.mjs proves the geometry — every view pair, every
 * mirror, every mark. What it cannot prove is that the editor WIRES that
 * geometry to the picker and to the Apply dialog. Both faults this exists to
 * catch were exactly that shape: `remapSystem` called a walk that had quietly
 * stopped carrying `texts`, `gear` and `act.shot`, and the Apply dialog never
 * passed a placement to a function that took one. Every unit in both paths was
 * correct on its own.
 *
 * So this opens the studio the way a coach does and reads the pixels back.
 *
 * ── WHAT IT ASSERTS ──────────────────────────────────────────────────────────
 *
 *  1. A cone, a written label and a player all put on the penalty spot are
 *     still on top of each other after switching from the full pitch to their
 *     box. Before the fix they were 70px apart on a 740px board.
 *  2. Applying a sequence adds its counters and moves NOTHING that was already
 *     on the phase — checked by comparing every counter's exact coordinates
 *     before and after.
 *  3. Swap flanks puts the drill on the other side of the pitch, at the exact
 *     mirror of where it was saved.
 *
 * node scripts/smoke-sequences.mjs [--skip-build] [--head]
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ROOT, startPreview } from './lib/preview.mjs'

const argv = process.argv.slice(2)
const skipBuild = argv.includes('--skip-build')
const head = argv.includes('--head')

const SYSTEM = JSON.parse(
  await readFile(resolve(ROOT, 'content/systems/the-false-nine.json'), 'utf8'),
)

const fails = []
const check = (cond, what, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fails.push(`${what}${detail ? ` — ${detail}` : ''}`)
}

/**
 * A four-man rondo saved on the full pitch, down the LEFT touchline.
 *
 * Deliberately at 15-25% across the width, which is far enough off centre that
 * a mirror has an unmistakable answer: 75-85%, the other flank.
 */
const SEQUENCE = {
  id: 'seq-smoke',
  name: 'Smoke rondo',
  updated: new Date().toISOString(),
  sourcePitch: 'full',
  playerCount: 4,
  acts: [
    {
      id: 'sa1',
      title: 'Rondo',
      caption: '',
      ball: { x: 25, y: 20 },
      balls: [{ id: 'sb1', x: 25, y: 20 }],
      tokens: [
        { id: 'st1', side: 'us', x: 20, y: 15, label: 'A' },
        { id: 'st2', side: 'us', x: 30, y: 15, label: 'B' },
        { id: 'st3', side: 'us', x: 30, y: 25, label: 'C' },
        { id: 'st4', side: 'us', x: 20, y: 25, label: 'D' },
      ],
      arrows: [
        { id: 'sar1', kind: 'pass', from: { x: 20, y: 15 }, to: { x: 30, y: 15 }, fromId: 'st1', toId: 'st2' },
      ],
      bands: [],
      texts: [],
      gear: [],
    },
  ],
}

/** The penalty spot of the attacked goal, as percent of the full pitch's crop. */
const PEN_SPOT_X = (94 / 105) * 100
const PEN_SPOT_Y = (34 / 68) * 100

const server = await startPreview({ port: 4339, path: '/studio/shoot/', skipBuild })
const browser = await chromium.launch({ channel: 'chrome', headless: !head })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

page.on('pageerror', (e) => fails.push(`page error: ${e.message}`))
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})

/**
 * The board a coach is looking at, which is the WIDEST one on the page.
 *
 * The editor also renders the phase strip, the hidden print sheet and the
 * sequence panel's preview, all carrying the same aria-label, so a
 * document-wide query counts every token once per phase per rendering. Note
 * also that a counter draws TWO circles at the counter radius, which is why the
 * numbers here are halved before they are reported as a headcount.
 */
const liveBoard = () =>
  page.evaluate(() => {
    const all = [...document.querySelectorAll('svg[aria-label$="tactical board"]')]
    if (all.length === 0) return null
    const board = all.sort(
      (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
    )[0]
    const counters = [...board.querySelectorAll('circle')].filter(
      (c) => c.getAttribute('r') === '21',
    )
    return {
      n: counters.length,
      at: counters.map((c) => `${c.getAttribute('cx')},${c.getAttribute('cy')}`).sort(),
      width: board.getBoundingClientRect().width,
    }
  })

/** Get past the welcome and What's-new dialogs a fresh browser profile sees. */
async function dismissModals() {
  for (let i = 0; i < 5; i++) {
    const close = page
      .locator('[role="dialog"] button')
      .filter({ hasText: /got it|close|done|skip|no thanks/i })
      .first()
    if (await close.count()) {
      await close.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(250)
    } else break
  }
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(300)
}

try {
  /* ── 1 · THE MARKS COME WITH THE VIEW ────────────────────────────────────── */
  console.log('\nchanging the pitch view')

  await page.goto(server.origin + '/studio/shoot/', { waitUntil: 'load' })
  await page.waitForFunction(() => typeof window.__tfShootMount === 'function', null, {
    timeout: 30_000,
  })

  const probeDoc = structuredClone(SYSTEM)
  probeDoc.pitch = 'full'
  probeDoc.acts = [
    {
      ...probeDoc.acts[0],
      tokens: [{ id: 'tk-probe', side: 'us', x: PEN_SPOT_X, y: PEN_SPOT_Y, label: '9' }],
      gear: [{ id: 'gr-probe', kind: 'traffic-cone', x: PEN_SPOT_X, y: PEN_SPOT_Y }],
      texts: [{ id: 'tx-probe', x: PEN_SPOT_X, y: PEN_SPOT_Y, text: 'spot' }],
      shot: { x: PEN_SPOT_X, y: PEN_SPOT_Y, w: 30, h: 30 },
      arrows: [],
      bands: [],
    },
  ]

  await page.evaluate((s) => window.__tfShootMount(s), probeDoc)
  await page.waitForSelector('svg[aria-label$="tactical board"]', { timeout: 20_000 })
  await page.waitForTimeout(600)
  await dismissModals()

  const picker = page
    .locator('select')
    .filter({ has: page.locator('option[value="attacking-box"]') })
    .first()
  check((await picker.count()) > 0, 'the pitch view picker is on the page')
  await picker.selectOption('attacking-box')
  await page.waitForTimeout(500)

  const spots = await page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label$="tactical board"]')
    const mid = (el) => {
      const b = el.getBoundingClientRect()
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    }
    const token = [...svg.querySelectorAll('circle')].find((c) => c.getAttribute('r') === '21')
    const cone = svg.querySelector('image[href*="traffic-cone"]')
    const label = [...svg.querySelectorAll('text')].find((t) => t.textContent.trim() === 'spot')
    return {
      token: token ? mid(token) : null,
      cone: cone ? mid(cone) : null,
      text: label ? mid(label) : null,
      width: svg.getBoundingClientRect().width,
    }
  })

  check(
    Boolean(spots.token && spots.cone && spots.text),
    'the counter, the cone and the label are all drawn',
    `counter=${Boolean(spots.token)} cone=${Boolean(spots.cone)} label=${Boolean(spots.text)}`,
  )

  // Half a counter, in pixels. Their box is 31m of pitch plus 3m of padding
  // each side, so the board is 37m wide and a counter is 4.2m of it.
  const tol = (spots.width / 37) * 2.1
  const apart = (a, b) => (a && b ? Math.round(Math.hypot(a.x - b.x, a.y - b.y)) : Infinity)
  check(
    apart(spots.token, spots.cone) <= tol,
    'the cone stayed with the player',
    `${apart(spots.token, spots.cone)}px apart, must be within ${Math.round(tol)}px`,
  )
  check(
    apart(spots.token, spots.text) <= tol,
    'the label stayed with the player',
    `${apart(spots.token, spots.text)}px apart, must be within ${Math.round(tol)}px`,
  )

  /* ── 2 · A SEQUENCE LANDS WITHOUT DISTURBING THE BOARD ───────────────────── */
  console.log('\napplying a saved sequence')

  await page.evaluate((s) => {
    localStorage.setItem(
      'tf-studio:sequences:v1::guest',
      JSON.stringify({ sequences: { [s.id]: s } }),
    )
  }, SEQUENCE)
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => typeof window.__tfShootMount === 'function', null, {
    timeout: 30_000,
  })
  await page.evaluate((s) => window.__tfShootMount(s), SYSTEM)
  await page.waitForSelector('svg[aria-label$="tactical board"]', { timeout: 20_000 })
  await page.waitForTimeout(700)
  await dismissModals()

  const before = await liveBoard()
  check(before && before.n > 0, 'the board has counters to start with', `${before.n / 2}`)

  const panel = page.getByRole('button', { name: /My Sequences/i }).first()
  if (await panel.count()) {
    await panel.click().catch(() => {})
    await page.waitForTimeout(300)
  }
  const applyBtn = page.getByRole('button', { name: /^Apply$/ }).first()
  check((await applyBtn.count()) > 0, 'the saved sequence offers an Apply button')
  await applyBtn.click()
  await page.waitForTimeout(400)

  const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Apply Sequence' }).first()
  check((await dialog.count()) > 0, 'the Apply Sequence dialog opened')
  for (const control of ['Add alongside', 'Cast my players', 'Swap flanks', 'Swap ends']) {
    check((await dialog.getByText(control).count()) > 0, `"${control}" is offered`)
  }

  await dialog.getByText('Swap flanks').click()
  await page.waitForTimeout(150)
  await dialog.getByRole('button', { name: /^Apply$/ }).click()
  await page.waitForTimeout(600)

  const after = await liveBoard()
  check(
    after.n === before.n + 8,
    'the four rondo counters arrived on the phase',
    `${before.n / 2} -> ${after.n / 2} counters`,
  )

  const lost = before.at.filter((p) => !after.at.includes(p))
  check(
    lost.length === 0,
    'every counter already on the phase is still exactly where it was',
    lost.length ? `${lost.length} moved, first at ${lost[0]}` : '',
  )

  /*
   * The rondo was saved at 15-25% across the width. Swapped flanks it must be
   * at 75-85%, which on a 68m pitch drawn at ten units to the metre is cy
   * 510-578. The halfway line across the width is 340.
   */
  const fresh = after.at.filter((p) => !before.at.includes(p))
  const cys = [...new Set(fresh.map((p) => Number(p.split(',')[1])))].sort((a, b) => a - b)
  check(
    cys.length > 0 && cys.every((y) => y > 340),
    'the mirrored rondo landed on the other flank',
    `cy ${cys.join(', ')}, the middle of the width is 340`,
  )
  const span = [Math.min(...cys), Math.max(...cys)]
  check(
    Math.abs(span[0] - 510) < 1 && Math.abs(span[1] - 578) < 1,
    'it landed at the exact mirror of where it was saved',
    `cy ${span.join('-')}, must be 510-578`,
  )

  check(consoleErrors.length === 0, 'no console errors', consoleErrors.slice(0, 2).join(' | '))
} finally {
  await browser.close()
  await server.stop?.()
}

if (fails.length === 0) {
  console.log('\nsmoke-sequences: all clear.')
  process.exit(0)
}
console.error(`\nsmoke-sequences: ${fails.length} fault${fails.length === 1 ? '' : 's'}`)
for (const f of fails) console.error(`  · ${f}`)
process.exit(1)
