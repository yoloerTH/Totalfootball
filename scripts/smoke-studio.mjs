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
// Both prefixes: the match balls are in the gear picker now and they are served
// out of /studio/balls/, so watching only /studio/gear/ would miss five of them.
page.on('response', (r) => {
  const path = new URL(r.url()).pathname
  if (r.status() >= 400 && (path.startsWith('/studio/gear/') || path.startsWith('/studio/balls/'))) {
    badRequests.push(`${r.status()} ${path}`)
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
  /*
   * 24, not 19: the five match balls are in the picker now.
   *
   * Two prefixes because a ball is served from its own folder — the gear
   * catalogue points at ../balls' originals rather than keeping a second copy,
   * so replacing a ball changes it in the picker and on the grass at once.
   */
  const thumbs = page.locator(
    'img[src^="/studio/gear/thumb/"], img[src^="/studio/balls/thumb/"]',
  )
  const thumbCount = await thumbs.count()
  check(thumbCount === 24, 'all 24 pieces are in the picker', `found ${thumbCount}`)

  // The drawer is called Balls and it holds every ball, not two anonymous ones.
  check((await page.getByText('Loose balls').count()) === 0, 'no "Loose balls" drawer any more')
  for (const ball of ['Trionda', 'Jabulani', 'Spare ball']) {
    check(
      (await page.getByRole('button', { name: `Add ${ball}` }).count()) > 0,
      `${ball} can be put on the grass`,
    )
  }

  /*
   * Nothing in the picker overflows its own well.
   *
   * The mannequin, the pole and the inflatable defender are about 1:4, and they
   * used to take their width from the button and their height from the asset —
   * so they hung out of the bottom of it. Measured rather than eyeballed.
   */
  const spills = await page.evaluate(() => {
    const out = []
    for (const img of document.querySelectorAll(
      'img[src^="/studio/gear/thumb/"], img[src^="/studio/balls/thumb/"]',
    )) {
      const well = img.closest('button')
      if (!well) continue
      const a = img.getBoundingClientRect()
      const b = well.getBoundingClientRect()
      if (a.height > b.height + 1 || a.width > b.width + 1) out.push(img.getAttribute('src'))
    }
    return out
  })
  check(spills.length === 0, 'no picker thumbnail spills out of its well', spills.join(', '))
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
      return main
        ? main.querySelectorAll('image[href^="/studio/gear/"], image[href^="/studio/balls/"]').length
        : -1
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

  /*
   * The mannequin is a mannequin and not a mast.
   *
   * The three standing pieces used to declare a WIDTH, which at an aspect of
   * about 1:4 made them nearly 8m tall — twice the height of a player counter's
   * width, on a board where the mini goal is 2.3× life size. They declare their
   * height now. The inspector prints the piece's real footprint, so this reads
   * the number off the panel rather than trusting the catalogue.
   */
  const footprint = await page
    .getByText(/^[\d.]+ × [\d.]+ m on the grass$/)
    .first()
    .textContent()
  const tall = Number(footprint.split('×')[1].trim().split(' ')[0])
  check(tall > 0 && tall <= 5, 'the mannequin stands about a person high', footprint.trim())

  // The control that did nothing on nineteen symmetric pieces is gone.
  check((await page.getByText('Mirror it').count()) === 0, 'no "Mirror it" on the gear panel')
  await shot('03-gear-on-board')

  // ── the phase strip does not eat the board ────────────────────────────────
  console.log('\nthe phase strip')

  /*
   * The upright pitch is the view this was reported on: sizing thumbnails by
   * width made the strip about 148px tall there and about 62px on a landscape
   * board, so the view that most needs vertical room got the least of it.
   */
  // The strip by what is in it, not by tag order — the hidden print sheet has
  // footers of its own, and the pitch select has no accessible name to ask for.
  const stripBox = () => page.locator('footer:has(button:text-is("+ Add phase"))').boundingBox()
  await page
    .locator('select:has(option:text-is("Full pitch (upright)"))')
    .first()
    .selectOption({ label: 'Full pitch (upright)' })
  await page.waitForTimeout(500)
  const upright = await stripBox()
  check(upright.height <= 130, 'the strip stays short on the upright pitch', `${Math.round(upright.height)}px`)

  const sizeButton = page.getByRole('button', { name: /The row of phases is/ })
  check((await sizeButton.count()) > 0, 'the strip has a size control')
  const label = await sizeButton.getAttribute('aria-label')
  await sizeButton.click()
  await page.waitForTimeout(350)
  const grown = await stripBox()
  check(grown.height !== upright.height, 'pressing it changes the strip height',
    `${Math.round(upright.height)} → ${Math.round(grown.height)}`)
  await sizeButton.click()
  await page.waitForTimeout(350)
  const shrunk = await stripBox()
  check(shrunk.height < grown.height, 'and it comes back round to a smaller one',
    `${Math.round(grown.height)} → ${Math.round(shrunk.height)}`)
  check((await sizeButton.getAttribute('aria-label')) !== label, 'the button says which size it is on')
  await shot('05-phase-strip')

  // ── the writing panel fits its column ─────────────────────────────────────
  console.log('\nthe writing panel')
  await page.getByRole('button', { name: 'Text', exact: true }).first().click()
  await page.waitForTimeout(250)
  const board = page.locator('svg[aria-label$="tactical board"]').first()
  const bb = await board.boundingBox()
  await page.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.6)
  await page.waitForTimeout(500)
  check((await page.getByText('Selected text').count()) > 0, 'the writing panel opens')

  /*
   * Left · Centre · Right on ONE line, and an angle slider you can actually
   * aim. These two shared a `grid-cols-2` inside a 256pt panel, which gave each
   * about 116pt: the alignment control burst its row and dropped "Right"
   * underneath the other two, on top of the slider beside it.
   */
  const alignRow = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tablist"][aria-label="Aligned"] button')]
    if (tabs.length !== 3) return { n: tabs.length }
    const tops = tabs.map((t) => Math.round(t.getBoundingClientRect().top))
    return { n: 3, rows: new Set(tops).size, right: tabs[2].getBoundingClientRect().right }
  })
  check(alignRow.n === 3 && alignRow.rows === 1, 'Left, Centre and Right sit on one line',
    `${alignRow.n} options across ${alignRow.rows} rows`)

  /*
   * And NOTHING in the panel is truncating.
   *
   * The stronger form of the check above: a `Segmented` button now clips rather
   * than letting its label hang over its neighbour, which turns an overlap into
   * a silent ellipsis. That is the right failure and it is still a failure, so
   * it is worth catching. `scrollWidth > clientWidth` on a button is a label
   * that did not fit.
   */
  const clipped = await page.evaluate(() => {
    const out = []
    for (const b of document.querySelectorAll('[role="tablist"] button')) {
      if (b.scrollWidth > b.clientWidth + 1) {
        out.push(`${b.closest('[role="tablist"]').getAttribute('aria-label')}: ${b.textContent}`)
      }
    }
    return out
  })
  check(clipped.length === 0, 'no segmented control is squeezed enough to truncate', clipped.join(', '))

  const angle = page.getByRole('slider', { name: 'Angle' })
  check((await angle.count()) > 0, 'the angle slider is a slider like the others')
  const angleBox = await angle.boundingBox()
  check(angleBox && angleBox.width >= 140, 'and it has a track worth dragging',
    `${Math.round(angleBox?.width ?? 0)}px`)

  // Nothing in that panel is wider than the panel.
  const overflow = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('aside')].pop()
    return panel ? panel.scrollWidth - panel.clientWidth : -1
  })
  check(overflow <= 0, 'the panel does not scroll sideways', `${overflow}px over`)
  await shot('06-writing-panel')

  // ── the export dialog's toggles ───────────────────────────────────────────
  console.log('\nthe export dialog')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.waitForTimeout(600)
  for (const part of ['The system’s name', 'Your name and club', 'Made with Total Football']) {
    check((await page.getByText(part, { exact: true }).count()) > 0, `"${part}" can be turned off`)
  }

  /*
   * The one combination that is not the coach's to pick. Ours is never drawn
   * without theirs — the policy is in src/studio/viewer/CreditBar.tsx — so
   * taking their own name off takes our mark off with it, and says why.
   */
  const lockup = page.getByRole('checkbox', { name: 'Made with Total Football' })
  check(await lockup.isChecked(), 'our mark starts on')
  await page.getByRole('checkbox', { name: 'Your name and club' }).uncheck()
  await page.waitForTimeout(300)
  check(!(await lockup.isChecked()) && (await lockup.isDisabled()),
    'taking their name off takes our mark off and locks it')
  check((await page.getByText(/never goes on a board on its own/).count()) > 0,
    'and the dialog says why')
  await page.getByRole('checkbox', { name: 'Your name and club' }).check()
  await page.waitForTimeout(300)
  check(await lockup.isChecked(), 'putting their name back restores our mark')
  await shot('07-export-dialog')
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(400)

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
