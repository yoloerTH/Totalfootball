/**
 * Thumbnail the match balls for the web chrome.
 *
 *   public/studio/balls/<id>.png        256px, the studio's own asset
 *   public/studio/balls/thumb/<id>.webp  128px, everything outside the board
 *
 * The studio drags these at board scale and needs the 256px original. The join
 * popup draws one at 60px, and shipping a 110 KB PNG to do that would put a
 * third of a megabyte of decoration in front of a reader who has not asked for
 * anything yet. 128px is 2x the largest size the chrome ever draws them at.
 *
 * Sources are the committed, alpha-trimmed squares — see src/studio/balls.ts
 * for why they are trimmed and why an untrimmed replacement breaks the drag.
 * Re-run after replacing one:
 *
 *   node scripts/ball-thumbs.mjs
 */
import { mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = join(ROOT, 'public', 'studio', 'balls')
const OUT = join(SRC, 'thumb')

await mkdir(OUT, { recursive: true })

const balls = (await readdir(SRC)).filter((f) => f.endsWith('.png'))
for (const file of balls) {
  const id = file.replace(/\.png$/, '')
  const to = join(OUT, `${id}.webp`)
  await sharp(join(SRC, file)).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 86, effort: 6 })
    .toFile(to)
  const { size } = await stat(to)
  console.log(`${id.padEnd(10)} → thumb/${id}.webp  ${(size / 1024).toFixed(1)} KB`)
}
