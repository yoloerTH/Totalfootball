/**
 * The sender avatar — the little circle beside "Total Football" in an inbox.
 *
 *   node scripts/sender-avatar.mjs
 *
 * ── WHAT THIS IS AND IS NOT ─────────────────────────────────────────────────
 *
 * It is a Gravatar, keyed to the ADDRESS `totalfootball@naurra.ai`. That is
 * the only per-alias route that exists: the other mechanism, BIMI, is a DNS
 * record on the whole domain, so it could not give the alias a different
 * identity from athanasios@ even if we paid for the certificate it requires.
 *
 * Be honest about the reach. Gmail and Outlook ignore Gravatar entirely and
 * will keep showing a letter avatar — a "T" in a coloured circle — no matter
 * what is uploaded here. Fastmail and a handful of smaller clients honour it.
 * This is a free five-minute improvement for a minority of readers, not a
 * branding win, and it should not be mistaken for one.
 *
 * ── WHY THE SOURCE LOGO CANNOT BE UPLOADED DIRECTLY ─────────────────────────
 *
 * public/logo.png is 512x512 with an ALPHA CHANNEL and artwork that runs to
 * the edge. Both are wrong for an avatar:
 *
 *  · Transparency means the client paints its own background behind it. The
 *    ball is drawn in black outline, so on any dark-mode client it disappears
 *    into the background it is sitting on.
 *
 *  · Every client that shows an avatar masks it to a CIRCLE. The arrow ring in
 *    the source reaches the edge of the square, so an unpadded upload gets its
 *    arrowheads shaved off at the four cardinal points.
 *
 * So: flatten onto an opaque background, and inset the artwork to 80% so it
 * sits inside the inscribed circle with room to spare.
 *
 * The background colour is SAMPLED from the source rather than typed in.
 * Guessing it produces a faint seam between the artwork's own background and
 * the one composited behind it, which is invisible at 1024px and obvious at
 * 40px — which is the only size anybody sees this at.
 *
 * ── WHY THERE IS ONLY ONE VARIANT ───────────────────────────────────────────
 *
 * A dark-green version was built first, to match the emails. It does not work,
 * and the reason is worth recording so nobody tries it again:
 *
 * public/logo.png has an alpha CHANNEL but no alpha CONTENT — the sampled
 * corner is rgba(244,244,242,255), fully opaque. The cream background is
 * painted into the artwork. So compositing it onto any other colour stacks a
 * cream SQUARE inside the coloured circle, which looks like a mistake because
 * it is one.
 *
 * Making a coloured variant possible means re-exporting the logo with real
 * transparency. Chroma-keying the cream out here is not a substitute: the
 * ball's interior is white and the background is #F4F4F2, four points apart,
 * so any threshold loose enough to clear the background punches holes in the
 * ball.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = join(ROOT, 'public', 'logo.png')
const OUT = join(ROOT, 'public', 'email')

/** Gravatar stores up to 2048; 1024 is crisp everywhere and a quarter the bytes. */
const SIZE = 1024
/** Artwork occupies this fraction of the square, leaving the circle mask room. */
const INSET = 0.8
/** The size an avatar is actually rendered at in an inbox list, roughly. */
const INBOX_PX = 40

mkdirSync(OUT, { recursive: true })

const { data: corner } = await sharp(SRC)
  .extract({ left: 2, top: 2, width: 6, height: 6 })
  .raw()
  .toBuffer({ resolveWithObject: true })

const [r, g, b, alpha] = corner
const sampled = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
console.log(`\nSource      ${SRC.replace(ROOT + '/', '')}`)
console.log(`Corner      rgba(${r},${g},${b},${alpha}) → ${sampled}`)

const inner = Math.round(SIZE * INSET)
const logo = await sharp(SRC)
  .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer()

const variants = [{ name: 'light', bg: { r, g, b, alpha: 1 }, label: sampled }]

console.log()
for (const v of variants) {
  const full = join(OUT, `avatar-${v.name}.png`)

  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: v.bg } })
    .composite([{ input: logo, gravity: 'center' }])
    // Flatten any transparency onto the background, then drop the channel.
    // Both steps are needed: flatten() alone leaves a 4-channel PNG whose
    // alpha is uniformly 255, which is harmless but misleading, and
    // removeAlpha() alone would discard transparency rather than composite it.
    .flatten({ background: v.bg })
    .removeAlpha()
    .png()
    .toFile(full)

  // Masked to a circle at inbox scale — the only view that tells you whether
  // this actually works. Rendered at 4x and downsampled so the preview is not
  // itself a blurry artefact.
  const d = INBOX_PX * 4
  const mask = Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`)
  await sharp(full)
    .resize(d, d)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(join(OUT, `avatar-${v.name}-inbox.png`))

  const meta = await sharp(full).metadata()
  console.log(
    `  ${v.name.padEnd(6)} ${v.label.padEnd(9)} ${meta.width}x${meta.height} ${meta.hasAlpha ? 'alpha' : 'opaque'}  →  public/email/avatar-${v.name}.png`,
  )
}

// The avatar on a light client and a dark one, circular, at inbox scale — so
// the dark-mode case is judged rather than assumed. A cream disc on a dark
// background is the case most likely to look wrong, and is the reason this
// sheet exists rather than a single preview.
const d = INBOX_PX * 4
const pad = 24
await sharp({
  create: {
    width: (d + pad * 2) * 2,
    height: d + pad * 2,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite([
    {
      input: Buffer.from(
        `<svg width="${d + pad * 2}" height="${d + pad * 2}"><rect width="100%" height="100%" fill="#1b1b1d"/></svg>`,
      ),
      left: d + pad * 2,
      top: 0,
    },
    { input: join(OUT, 'avatar-light-inbox.png'), left: pad, top: pad },
    { input: join(OUT, 'avatar-light-inbox.png'), left: d + pad * 3, top: pad },
  ])
  .png()
  .toFile(join(OUT, 'avatar-compare.png'))

console.log(`\n  preview  public/email/avatar-compare.png  (light | dark client, ${INBOX_PX}px circular)`)
console.log(`\nUpload public/email/avatar-light.png at gravatar.com for totalfootball@naurra.ai.\n`)
