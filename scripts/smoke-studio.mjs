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

  /* ── THE PITCH COMES MARKED UP ─────────────────────────────────────────────
   *
   * Counted off a `data-grid` hook rather than looked for by colour, because
   * "some faint lines appeared" is not the claim. The claim is that Thirds
   * rules exactly two lines and no numbers, and the eighteen zones rule seven
   * lines and print eighteen numbers — a grid that draws the right number of
   * the wrong thing is the failure this catches.
   */
  console.log('\npitch markings')
  const gridSelect = page.locator('select:has(option:text-is("18 zones (numbered)"))').first()
  check((await gridSelect.count()) > 0, 'the Markings picker is under The board')

  const ruled = () =>
    page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg[aria-label$="tactical board"]')]
      const main = svgs.sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height,
      )[0]
      const g = main && main.querySelector('[data-grid]')
      if (!g) return { id: null, lines: 0, numbers: 0 }
      return {
        id: g.getAttribute('data-grid'),
        lines: g.querySelectorAll('line').length,
        numbers: g.querySelectorAll('text').length,
      }
    })

  check((await ruled()).id === null, 'a system that asked for nothing gets a plain pitch')

  for (const [label, id, lines, numbers] of [
    ['Thirds', 'thirds', 2, 0],
    ['Five channels', 'channels', 4, 0],
    ['Channels and thirds', 'sectors', 6, 0],
    ['18 zones (numbered)', 'zones', 7, 18],
  ]) {
    await gridSelect.selectOption({ label })
    await page.waitForTimeout(350)
    const r = await ruled()
    check(r.id === id, `"${label}" rules the ${id} grid onto the pitch`, `got ${r.id}`)
    check(r.lines === lines, `and it draws ${lines} lines`, `${r.lines} found`)
    check(r.numbers === numbers, `and prints ${numbers} numbers`, `${r.numbers} found`)
  }

  /*
   * 14 is the zone the phrase is about, and it has to be in the middle of the
   * band outside their goal-end box or the numbering is upside down or turned
   * on its side. Read off the board rather than off the source: the point is
   * where the coach sees it, and this view is cropped to the attacking half.
   */
  const fourteen = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg[aria-label$="tactical board"]')]
    const main = svgs.sort(
      (a, b) =>
        b.getBoundingClientRect().width * b.getBoundingClientRect().height -
        a.getBoundingClientRect().width * a.getBoundingClientRect().height,
    )[0]
    const g = main.querySelector('[data-grid]')
    const at = (n) => {
      const t = [...g.querySelectorAll('text')].find((e) => e.textContent.trim() === n)
      return t ? { x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')) } : null
    }
    return { z14: at('14'), z13: at('13'), z15: at('15'), z17: at('17') }
  })
  check(
    fourteen.z14 && fourteen.z13 && fourteen.z15 &&
      Math.abs(fourteen.z14.y - (fourteen.z13.y + fourteen.z15.y) / 2) < 1,
    '14 sits centrally between 13 and 15',
  )
  check(
    fourteen.z14 && fourteen.z17 && fourteen.z17.x > fourteen.z14.x,
    'and 17 is nearer their goal than 14 is',
  )

  await shot('01b-markings')
  await gridSelect.selectOption({ label: 'Plain pitch' })
  await page.waitForTimeout(300)
  check((await ruled()).id === null, 'and Plain pitch takes them all away again')

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
   * Gear only. BALLS ARE NOT GEAR — they are match balls, added with "+ Ball"
   * on the phase panel, as many as a drill needs. They were briefly in this
   * picker as anonymous "loose balls" and were taken out again, because one
   * object with two vocabularies is worse than either.
   *
   * Both prefixes are still watched below: nothing should be requesting a ball
   * out of /studio/gear/ any more, and if something starts, this notices.
   */
  const thumbs = page.locator(
    'img[src^="/studio/gear/thumb/"], img[src^="/studio/balls/thumb/"]',
  )
  const thumbCount = await thumbs.count()
  check(thumbCount === 17, 'all 17 pieces are in the picker', `found ${thumbCount}`)


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
  const gearPanel = page.locator('aside').filter({ hasText: 'Selected equipment' }); const sizeSlider = gearPanel.getByRole('slider', { name: 'Size' })
  check((await sizeSlider.count()) > 0, 'there is a Size slider')
  const turnSlider = gearPanel.getByRole('slider', { name: 'Turn' })
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

  /*
   * ── THE LINE, THE TWO NEW SHAPES, AND THE TITLE THAT CARRIES ──────────────
   *
   * All three are things only a browser can answer. The line's whole point is
   * what it does NOT do — no arrowhead, no new phase — and neither absence is
   * visible to a type checker. The shapes are geometry that is correct in the
   * source and wrong on the grass if the label lands outside the outline. And
   * the title rule is about what one control does to another one, two phases
   * later.
   */
  const pitchSvg = () => page.locator('svg[aria-label$="tactical board"]').first()
  // Fractions of the board, so this survives the strip resize above changing
  // how much of the window the board has.
  const pull = async (x0, y0, x1, y1) => {
    const r = await pitchSvg().boundingBox()
    await page.mouse.move(r.x + r.width * x0, r.y + r.height * y0)
    await page.mouse.down()
    await page.mouse.move(r.x + r.width * ((x0 + x1) / 2), r.y + r.height * ((y0 + y1) / 2), { steps: 8 })
    await page.mouse.move(r.x + r.width * x1, r.y + r.height * y1, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(300)
  }
  /*
   * Filled arrowheads on the board, counted.
   *
   * Every headed kind draws its head as a closed path — `d` ending in Z — with
   * a real fill. Nothing else on the board matches that: the shafts are
   * `fill="none"` and the pitch furniture is rects and circles. Counted rather
   * than looked for, because the only honest form of "the line has no head" is
   * that the number does not move when a line is drawn and does move when a
   * pass is.
   */
  const heads = () =>
    page.evaluate(() => {
      const svg = document.querySelector('svg[aria-label$="tactical board"]')
      return [...svg.querySelectorAll('path')].filter((n) => {
        const f = n.getAttribute('fill')
        return /Z\s*$/.test(n.getAttribute('d') || '') && f && f !== 'none'
      }).length
    })
  const phaseCount = () => page.locator('button[title^="Phase "]').count()
  const markRow = (name) => page.locator('li').filter({ hasText: new RegExp(`^${name}`) })

  // ── the line tool ─────────────────────────────────────────────────────────
  console.log('\nthe line tool')
  const lineTool = page.getByRole('button', { name: 'Line', exact: true }).first()
  check((await lineTool.count()) > 0, 'Line is in the top rail')
  check(await lineTool.isVisible(), 'and it is visible without scrolling the rail')

  const phasesBefore = await phaseCount()
  const headsBefore = await heads()
  await lineTool.click()
  await page.waitForTimeout(200)
  check(
    (await page.locator('body').innerText()).includes('Drag from one side to the other'),
    'the sentence under the board is the line’s own, not the two-tap one',
  )

  await pull(0.24, 0.34, 0.78, 0.34)
  check((await markRow('Line').count()) > 0, 'the drag leaves a Line in the marks list')
  const headsAfterLine = await heads()
  check(headsAfterLine === headsBefore, 'and it draws no arrowhead',
    `${headsBefore} → ${headsAfterLine}`)
  /*
   * The one that matters most. A line is not an action: it must not create the
   * phase that a pass's two taps create, or a coach ruling an offside line
   * across a finished deck would silently add a phase to it.
   */
  check((await phaseCount()) === phasesBefore, 'and it poses no new phase',
    `${phasesBefore} → ${await phaseCount()}`)

  // The comparison, so the count above is evidence rather than a guess about
  // what else happened to be on this board.
  await page.getByRole('button', { name: 'Pass', exact: true }).first().click()
  await pull(0.28, 0.58, 0.68, 0.58)
  check((await heads()) === headsAfterLine + 1, 'a pass drawn the same way DOES add one',
    `${headsAfterLine} → ${await heads()}`)

  /*
   * A click that never travels. On an arrow tool it arms the man under it and
   * waits for a second tap; on the line there is no second tap that could mean
   * anything, so it must arm nobody. If it armed him, the NEXT drag would fire
   * his action instead and pose a phase.
   */
  const phasesArmed = await phaseCount()
  await lineTool.click()
  const centre = await pitchSvg().boundingBox()
  await page.mouse.click(centre.x + centre.width * 0.5, centre.y + centre.height * 0.5)
  await page.waitForTimeout(250)
  check((await phaseCount()) === phasesArmed, 'a tap with Line armed arms nobody',
    `${phasesArmed} → ${await phaseCount()}`)
  await shot('07-line-tool')

  // ── the shapes a drawn area can take ──────────────────────────────────────
  console.log('\nshaded area shapes')
  const phaseDrawer = page.getByRole('button', { name: /^On this phase/i }).first()
  if ((await phaseDrawer.getAttribute('aria-expanded')) !== 'true') await phaseDrawer.click()
  await page.waitForTimeout(400)
  const zoneTool = page.getByRole('button', { name: 'Zone', exact: true }).first()
  await zoneTool.scrollIntoViewIfNeeded()
  await zoneTool.click()
  await pull(0.34, 0.12, 0.6, 0.46)
  check((await markRow('Zone').count()) > 0, 'the drag leaves a Zone in the marks list')

  // Drawing does not select. The marks list is how a coach reaches it, and it
  // is the reliable way in here for the same reason it is there.
  await markRow('Zone').last().getByRole('button').first().click()
  await page.waitForTimeout(350)
  const shapes = page.getByRole('tablist', { name: 'Shape' }).first()
  check((await shapes.count()) === 1, 'the Shape picker is on the selected area')
  const offered = await shapes.locator('[role="tab"]').allInnerTexts()
  check(
    JSON.stringify(offered) === JSON.stringify(['Box', 'Rounded', 'Oval', 'Triangle', 'Diamond']),
    'it offers all five, in order',
    JSON.stringify(offered),
  )

  /*
   * Each one draws the element it claims to, with the corners it claims to.
   * `polygon` twice with a different corner count is the check that catches the
   * copy-paste where a diamond is drawn as a triangle — which looks like a
   * shape and is the wrong one.
   */
  const corners = () =>
    page.evaluate(() => {
      const n = document.querySelector('svg[aria-label$="tactical board"] polygon')
      return n ? (n.getAttribute('points') || '').trim().split(/\s+/).length : 0
    })
  for (const [name, tag, want] of [['Triangle', 'polygon', 3], ['Diamond', 'polygon', 4], ['Oval', 'ellipse', 0]]) {
    await shapes.locator('[role="tab"]', { hasText: new RegExp(`^${name}$`) }).first().click()
    await page.waitForTimeout(300)
    const drawn = await page.evaluate(
      (t) => document.querySelectorAll(`svg[aria-label$="tactical board"] ${t}`).length,
      tag,
    )
    check(drawn > 0, `${name} draws a <${tag}>`, `${drawn} found`)
    if (want) check((await corners()) === want, `and it has ${want} corners`, `${await corners()} found`)
  }
  await shot('08-area-shapes')

  /* ── HATCHED IS A PATTERN, NOT A PALER WASH ────────────────────────────────
   *
   * The failure worth catching is the quiet one: a fill value the drawing code
   * does not know about falls back to the house treatment, which is a shade, so
   * a broken Hatched looks exactly like Shaded and nobody notices for a month.
   * So this asks the DOM two questions — is there a pattern, and is the shape
   * actually painted with it — and then asks them again after switching back,
   * because a pattern that never goes away is the other half of the same bug.
   */
  console.log('\nhatched areas')
  const inside = page.getByRole('tablist', { name: 'Inside it' }).first()
  const insideOptions = await inside.locator('[role="tab"]').allInnerTexts()
  check(insideOptions.includes('Hatched'), 'Hatched is offered on a drawn area',
    JSON.stringify(insideOptions))
  check(!insideOptions.includes('Line only'), 'and "Line only" still is not, on an area',
    JSON.stringify(insideOptions))

  const hatching = () =>
    page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg[aria-label$="tactical board"]')]
      const main = svgs.sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height,
      )[0]
      const patterns = main.querySelectorAll('pattern[id$="-hatch"]').length
      const painted = [...main.querySelectorAll('rect, polygon, ellipse, path')].filter((n) =>
        (n.getAttribute('fill') || '').includes('-hatch)'),
      ).length
      const rules = main.querySelectorAll('pattern[id$="-hatch"] line').length
      return { patterns, painted, rules }
    })

  await inside.locator('[role="tab"]', { hasText: /^Hatched$/ }).first().click()
  await page.waitForTimeout(350)
  const hatched = await hatching()
  check(hatched.patterns > 0, 'choosing Hatched puts a pattern in the board', `${hatched.patterns} found`)
  check(hatched.painted > 0, 'and the area is actually painted with it', `${hatched.painted} shapes`)
  check(hatched.rules > 0, 'and the pattern has a rule in it to draw', `${hatched.rules} found`)
  await shot('08b-hatched')

  await inside.locator('[role="tab"]', { hasText: /^Shaded$/ }).first().click()
  await page.waitForTimeout(350)
  const unhatched = await hatching()
  check(unhatched.painted === 0, 'and switching back to Shaded stops using it',
    `${unhatched.painted} shapes still hatched`)

  /* ── SHIFT KEEPS IT STRAIGHT ───────────────────────────────────────────────
   *
   * Measured on the mark itself, not on the mouse: the drag below is pulled
   * deliberately off level, so a path that comes out flat can only have been
   * straightened. The comparison drag afterwards is what makes that evidence —
   * without it, a board that flattened EVERY line would pass.
   */
  console.log('\nshift keeps it straight')
  const shafts = () =>
    page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg[aria-label$="tactical board"]')]
      const main = svgs.sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height,
      )[0]
      return [...main.querySelectorAll('path')].map((n) => n.getAttribute('d'))
    })
  /** The box of whatever path appeared that was not there before the drag. */
  const drawnBox = (before) =>
    page.evaluate((seen) => {
      const svgs = [...document.querySelectorAll('svg[aria-label$="tactical board"]')]
      const main = svgs.sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height,
      )[0]
      const fresh = [...main.querySelectorAll('path')].filter(
        (n) => !seen.includes(n.getAttribute('d')),
      )
      if (!fresh.length) return null
      // The shaft is the long one. A head, if there were one, is a few metres.
      const boxes = fresh.map((n) => n.getBBox()).sort((a, b) => b.width - a.width)
      return { w: boxes[0].width, h: boxes[0].height }
    }, before)

  const lineAgain = page.getByRole('button', { name: 'Line', exact: true }).first()
  await lineAgain.click()
  const beforeStraight = await shafts()
  await page.keyboard.down('Shift')
  await pull(0.22, 0.26, 0.82, 0.34)
  await page.keyboard.up('Shift')
  const straight = await drawnBox(beforeStraight)
  check(straight !== null, 'the shift-drag leaves a mark on the board')
  if (straight) {
    check(straight.h <= straight.w * 0.02, 'and it comes out level despite an off-level drag',
      `${straight.w.toFixed(0)} × ${straight.h.toFixed(0)} units`)
  }

  await lineAgain.click()
  const beforeSlanted = await shafts()
  await pull(0.22, 0.68, 0.82, 0.76)
  const slanted = await drawnBox(beforeSlanted)
  check(slanted !== null, 'the same drag without Shift leaves a mark too')
  if (slanted && straight) {
    check(slanted.h > straight.h + 1, 'and that one keeps the slant it was drawn with',
      `${slanted.h.toFixed(0)} units of drop vs ${straight.h.toFixed(0)}`)
  }
  await shot('08c-shift-straight')

  // ── the title a new phase starts with ─────────────────────────────────────
  console.log('\nthe phase title')
  const titleBox = () => page.getByRole('textbox', { name: /^Title$/i }).last()
  const addPhase = page.getByRole('button', { name: /Add phase/i }).first()

  await titleBox().fill('Pressing trap')
  await page.waitForTimeout(300)
  await addPhase.click()
  await page.waitForTimeout(450)
  const carried = await titleBox().inputValue()
  check(carried === 'Pressing trap', 'a new phase keeps the title of the one it followed',
    `got "${carried}"`)

  // The other half of the rule, and the half a "carry it forward" change breaks
  // by accident: empty has to stay empty rather than falling back to a number.
  await titleBox().fill('')
  await page.waitForTimeout(300)
  await addPhase.click()
  await page.waitForTimeout(450)
  const stayed = await titleBox().inputValue()
  check(stayed === '', 'and an empty one stays empty instead of becoming a count',
    `got "${stayed}"`)

  /* ── A LINE SURVIVES THE PHASE A PASS CREATES ─────────────────────────────
   *
   * Two taps on two players draw the pass AND pose the phase after it, and that
   * new phase arrives with the arrows cleared, which is right: an arrow
   * describes the move that has just happened. It arrived with the LINES
   * cleared too, which is wrong — a line is furniture, and a coach who ruled a
   * sector grid out of lines lost the whole grid the moment they tapped out a
   * pass. "+ Add phase" never had the bug, because it clones everything.
   *
   * Driven through the two taps rather than through the state, because the two
   * taps are the path that was broken.
   */
  console.log('\nlines carry forward')
  const counterAt = (label) =>
    page.evaluate((l) => {
      const svgs = [...document.querySelectorAll('svg[aria-label$="tactical board"]')]
      const main = svgs.sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height,
      )[0]
      const t = [...main.querySelectorAll('text')].find((n) => n.textContent.trim() === l)
      if (!t) return null
      const r = t.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }, label)

  /*
   * ON THE LAST PHASE, deliberately. An action only CREATES a phase when there
   * is not already one after it — otherwise it poses the phase that is there,
   * which is a different path and not the one that was clearing lines. Landing
   * this test in the middle of the deck by accident is how it silently starts
   * proving nothing.
   */
  await page.locator('button[title^="Phase "]').last().click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Line', exact: true }).first().click()
  await pull(0.2, 0.22, 0.8, 0.22)
  check((await markRow('Line').count()) > 0, 'there is a line on the phase to lose')

  const lw = await counterAt('LW')
  const rw = await counterAt('RW')
  check(lw !== null && rw !== null, 'both counters are findable on the board')
  if (lw && rw) {
    const phasesBeforeTap = await phaseCount()
    await page.getByRole('button', { name: 'Pass', exact: true }).first().click()
    await page.waitForTimeout(200)
    await page.mouse.click(lw.x, lw.y)
    await page.waitForTimeout(300)
    await page.mouse.click(rw.x, rw.y)
    await page.waitForTimeout(600)
    const phasesAfterTap = await phaseCount()
    check(phasesAfterTap === phasesBeforeTap + 1, 'the two taps pose the phase after it',
      `${phasesBeforeTap} → ${phasesAfterTap}`)

    // The action leaves the coach where they were, so step onto the phase it
    // made — that is the board the grid went missing from.
    await page.locator('button[title^="Phase "]').nth(phasesAfterTap - 1).click()
    await page.waitForTimeout(500)
    check((await markRow('Line').count()) > 0,
      'the line is still there on the phase the pass created')
    check((await markRow('Pass').count()) === 0,
      'and the pass itself stayed behind on the phase it was drawn on',
      `${await markRow('Pass').count()} found`)
  }
  await shot('08d-lines-carry')

  // ── the export dialog's toggles ───────────────────────────────────────────
  console.log('\nthe export dialog')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.waitForTimeout(600)
  for (const part of ['The system’s name', 'Your name and club']) {
    check((await page.getByText(part, { exact: true }).count()) > 0, `"${part}" can be turned off`)
  }

  /*
   * Our mark is NOT a switch, and this is the check that it has not quietly
   * become one again.
   *
   * It used to be, tied to the coach's own credit so that ours could never be
   * drawn on a board without theirs. It came off on 2026-08-28 and is now a
   * line of text: it goes on the picture whatever else the coach turns off, and
   * saying so plainly beats a disabled checkbox that says the same thing in
   * three interactions. This block asserted the old behaviour and went on
   * asserting it after the change, which is how it was still failing when the
   * help panel's checks were added below.
   */
  check((await page.getByRole('checkbox', { name: 'Made with Total Football' }).count()) === 0,
    'our mark is not a switch the coach has to reason about')
  check((await page.getByText(/Made with Total Football goes bottom right/).count()) > 0,
    'the dialog says where it goes instead')

  const credit = page.getByRole('checkbox', { name: 'Your name and club' })
  check(await credit.isChecked(), 'their credit starts on')
  await credit.uncheck()
  await page.waitForTimeout(300)
  check(!(await credit.isChecked()), 'and it is theirs to turn off')
  await credit.check()
  await page.waitForTimeout(300)
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
  await page.waitForTimeout(600)

  /* ── the help panel ────────────────────────────────────────────────────────
   *
   * The one part of the studio whose whole promise is about the DOM: Show me
   * claims it will open the right drawer and put a ring on the right control,
   * and neither half of that can be checked anywhere but in a browser.
   * scripts/check-help.mjs proves every topic names an address that exists in
   * the source; this proves pressing the button actually gets you there.
   */
  console.log('\nthe help panel')
  const helpBtn = page.getByRole('button', { name: /search the studio for help/i })
  await helpBtn.click()
  await page.waitForTimeout(400)
  const helpBox = page.getByRole('dialog', { name: 'Help' })
  check(await helpBox.isVisible(), 'the ? button opens the help panel')

  const helpSearch = page.getByPlaceholder('What do you want to do?')
  check(await helpSearch.isVisible(), 'it opens on a search box')

  // A coach's word for a thing the studio calls something else. This is the
  // whole point of the terms list in guide.ts, so it is the thing to test.
  await helpSearch.fill('cones')
  await page.waitForTimeout(300)
  check((await page.getByText('Cones, mannequins and training gear').count()) > 0,
    '"cones" finds the training gear topic')
  const showMe = page.getByRole('button', { name: 'Show me', exact: true })
  check((await showMe.count()) > 0, 'a search opens its best answer rather than asking for a second press')

  await showMe.first().click()
  await page.waitForTimeout(1200)
  check(!(await helpBox.isVisible().catch(() => false)),
    'Show me closes the panel so it stops covering the rail')
  const equipmentOpen = await page
    .locator('[data-help="Equipment"] button[aria-expanded="true"]')
    .count()
  check(equipmentOpen > 0, 'it opens the drawer the control lives in')
  check(await page.locator('[data-help="Training gear"]').isVisible(),
    'and the panel it pointed at is on screen')
  check((await page.getByRole('status').filter({ hasText: 'Training gear' }).count()) > 0,
    'the ring says what it found')
  await shot('08-help-spotlight')

  // The ring must not become furniture: the next press takes it away, and that
  // press still reaches whatever was under it.
  await page.mouse.click(720, 460)
  await page.waitForTimeout(400)
  check((await page.getByRole('status').filter({ hasText: 'Here it is' }).count()) === 0,
    'the ring goes on the next press')

  // A target in the top toolbar rather than in a drawer: no drawer to open,
  // and a different anchoring path through Tip's `help` prop.
  await helpBtn.click()
  await page.getByPlaceholder('What do you want to do?').fill('long ball')
  await page.waitForTimeout(300)
  check((await page.getByRole('button', { name: 'Getting a video file' }).count()) === 0,
    'a two-result search still opens its best answer')
  // Exact, because the panel's footer also offers "Show me round again" and a
  // loose match would take the tour instead of the topic.
  await page.getByRole('button', { name: 'Show me', exact: true }).first().click()
  await page.waitForTimeout(900)
  check((await page.getByRole('status').filter({ hasText: 'the Switch tool' }).count()) > 0,
    '"long ball" finds and rings the Switch tool in the toolbar')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // Browsing, for the coach who has no word for it.
  await helpBtn.click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Sharing' }).first().click()
  await page.waitForTimeout(300)
  check((await page.getByRole('button', { name: 'Getting a video file' }).count()) > 0,
    'a group can be browsed with nothing typed')

  await page.getByPlaceholder('What do you want to do?').fill('zzzqq')
  await page.waitForTimeout(300)
  check((await page.getByText('Nothing matches that').count()) > 0,
    'a search with no answer says so rather than showing an empty panel')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check((await page.getByRole('dialog', { name: 'Help' }).count()) === 0, 'Escape closes it')

  /*
   * A control that is conditionally absent sends the coach somewhere useful.
   *
   * The Your club panel is not drawn until a kit or a crest has been saved, and
   * this harness mounts the editor with no account at all — so "Your crest on
   * the board" is exactly the question the rail cannot answer by pointing, from
   * exactly the coach who most needs an answer. It must land on the settings
   * page rather than shrugging. See `fallback` in src/studio/editor/guide.ts.
   *
   * Last in this block on purpose: it navigates off the editor, so nothing that
   * needs the board can run after it.
   */
  await helpBtn.click()
  await page.getByPlaceholder('What do you want to do?').fill('badge')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Show me', exact: true }).first().click()
  const landed = await page
    .waitForURL(/\/studio\/settings\//, { timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  check(landed, 'a topic whose control is not on the board falls back to Personal settings',
    `ended at ${page.url()}`)

} finally {
  await browser.close()
  await server.stop()
}

console.log(`\n${fails.length ? `${fails.length} FAILURES` : 'all checks passed'}`)
for (const f of fails) console.log(`  · ${f}`)
process.exit(fails.length ? 1 : 0)
