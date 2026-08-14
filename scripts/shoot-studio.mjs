/**
 * Film the studio being used, for the promotional videos.
 *
 *   node scripts/shoot-studio.mjs --probe            # what can I click?
 *   node scripts/shoot-studio.mjs                    # shoot the lot
 *   node scripts/shoot-studio.mjs drag --skip-build  # one beat, authoring loop
 *
 * ── WHY THE PRODUCT IS SHOT AND NOT DRAWN ────────────────────────────────────
 *
 * The promo could have been built entirely in Remotion, with the board redrawn
 * there. That is a SECOND RENDERER of the product, which is the one thing the
 * studio has refused from the beginning (docs/STUDIO.md §3e: "there is still
 * exactly ONE renderer, so a video cannot drift from what the coach posed").
 * A hand-animated studio drifts the same way and worse, because nobody rebuilds
 * a promo when they fix a token's hit area — it goes stale silently, and a film
 * of a UI we no longer ship is worse than no film. So the robot opens the real
 * editor and the camera points at it.
 *
 * ── WHY THE FRAMES ARE STEPPED, NOT RECORDED ─────────────────────────────────
 *
 * The obvious build is a screen recording — CDP's `Page.startScreencast`, or
 * Playwright's `recordVideo`. Both stamp frames by WALL CLOCK, so a machine
 * that cannot lay out the editor in 33ms does not drop frames, it films the
 * studio in slow motion. That is the same trap `videoRender.ts` refuses
 * `MediaRecorder` for, and the same answer applies: drive the pointer in N
 * discrete steps and take a frame at each one. The output is identical on a
 * fast machine and a slow one, and merely takes longer on the bad one.
 *
 * It also means the shoot is FRAME-ADDRESSABLE. Every frame has a known cursor
 * position, which is what lets the cursor itself be composited in Remotion off
 * the manifest instead of being burnt into the plate — restyle it, retime it,
 * change the easing, no re-shoot. Same trick as `audio.ts` deriving kicks from
 * the document rather than taking a `kick?: boolean`: the information was
 * already there, so nobody has to key it by hand.
 *
 * ── WHAT IS DELIBERATELY NOT FILMED ──────────────────────────────────────────
 *
 * Playback. Pressing Play and filming the board tween would be the one genuinely
 * wall-clock-driven thing on the page, and it is also the one thing we already
 * have a frame-exact renderer for: `scripts/render-video.mjs` produces the
 * actual MP4 a coach gets. The promo cuts to that file. It is both easier and
 * more honest — the payoff shot is the real artifact, not a recording of it.
 *
 * ── OUTPUT ───────────────────────────────────────────────────────────────────
 *
 *   shots/<beat>/frame-0000.png   the plates, at --scale device pixels
 *   shots/<beat>/manifest.json    fps, viewport, and the cursor at every frame
 *
 * The manifest's coordinates are CSS pixels in viewport space, NOT device
 * pixels, so Remotion scales them against whatever crop it takes of the plate.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { ROOT, startPreview } from './lib/preview.mjs'

const PORT = 4332
const SHOOT_PATH = '/studio/shoot/'

/**
 * The screen the studio is designed for.
 *
 * Above SMALL_WIDTH (900) so the two side panels and the board sit as they do
 * on a coach's laptop — below it the editor stacks, which is a real layout but
 * not the one the promo is selling.
 */
const VIEWPORT = { width: 1440, height: 900 }

// ── arguments ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    out: 'shots',
    fps: 30,
    scale: 2,
    jpeg: false,
    theme: 'light',
    /*
     * The false nine has the longest run of ours in the launch set: the right
     * winger sweeping into the space the nine vacated, 36% of the crop, on the
     * phase captioned "He follows. That is the mistake." It is the most legible
     * single gesture we have to a viewer who does not know football.
     */
    system: 'content/systems/the-false-nine.json',
    skipBuild: false,
    head: false,
    probe: false,
    origin: null,
  }
  const beats = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') opts.out = argv[++i]
    else if (a === '--fps') opts.fps = Number(argv[++i])
    else if (a === '--scale') opts.scale = Number(argv[++i])
    else if (a === '--theme') opts.theme = argv[++i]
    else if (a === '--system') opts.system = argv[++i]
    else if (a === '--origin') opts.origin = argv[++i]
    else if (a === '--jpeg') opts.jpeg = true
    else if (a === '--skip-build') opts.skipBuild = true
    else if (a === '--head') opts.head = true
    else if (a === '--probe') opts.probe = true
    else if (a.startsWith('--')) throw new Error(`Unknown flag ${a}`)
    else beats.push(a)
  }
  return { opts, beats }
}

// ── the camera ───────────────────────────────────────────────────────────────

/**
 * A beat being filmed: an open folder, a frame counter, and the cursor.
 *
 * The cursor lives here rather than in Playwright because Playwright will not
 * tell you where its mouse is, and every frame needs to record it.
 */
class Camera {
  constructor(page, dir, opts) {
    this.page = page
    this.dir = dir
    this.opts = opts
    this.n = 0
    this.cursor = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2, down: false }
    this.frames = []
    this.beats = []
  }

  /** Take one frame exactly as the page stands. */
  async frame() {
    const name = `frame-${String(this.n).padStart(4, '0')}.${this.opts.jpeg ? 'jpg' : 'png'}`
    await this.page.screenshot({
      path: join(this.dir, name),
      type: this.opts.jpeg ? 'jpeg' : 'png',
      ...(this.opts.jpeg ? { quality: 92 } : {}),
      animations: 'allow',
    })
    this.frames.push({
      f: this.n,
      x: round(this.cursor.x),
      y: round(this.cursor.y),
      down: this.cursor.down,
    })
    this.n++
  }

  /** Nothing moves, but the page may still be settling. Film it honestly. */
  async hold(frames) {
    for (let i = 0; i < frames; i++) await this.frame()
  }

  /**
   * Move the pointer to a point over `frames` frames, easing like a hand.
   *
   * Every intermediate position is a real `mouse.move`, so the editor sees the
   * same pointer stream a coach's hand produces — hover states, drag updates
   * and all. It is not a teleport with a cursor drawn over the top.
   */
  async moveTo(x, y, frames = 12) {
    const from = { ...this.cursor }
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames)
      const nx = from.x + (x - from.x) * t
      const ny = from.y + (y - from.y) * t
      await this.page.mouse.move(nx, ny)
      this.cursor.x = nx
      this.cursor.y = ny
      await this.frame()
    }
  }

  async press() {
    await this.page.mouse.down()
    this.cursor.down = true
    await this.frame()
  }

  async release() {
    await this.page.mouse.up()
    this.cursor.down = false
    await this.frame()
  }

  /** Label a range of frames, so the edit can find the moment without counting. */
  mark(name, from) {
    this.beats.push({ name, from, to: this.n - 1 })
  }

  async write(meta) {
    await writeFile(
      join(this.dir, 'manifest.json'),
      JSON.stringify(
        {
          ...meta,
          fps: this.opts.fps,
          scale: this.opts.scale,
          viewport: VIEWPORT,
          frames: this.n,
          beats: this.beats,
          cursor: this.frames,
        },
        null,
        2,
      ),
    )
  }
}

/** Ease-in-out cubic. A hand accelerates and settles; a robot does not. */
function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const round = (n) => Math.round(n * 10) / 10

// ── the shot list ────────────────────────────────────────────────────────────

/**
 * Each beat gets the camera and the document it was opened on.
 *
 * Beats are named for what they SHOW, not for what they do to the page, because
 * the name is what the edit refers to.
 */
const SHOTS = {
  /**
   * 02 in the page's own three steps, and the hardest thing to say in words:
   * you move a player, and the movement between where they were and where they
   * are is the phase. This is the beat the promo is built around, so it is the
   * one that gets the most frames.
   */
  async drag(cam, { system }) {
    // The longest run in the whole system — read off the document rather than
    // named here, so this beat survives being pointed at a different one.
    const mover = pickMover(system)
    const act = system.acts[mover.actIndex]
    const from = act.tokens.find((t) => t.id === mover.id)

    /*
     * Get to the phase that run starts on, BEFORE the camera rolls.
     *
     * `title="Phase N: …"` is set on every button in the strip (StudioEditor
     * line ~1184) and is the only stable handle on them — their accessible name
     * is the mini-board's own text, which is a pile of shirt numbers.
     */
    await cam.page.click(`[title^="Phase ${mover.actIndex + 1}:"]`)
    await cam.page.waitForTimeout(400)

    const a = await cam.page.evaluate(([x, y]) => window.__tfPoint(x, y), [from.x, from.y])
    const b = await cam.page.evaluate(([x, y]) => window.__tfPoint(x, y), [mover.to.x, mover.to.y])

    await cam.page.mouse.move(cam.cursor.x, cam.cursor.y)
    await cam.hold(6)

    let start = cam.n
    await cam.moveTo(a.x, a.y, 14)
    cam.mark('reach', start)

    start = cam.n
    await cam.press()
    await cam.hold(3)
    cam.mark('pick-up', start)

    start = cam.n
    await cam.moveTo(b.x, b.y, 26)
    cam.mark('carry', start)

    start = cam.n
    await cam.release()
    await cam.hold(10)
    cam.mark('put-down', start)
  },

  /**
   * The other half of 02: a phase is a COPY of the board you already have.
   *
   * Filmed from the last phase so the new one lands at the end of the strip
   * where there is room for it, rather than shoving six thumbnails sideways.
   */
  async phase(cam, { system }) {
    await cam.page.click(`[title^="Phase ${system.acts.length}:"]`)
    await cam.page.waitForTimeout(400)

    const add = await centreOf(cam.page, 'button:has-text("+ Add")')
    await cam.hold(4)

    let start = cam.n
    await cam.moveTo(add.x, add.y, 14)
    cam.mark('reach', start)

    start = cam.n
    await cam.press()
    await cam.frame()
    await cam.release()
    // The strip re-renders and the board copies across. Held long enough for
    // the edit to sit on it — this is the beat that explains the whole model.
    await cam.hold(20)
    cam.mark('added', start)
  },

  /**
   * 03, the link. The export that is not a file.
   *
   * NOTE ON DIALOGS: the open transition is NOT filmed. It is the one genuinely
   * wall-clock-driven thing in the editor, and stepped capture cannot hold a
   * frame rate against it (a screenshot costs ~150ms against a 33ms frame). So
   * the camera waits for the dialog to settle and films it standing still, and
   * Remotion does the reveal. That is the better division anyway — a fade the
   * edit controls beats one baked into the plate at whatever speed it happened.
   */
  async share(cam) {
    await filmDialog(cam, 'Share')
  },

  /** 03, the file. Where the MP4 comes from — the payoff is `out/`, not this. */
  async video(cam) {
    await filmDialog(cam, 'Video')
  },
}

/** Click a top-bar button, let its dialog settle, then film it. */
async function filmDialog(cam, name) {
  const btn = await centreOf(cam.page, `button:has-text("${name}")`)
  await cam.hold(4)

  let start = cam.n
  await cam.moveTo(btn.x, btn.y, 14)
  await cam.press()
  await cam.frame()
  await cam.release()
  cam.mark('open', start)

  // Settle, unfilmed. See the note on SHOTS.share.
  await cam.page.waitForTimeout(700)

  start = cam.n
  await cam.hold(24)
  cam.mark('dialog', start)
}

/**
 * Open the editor on a document, and wait until the board can be measured.
 *
 * The document is SIGNED on the way in. Every phase carries the presenter and
 * club along its foot, and the share dialog puts them in its two fields — so an
 * unsigned document films as a dialog full of grey placeholder text and a board
 * with a blank credit line. A promo has to show the thing filled in.
 */
async function mount(page, system) {
  const signed = {
    ...system,
    credit: {
      presenter: 'Andreas Pangios',
      team: 'AEL Limassol U16',
      note: 'Pre-season, week 2',
      ...system.credit,
    },
  }
  await page.evaluate((sys) => window.__tfShootMount(sys), signed)
  await page.waitForFunction(() => typeof window.__tfPoint === 'function')
  // The board has to be laid out before any point on it can be resolved.
  await page.waitForSelector('svg[aria-label$="tactical board"]')
  await page.waitForFunction(() => window.__tfBoardRect().width > 0)
}

/** The centre of the first element matching `selector`, in CSS pixels. */
async function centreOf(page, selector) {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error(`nothing on screen matches ${selector}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * The longest run any one player makes between two consecutive phases.
 *
 * A promo about "move it to the next moment" has to move the player the system
 * actually moves, and it has to be a run long enough to READ as a gesture — the
 * first cut of this beat dragged a player thirty pixels and looked like a
 * mis-click. Taking it off the document rather than naming a player here means
 * the shot is right for whatever system it is pointed at, and cannot disagree
 * with the film `render-video.mjs` makes from the same file.
 *
 * Ours by preference: a promo should show a coach moving THEIR OWN team, and on
 * a couple of these systems the biggest single mover is an opposition winger
 * being pulled out of shape. Only falls back to `them` if nobody of ours moves.
 */
function pickMover(system) {
  if (system.acts.length < 2) throw new Error('this system has one phase — nothing to drag towards')

  let best = null
  for (let i = 0; i < system.acts.length - 1; i++) {
    for (const t of system.acts[i].tokens) {
      const next = system.acts[i + 1].tokens.find((n) => n.id === t.id)
      if (!next) continue
      const d = Math.hypot(next.x - t.x, next.y - t.y)
      const ours = t.side === 'us'
      // Ours beats theirs outright; within a side, the longest run wins.
      const better = !best || (ours && !best.ours) || (ours === best.ours && d > best.d)
      if (better) best = { actIndex: i, id: t.id, d, ours, to: { x: next.x, y: next.y } }
    }
  }
  if (!best) throw new Error('no player appears in two consecutive phases')
  return best
}

// ── probing ──────────────────────────────────────────────────────────────────

/**
 * Print what the editor actually exposes, so a shot list is written against the
 * real DOM instead of against a guess at it. Selectors written from memory are
 * how a shoot rig ends up silently filming the wrong button.
 */
async function probe(page) {
  const found = await page.evaluate(() => {
    const label = (el) =>
      el.getAttribute('aria-label') || el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 48) || ''
    const rows = []
    for (const el of document.querySelectorAll('button, select, input, [role="button"]')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      rows.push({
        tag: el.tagName.toLowerCase(),
        label: label(el),
        x: Math.round(r.x + r.width / 2),
        y: Math.round(r.y + r.height / 2),
      })
    }
    return rows
  })
  console.log(`\n${found.length} controls on screen:\n`)
  for (const c of found) {
    console.log(`  ${c.tag.padEnd(7)} ${String(`${c.x},${c.y}`).padEnd(10)} ${c.label}`)
  }
  console.log()
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { opts, beats } = parseArgs(process.argv.slice(2))
  const wanted = beats.length ? beats : Object.keys(SHOTS)
  for (const b of wanted) {
    if (!SHOTS[b] && !opts.probe) throw new Error(`No beat called "${b}". Have: ${Object.keys(SHOTS).join(', ')}`)
  }

  const system = JSON.parse(await readFile(resolve(ROOT, opts.system), 'utf8'))

  const server = opts.origin
    ? { origin: opts.origin, stop: async () => {} }
    : await startPreview({ port: PORT, path: SHOOT_PATH, skipBuild: opts.skipBuild })

  const browser = await chromium.launch({ channel: 'chrome', headless: !opts.head })
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      // The plates are shot at 2x so the edit can punch into a single token
      // without softness. A 1080-wide crop out of 2880 is still a real crop.
      deviceScaleFactor: opts.scale,
      colorScheme: opts.theme === 'dark' ? 'dark' : 'light',
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') console.error('  browser:', m.text())
    })
    page.on('pageerror', (e) => console.error('  browser:', e.message))

    await page.goto(server.origin + SHOOT_PATH, { waitUntil: 'load' })
    await page.waitForFunction(() => typeof window.__tfShootMount === 'function', null, {
      timeout: 30_000,
    })
    /*
     * The short-link endpoint is a Netlify function, and `astro preview` serves
     * static files only — so every share 404s and the dialog shows its "we could
     * not reach the server" fallback, which is a long grey paragraph of error
     * text sitting in the middle of the shot.
     *
     * Stubbed onto the SUCCESS path rather than worked around, because that is
     * the path a coach with a connection is on, and it is the one the promo is
     * about. Nothing is invented: the response shape is `{ id }` exactly as
     * netlify/functions returns it, and the dialog builds the same URL from it
     * that production does. The origin in that URL is still localhost, which is
     * why the edit frames this shot on the PROMISE — "no account, nothing to
     * install" — and never on the address bar.
     */
    await page.route('**/api/share', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Matches ID_SHAPE in src/studio/share.ts: no i, l, o or u.
        body: JSON.stringify({ id: 'k7f3q9' }),
      }),
    )

    if (opts.probe) {
      await mount(page, system)
      await probe(page)
      return
    }

    for (const name of wanted) {
      const dir = resolve(ROOT, opts.out, name)
      await rm(dir, { recursive: true, force: true })
      await mkdir(dir, { recursive: true })

      // Remounted per beat so none of them inherits the last one's edits.
      await mount(page, system)

      const cam = new Camera(page, dir, opts)
      process.stdout.write(`${name} … `)
      await SHOTS[name](cam, { system })
      await cam.write({ shot: name, system: opts.system, theme: opts.theme })
      console.log(`${cam.n} frames → ${dir.replace(ROOT + '/', '')}`)
    }
  } finally {
    await browser.close()
    await server.stop()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
