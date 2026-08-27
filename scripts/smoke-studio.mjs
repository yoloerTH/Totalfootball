/**
 * Drive the real editor and check the new controls are there and work.
 *
 * Not a unit test and not trying to be: the things that broke here are things
 * only a browser can tell you — a drawer that will not open, a picker whose
 * pictures 404, a dialog taller than the window. So this opens the studio the
 * way a coach does, presses the same buttons, and shouts if the DOM does not
 * agree.
 *
 * node scripts/smoke-studio.mjs [--skip-build] [--head] [--shots DIR]
 */
import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ROOT, startPreview } from './lib/preview.mjs'

// The same harness the promo shoot drives: it mounts the real StudioEditor on a
// document you hand it, without a session. See src/pages/studio/shoot.astro.
const SYSTEM = JSON.parse(
  await readFile(resolve(ROOT, 'content/systems/the-false-nine.json'), 'utf8'),
)

const argv = process.argv.slice(2)
const skipBuild = argv.includes('--skip-build')
const head = argv.includes('--head')
const shotsAt = argv.indexOf('--shots')
const SHOTS = shotsAt >= 0 ? argv[shotsAt + 1] : null

const fails = []
const ok = (what) => console.log(`  ✓ ${what}`)
const check = (cond, what, detail = '') => {
  if (cond) ok(what)
  else {
    fails.push(`${what}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${what}${detail ? ` — ${detail}` : ''}`)
  }
}

const server = await startPreview({ port: 4331, path: '/studio/shoot/', skipBuild })
const browser = await chromium.launch({ channel: 'chrome', headless: !head })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const badRequests = []
page.on('response', (r) => {
  if (r.status() >= 400 && new URL(r.url()).pathname.startsWith('/studio/gear/')) {
    badRequests.push(`${r.status()} ${new URL(r.url()).pathname}`)
  }
})
page.on('pageerror', (e) => fails.push(`page error: ${e.message}`))

try {
  await page.goto(server.origin + '/studio/shoot/', { waitUntil: 'load' })
  await page.waitForFunction(() => typeof window.__tfShootMount === 'function', null, {
    timeout: 30_000,
  })
  await page.evaluate((sys) => window.__tfShootMount(sys), {
    ...SYSTEM,
    credit: { presenter: 'Andreas Pangios', team: 'AEL Limassol U16', ...SYSTEM.credit },
  })
  await page.waitForSelector('svg[aria-label$="tactical board"]', { timeout: 20_000 })
  await page.waitForTimeout(700)
  if (SHOTS) await mkdir(SHOTS, { recursive: true })
  const shot = async (name) => {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
  }

  // ── the rail is in drawers ────────────────────────────────────────────────
  console.log('\nthe rail')
  for (const title of ['The board', 'Teams and kit', 'Equipment', 'On this phase', 'The film', 'This system']) {
    const n = await page.getByRole('button', { name: new RegExp(`^${title}`, 'i') }).count()
    check(n > 0, `section "${title}" is there`, `found ${n}`)
  }
  const openNow = await page.locator('button[aria-expanded="true"]').count()
  check(openNow >= 3, 'three drawers start open', `${openNow} open`)
  await shot('01-rail')

  // ── the text tool is reachable ────────────────────────────────────────────
  console.log('\nwriting')
  const railText = page.getByRole('button', { name: 'Text', exact: true })
  check((await railText.count()) > 0, 'Text is in the top rail')
  check(await railText.first().isVisible(), 'Text is actually visible in the rail')

  // ── equipment ─────────────────────────────────────────────────────────────
  console.log('\nequipment')
  const equip = page.getByRole('button', { name: /^Equipment/i }).first()
  await equip.click()
  await page.waitForTimeout(350)
  check((await page.getByText('Training gear').count()) > 0, 'the Training gear panel opens')
  const thumbs = page.locator('img[src^="/studio/gear/thumb/"]')
  const thumbCount = await thumbs.count()
  check(thumbCount === 19, 'all 19 pieces are in the picker', `found ${thumbCount}`)
  await shot('02-equipment')

  /*
   * Counted on the BIGGEST board on the page, and it has to be.
   *
   * Every `Board` carries the same aria-label — the editor's board, each
   * thumbnail in the phase strip, and every page of the hidden print sheet — so
   * a document-wide selector counts one cone three times over and the number
   * means nothing. The largest one by area is the board the coach is looking at.
   */
  const onBoard = () =>
    page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg[aria-label$="tactical board"]')]
      const main = svgs.sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height,
      )[0]
      return main ? main.querySelectorAll('image[href^="/studio/gear/"]').length : -1
    })

  const before = await onBoard()
  await page.getByRole('button', { name: 'Add Marker cone' }).click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Add Agility ladder' }).click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Add Mannequin' }).click()
  await page.waitForTimeout(400)
  const after = await onBoard()
  check(after === before + 3, 'three pieces land on the board', `${before} → ${after}`)
  check(badRequests.length === 0, 'no gear asset 404s', badRequests.join(', '))

  // the inspector on the last one added
  check((await page.getByText('Selected equipment').count()) > 0, 'the gear inspector opens on the new piece')
  const sizeSlider = page.getByRole('slider', { name: 'Size' })
  check((await sizeSlider.count()) > 0, 'there is a Size slider')
  const turnSlider = page.getByRole('slider', { name: 'Turn' })
  check((await turnSlider.count()) > 0, 'there is a Turn slider')
  if (await turnSlider.count()) {
    await turnSlider.fill('90')
    await page.waitForTimeout(300)
    const turned = await page
      .locator('svg[aria-label$="tactical board"] g[transform^="rotate(90"]')
      .count()
    check(turned > 0, 'turning it rotates the piece on the board', `${turned} rotated groups`)
  }
  await shot('03-gear-on-board')

  // ── the video dialog fits ─────────────────────────────────────────────────
  console.log('\ndialogs')
  await page.getByRole('button', { name: 'Video', exact: true }).click()
  await page.waitForTimeout(600)
  const dialog = page.getByRole('dialog')
  const box = await dialog.locator('> div').first().boundingBox()
  check(box !== null, 'the video dialog opens')
  if (box) {
    check(box.height <= 900, 'it fits inside the window', `${Math.round(box.height)}px tall`)
    check(box.y >= -1, 'its top is on screen', `top at ${Math.round(box.y)}`)
    check(box.y + box.height <= 901, 'its bottom is on screen', `bottom at ${Math.round(box.y + box.height)}`)
    check(box.width <= 560, 'it does not span the screen', `${Math.round(box.width)}px wide`)
  }
  check((await page.getByRole('button', { name: /Save the video/ }).isVisible()), 'Save the video is visible without scrolling')
  await shot('04-video-dialog')
  await page.getByRole('button', { name: 'Close' }).click()
  await page.waitForTimeout(400)

  // ── play still works with gear on the board ───────────────────────────────
  console.log('\nplayback')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(900)
  check(fails.filter((f) => f.startsWith('page error')).length === 0, 'no page errors during playback')
} finally {
  await browser.close()
  await server.stop()
}

console.log(`\n${fails.length ? `${fails.length} FAILURES` : 'all checks passed'}`)
for (const f of fails) console.log(`  · ${f}`)
process.exit(fails.length ? 1 : 0)
