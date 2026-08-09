/**
 * Crop the exported stills and encode the web formats.
 *
 * WHY THE CROP EXISTS
 * The compositions burn a caption bar and a channel logo into the bottom of
 * every frame. On the web those duplicate the written caption sitting right
 * next to the image, and one of them ("BACKFOURSHORT") is the composition id
 * leaking into the graphic. So the bottom strip is removed.
 *
 * The crop is IDENTICAL for every phase of a system on purpose: the diagram
 * must not jump between phases while the reader steps through them.
 *
 * Formats: AVIF and WebP beside the PNG. Deliberately no GIF — see docs/SPEC.md §6.
 */
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = dirname(HERE)

const manifest = JSON.parse(await readFile(join(HERE, 'manifest.json'), 'utf8'))
const OUT_ROOT = join(WEB_ROOT, manifest.outDir)
/** Untouched remotion output. Read-only here, so this script is re-runnable. */
const RAW_ROOT = join(HERE, 'raw')

/**
 * Bottom strip to drop, in exported pixels (the caption bar + logo). Systems
 * may override it — a full-pitch board sits differently in frame from a
 * half-pitch one, so one number does not fit all of them.
 */
const DEFAULT_CROP_BOTTOM = manifest.cropBottom ?? 176

const filter = process.argv[2]
const systems = manifest.systems.filter((s) => !filter || s.slug === filter)
if (!systems.length) {
  console.error(filter ? `no system matching "${filter}"` : 'manifest has no systems')
  process.exit(1)
}

let count = 0

for (const system of systems) {
  const rawDir = join(RAW_ROOT, system.slug)
  const outDir = join(OUT_ROOT, system.slug)

  let files
  try {
    files = (await readdir(rawDir)).filter((f) => /^phase-\d+\.png$/.test(f)).sort()
  } catch {
    console.error(`! ${system.slug}: no raw frames — run media/export.sh first`)
    continue
  }

  await mkdir(outDir, { recursive: true })

  const cropBottom = system.cropBottom ?? DEFAULT_CROP_BOTTOM

  for (const file of files) {
    const src = join(rawDir, file)
    const base = join(outDir, file.replace(/\.png$/, ''))

    const { width, height } = await sharp(src).metadata()
    const cropHeight = Math.max(1, height - cropBottom)

    const cropped = await sharp(src)
      .extract({ left: 0, top: 0, width, height: cropHeight })
      .toBuffer()

    // The PNG is only a fallback for browsers with no WebP, but it is still a
    // byte someone might download — a full-colour one lands around 1MB.
    // Quantising to a palette takes it under 200KB; the board is flat colour
    // over a soft gradient, which survives 256 colours without visible banding.
    await sharp(cropped).png({ palette: true, quality: 90, effort: 10 }).toFile(`${base}.png`)
    await sharp(cropped).webp({ quality: 82 }).toFile(`${base}.webp`)
    await sharp(cropped).avif({ quality: 55 }).toFile(`${base}.avif`)

    console.log(`  ${system.slug}/${file}  ${width}x${height} → ${width}x${cropHeight}`)
    count += 1
  }
}

console.log(`\n${count} frame(s) processed. Dimensions must match PhaseImage.astro.`)
