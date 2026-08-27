/**
 * Trim, scale and thumbnail the training gear.
 *
 *   public/studio/gear/<id>.png        320px long edge, what the board draws
 *   public/studio/gear/thumb/<id>.webp  96px, what the Equipment picker draws
 *
 * The sources are 1–8 MB studio renders with a lot of transparent margin around
 * them. Two things have to happen before they go near a board:
 *
 * 1. TRIM TO THE OBJECT. Every piece is positioned on the pitch by its CENTRE,
 *    so a cone photographed in the corner of its own canvas would sit a couple
 *    of metres from where the coach dropped it — which reads as a broken drag
 *    rather than a badly cropped asset. This is the same rule ../src/studio/
 *    balls.ts states for the match balls, with one difference: a ball is padded
 *    back to a SQUARE because it is round, and gear is not. A ladder is nine
 *    metres long and one wide, so the trimmed aspect ratio is the asset's real
 *    shape and `GEAR` in ../src/studio/gear.ts carries it.
 *
 * 2. GET SMALL. A board with a drill laid out on it can hold twenty of these,
 *    and the exporter inlines every one as a `data:` URI into a serialised SVG
 *    (see `inlineGear`). At 8 MB a piece that is not a slow export, it is a
 *    browser tab that dies.
 *
 * Run: node scripts/gear-assets.mjs [source-dir]
 * Prints the aspect ratio of each piece, which is what GEAR's `aspect` field
 * must agree with. Re-run it after replacing a source and paste the numbers.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = process.argv[2] ?? join(process.env.HOME ?? '', 'Downloads/training_gear')
const OUT = join(ROOT, 'public/studio/gear')
const THUMBS = join(OUT, 'thumb')

/** Source filename → the id the studio knows it by. See ../src/studio/gear.ts. */
const ID = {
  adidas_soccer_ball: 'ball-spare',
  black_foam_roller_new: 'foam-roller',
  black_hex_dumbbell: 'dumbbell',
  blue_bosu_ball_top_view: 'bosu',
  blue_rectangular_balance_pad: 'balance-pad',
  blue_round_balance_disk: 'balance-disk-blue',
  mini_soccer_goal: 'mini-goal',
  nike_soccer_ball: 'ball-training',
  orange_agility_hurdle: 'hurdle-tall',
  orange_agility_ladder: 'ladder',
  orange_marker_cone_top_view: 'marker-cone',
  orange_mini_hurdle: 'hurdle-orange',
  orange_traffic_cone: 'traffic-cone',
  resistance_bands_set: 'bands',
  white_inflatable_dummy_player: 'dummy-inflatable',
  yellow_mini_hurdle_new: 'hurdle-yellow',
  yellow_round_balance_disk: 'balance-disk-yellow',
  yellow_training_dummy_with_base: 'dummy-mannequin',
  yellow_training_pole_with_base: 'pole',
}

/** The long edge on the board asset. Balls are 256; gear carries more detail. */
const BOARD_PX = 320
const THUMB_PX = 96

await mkdir(THUMBS, { recursive: true })

const files = (await readdir(SRC)).filter((f) => f.toLowerCase().endsWith('.png')).sort()
const rows = []
const missing = []

for (const file of files) {
  const stem = file.replace(/\.png$/i, '')
  const id = ID[stem]
  if (!id) {
    missing.push(stem)
    continue
  }

  // `threshold` rather than a straight alpha trim: these renders have a few
  // pixels of near-transparent fringe, and trimming at 0 keeps all of it.
  const trimmed = await sharp(join(SRC, file)).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true })
  const { width, height } = trimmed.info
  const aspect = width / height

  const long = Math.max(width, height)
  const w = Math.max(1, Math.round((width / long) * BOARD_PX))
  const h = Math.max(1, Math.round((height / long) * BOARD_PX))

  await sharp(trimmed.data).resize(w, h).png({ compressionLevel: 9 }).toFile(join(OUT, `${id}.png`))

  const tLong = Math.max(width, height)
  await sharp(trimmed.data)
    .resize(
      Math.max(1, Math.round((width / tLong) * THUMB_PX)),
      Math.max(1, Math.round((height / tLong) * THUMB_PX)),
    )
    .webp({ quality: 86 })
    .toFile(join(THUMBS, `${id}.webp`))

  rows.push({ id, source: stem, px: `${w}×${h}`, aspect: Number(aspect.toFixed(3)) })
}

// Written beside the assets so a mismatch between GEAR's `aspect` and the real
// file is one diff away rather than a thing you notice on the board.
await writeFile(
  join(OUT, 'aspects.json'),
  `${JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, r.aspect])), null, 2)}\n`,
)

console.table(rows)
if (missing.length) console.warn('No id for:', missing.join(', '))
console.log(`\n${rows.length} pieces → public/studio/gear/`)
