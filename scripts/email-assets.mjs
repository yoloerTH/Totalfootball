/**
 * Cut the email hero images out of the phase diagrams.
 *
 *   node scripts/email-assets.mjs
 *
 * The boards in public/library are 720x1104 — portrait, because they are
 * frames of a vertical short. Dropped into a 580px email column at full width
 * one is 767px tall, which pushes everything after it below three scrolls of
 * inbox and reads as a poster rather than a publication.
 *
 * So each hero is a landscape band cut out of one phase: the baked-in title
 * block at the top, and the piece of the pitch the title is talking about,
 * with the empty run-off between them removed. The crop is by hand per
 * edition (the interesting part of a board is wherever the ball is), which is
 * why the numbers live in HEROES below rather than being derived.
 *
 * Output is PNG at native 720 wide, displayed at 580 in the mail — about 1.24x
 * density, so it stays crisp on a retina screen without inventing pixels that
 * were never in the source. PNG rather than WebP or AVIF (both of which the
 * library also has, and both of which Outlook and several others will not
 * decode) — this is the one raster format that renders in every mail client.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * top/height are pixel offsets into the 720x1104 phase diagram.
 * Keep the title block whole — cutting a baked-in headline in half is the one
 * mistake that makes a cropped board look broken rather than composed.
 */
const HEROES = [
  {
    out: 'how-spain-caged-france-hero.png',
    from: 'library/how-spain-caged-france/phase-05.png',
    top: 205,
    height: 625,
  },
]

mkdirSync(join(ROOT, 'public/email'), { recursive: true })

for (const { out, from, top, height } of HEROES) {
  const src = join(ROOT, 'public', from)
  const dest = join(ROOT, 'public/email', out)
  const { width: w, height: h } = await sharp(src).metadata()
  if (top + height > h) throw new Error(`${from}: crop ${top}+${height} exceeds height ${h}`)

  await sharp(src)
    .extract({ left: 0, top, width: w, height })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(dest)

  const meta = await sharp(dest).metadata()
  console.log(`${out}  ${meta.width}x${meta.height}  ${(meta.size / 1024).toFixed(0)}KB`)
}
