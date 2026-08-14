/**
 * Build the site and serve `dist/`, for the scripts that drive it with a robot.
 *
 * Lifted verbatim out of scripts/render-video.mjs, because scripts/shoot-studio.mjs
 * needs exactly the same thing and two copies of a server bootstrap is two
 * places to fix the next time the port clashes or the build flags change.
 *
 * All three of render-video.mjs's reasons for working this way still apply and
 * are worth keeping in one place:
 *
 *  · IT RENDERS THE PRODUCTION BUILD, not `astro dev`. In dev, Vite's React
 *    plugin transforms every `.tsx` these pages pull in and expects the
 *    react-refresh preamble that `@astrojs/react` injects for an island. A
 *    harness page that mounts React itself has no island, so the first import
 *    throws "can't detect preamble" and nothing renders. The build has no
 *    refresh runtime in it at all. It is also the more honest target: the film
 *    comes out of the same bundle the coach's browser runs.
 *
 *  · ON ITS OWN PORT, so running this while a dev server is open for the editor
 *    does not make Astro quietly pick a different port and leave the robot
 *    knocking on an empty one.
 *
 *  · THE DOCUMENTS ARE NOT PART OF THE BUILD. They are handed to the page at
 *    runtime, so authoring is `--skip-build` and the build only has to be
 *    redone when the STUDIO changes.
 */
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

async function reachable(origin, path) {
  try {
    const res = await fetch(origin + path, { signal: AbortSignal.timeout(1500) })
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
 * Serve `dist/` and wait for `path` to answer.
 *
 * Returns `{ origin, stop }`. `stop` is idempotent and is also wired to exit
 * and SIGINT, so Ctrl-C does not leave a preview server running.
 */
export async function startPreview({ port, path, skipBuild = false }) {
  const origin = `http://localhost:${port}`
  if (await reachable(origin, path)) {
    console.log(`· using the server already on ${port}`)
    return { origin, stop: async () => {} }
  }

  // The built entry for the page we are about to drive: if THIS is missing,
  // a --skip-build cannot be honoured no matter what else is in dist/.
  const entry = join(ROOT, 'dist', ...path.split('/').filter(Boolean), 'index.html')
  const built = await access(entry).then(
    () => true,
    () => false,
  )
  // --skip-build is for the authoring loop, where only the input has changed.
  // It cannot skip a build that has never happened.
  if (!built && skipBuild) console.log('· no dist/ yet — building anyway')
  if (!built || !skipBuild) await build()

  console.log('· serving dist…')
  const child = spawn('npx', ['astro', 'preview', '--port', String(port)], {
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
    if (await reachable(origin, path)) return { origin, stop }
    await new Promise((r) => setTimeout(r, 400))
  }
  await stop()
  throw new Error('astro preview did not come up within 60s')
}
