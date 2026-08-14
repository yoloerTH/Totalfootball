/**
 * Render a studio system to a video file, without a person pressing anything.
 *
 *   node scripts/render-video.mjs content/systems/high-line.json
 *   node scripts/render-video.mjs content/systems/*.json --shape landscape
 *   node scripts/render-video.mjs content/systems --out out/
 *
 * WHY A BROWSER IS IN THE LOOP. `renderVideo()` is WebCodecs, so it only runs
 * where there is a `VideoEncoder` — that is the whole reason the video export
 * costs us no render farm (docs/STUDIO.md §3e). The alternative to driving a
 * real browser would be a SECOND renderer that draws the board again in Node,
 * which is the one thing the studio has refused to have from the beginning:
 * the video would drift from the viewer the first time somebody fixed a bug in
 * only one of them. So the robot opens the same page a coach opens and calls
 * the same function the Save button calls.
 *
 * IT USES YOUR INSTALLED GOOGLE CHROME (`channel: 'chrome'`), not Playwright's
 * bundled Chromium. Chromium ships without the proprietary codecs, so its
 * `VideoEncoder` has no H.264 and every render would silently land on the
 * VP9/WebM fallback — a .webm that Instagram and WhatsApp will not take, which
 * is the entire reason the MP4 path exists. Chrome has the encoder.
 *
 * IT RENDERS THE PRODUCTION BUILD, not `astro dev`, and that is not a
 * preference. In dev, Vite's React plugin transforms every `.tsx` the renderer
 * pulls in and expects the react-refresh preamble that `@astrojs/react` injects
 * for an island — and this page has no island, so the first import of
 * `PitchMarkings.tsx` throws "can't detect preamble" and nothing renders. The
 * build has no refresh runtime in it at all. It is also the more honest target:
 * the film comes out of the same bundle the coach's browser runs.
 *
 * THE DOCUMENTS ARE NOT PART OF THE BUILD. They are handed to the page at
 * runtime, so authoring is `--skip-build` and the build only has to be redone
 * when the STUDIO changes. Both are started and torn down for you, Ctrl-C
 * included, unless you point at a server yourself with --origin.
 *
 * Flags:
 *   --shape vertical|landscape   default vertical (the page posts in 9:16)
 *   --out <dir>                  default out/
 *   --date                       stamp the shared-on date into the credit line
 *   --skip-build                 reuse the existing dist/ — the authoring loop
 *   --origin <url>               use a server that is already running
 *   --head                       show the browser, for when something is wrong
 */
import { spawn } from 'node:child_process'
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PORT = 4331
const RENDER_PATH = '/studio/render/'

// ── arguments ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    shape: 'vertical',
    out: 'out',
    date: false,
    origin: null,
    head: false,
    skipBuild: false,
  }
  const inputs = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--shape') opts.shape = argv[++i]
    else if (a === '--out') opts.out = argv[++i]
    else if (a === '--origin') opts.origin = argv[++i]
    else if (a === '--date') opts.date = true
    else if (a === '--head') opts.head = true
    else if (a === '--skip-build') opts.skipBuild = true
    else if (a.startsWith('--')) throw new Error(`Unknown flag ${a}`)
    else inputs.push(a)
  }
  if (!inputs.length) throw new Error('Nothing to render. Pass one or more .json files, or a directory.')
  if (opts.shape !== 'vertical' && opts.shape !== 'landscape') {
    throw new Error(`--shape must be vertical or landscape, not "${opts.shape}"`)
  }
  return { opts, inputs }
}

/** A path may be one document or a folder of them. Directories are not walked. */
async function collect(inputs) {
  const files = []
  for (const input of inputs) {
    const path = resolve(ROOT, input)
    let entries
    try {
      entries = await readdir(path, { withFileTypes: true })
    } catch {
      files.push(path) // not a directory: take it as a file
      continue
    }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.json')) files.push(join(path, e.name))
    }
  }
  return files.sort()
}

// ── the dev server ───────────────────────────────────────────────────────────

async function reachable(origin) {
  try {
    const res = await fetch(origin + RENDER_PATH, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

/** `astro build`, straight through — its own output is the progress report. */
function build() {
  console.log('· building…')
  return new Promise((ok, fail) => {
    const child = spawn('npx', ['astro', 'build'], { cwd: ROOT, stdio: 'inherit' })
    child.on('exit', (code) =>
      code === 0 ? ok() : fail(new Error(`astro build failed (exit ${code})`)),
    )
  })
}

/**
 * Serve `dist/` and wait for the render page to answer.
 *
 * On its own port rather than Astro's default, so running this while you have a
 * dev server open for the editor does not make Astro quietly pick a different
 * port and leave the robot knocking on an empty one.
 */
async function startServer({ skipBuild }) {
  const origin = `http://localhost:${PORT}`
  if (await reachable(origin)) {
    console.log(`· using the server already on ${PORT}`)
    return { origin, stop: async () => {} }
  }

  const page = join(ROOT, 'dist', 'studio', 'render', 'index.html')
  const built = await access(page).then(
    () => true,
    () => false,
  )
  // --skip-build is for the authoring loop, where only the JSON has changed. It
  // cannot skip a build that has never happened.
  if (!built && skipBuild) console.log('· no dist/ yet — building anyway')
  if (!built || !skipBuild) await build()

  console.log('· serving dist…')
  const child = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
  })

  const stop = async () => {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.on('exit', stop)
  process.on('SIGINT', () => {
    stop()
    process.exit(130)
  })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('astro preview exited before it served anything')
    if (await reachable(origin)) return { origin, stop }
    await new Promise((r) => setTimeout(r, 400))
  }
  await stop()
  throw new Error('astro preview did not come up within 60s')
}

// ── the render ───────────────────────────────────────────────────────────────

function bar(fraction, width = 28) {
  const filled = Math.round(fraction * width)
  return `[${'█'.repeat(filled)}${'·'.repeat(width - filled)}] ${String(Math.round(fraction * 100)).padStart(3)}%`
}

async function main() {
  const { opts, inputs } = parseArgs(process.argv.slice(2))
  const files = await collect(inputs)
  const outDir = resolve(ROOT, opts.out)
  await mkdir(outDir, { recursive: true })

  const server = opts.origin
    ? { origin: opts.origin, stop: async () => {} }
    : await startServer(opts)

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: !opts.head,
    // Headless Chrome has no GPU, and without a rasteriser the canvas draws
    // nothing at all — every frame comes out blank, silently, and the encoder
    // is perfectly happy to write that. SwiftShader is the software one.
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  })

  const failures = []
  try {
    const page = await browser.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') console.error('  browser:', m.text())
    })
    page.on('pageerror', (e) => console.error('  browser:', e.message))

    await page.goto(server.origin + RENDER_PATH, { waitUntil: 'load' })
    await page.waitForFunction(() => typeof window.__tfRender === 'function', null, { timeout: 30_000 })

    for (const file of files) {
      const name = file.replace(ROOT + '/', '')
      let system
      try {
        system = JSON.parse(await readFile(file, 'utf8'))
      } catch (err) {
        failures.push([name, `could not read it: ${err.message}`])
        continue
      }

      console.log(`\n${system.title ?? name} — ${system.acts?.length ?? 0} phases, ${opts.shape}`)

      // Kicked off rather than awaited, so the progress below is live. The page
      // holds the only reference to the promise's result until it settles.
      const done = page.evaluate(
        ([sys, o]) => window.__tfRender(sys, o),
        [system, { shape: opts.shape, date: opts.date }],
      )

      let finished = false
      done.finally(() => {
        finished = true
      })
      while (!finished) {
        const p = await page.evaluate(() => window.__tfProgress).catch(() => 0)
        process.stdout.write(`\r  ${bar(p)}`)
        await new Promise((r) => setTimeout(r, 250))
      }

      let out
      try {
        out = await done
      } catch (err) {
        process.stdout.write('\r')
        failures.push([name, err.message.split('\n')[0]])
        console.log(`  failed: ${err.message.split('\n')[0]}`)
        continue
      }

      process.stdout.write(`\r  ${bar(1)}\n`)
      const bytes = Buffer.from(out.data, 'base64')
      const target = join(outDir, out.filename)
      await writeFile(target, bytes)
      console.log(
        `  → ${target.replace(ROOT + '/', '')}  ${(bytes.length / 1e6).toFixed(1)}MB  ${out.seconds.toFixed(1)}s`,
      )
      if (out.ext !== 'mp4') {
        console.log('  ! not an mp4 — this Chrome had no H.264 encoder, so it fell back to WebM')
      }
    }
  } finally {
    await browser.close()
    await server.stop()
  }

  if (failures.length) {
    console.error(`\n${failures.length} failed:`)
    for (const [name, why] of failures) console.error(`  ${name}: ${why}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
