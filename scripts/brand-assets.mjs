/**
 * Generate the brand raster assets that meta tags and structured data point at.
 *
 *   public/og-default.png   1200x630  social share card
 *   public/logo.png          512x512  square mark, Organization schema
 *   public/apple-touch-icon.png 180x180
 *
 * Everything is drawn from the same geometry as src/components/brand/Mark.astro,
 * which is itself a port of editor/src/branding/TotalFootballMark.tsx. One
 * source of truth for the shape; do not redraw it by hand.
 *
 *   node scripts/brand-assets.mjs
 */
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PUBLIC = join(ROOT, 'public')

const PAPER = '#F4F4F2'
const INK = '#161618'
const GOLD = '#E6B23A'
const GOLD_DEEP = '#C9902B'
const GREEN = '#08C16A'

// ── the mark, as an SVG fragment in a 100x100 box ───────────────────────────
const DEG = Math.PI / 180
const C = 50
const pt = (cx, cy, r, deg) => ({ x: cx + r * Math.cos(deg * DEG), y: cy + r * Math.sin(deg * DEG) })
const n = (v) => v.toFixed(2)
const pentagon = (cx, cy, r, apexDeg) =>
  Array.from({ length: 5 }, (_, k) => {
    const p = pt(cx, cy, r, apexDeg + k * 72)
    return `${k === 0 ? 'M' : 'L'}${n(p.x)},${n(p.y)}`
  }).join(' ') + ' Z'

function mark({ id, disc = false, ink = INK }) {
  const ballR = 27
  const cR = 8.4
  const oR = 6
  const oDist = 16.6
  const arrowR = 40
  const span = 26

  const arrows = [-90, 30, 150]
    .map((base, i) => {
      const s = pt(C, C, arrowR, base - span)
      const e = pt(C, C, arrowR, base + span)
      const eDeg = base + span
      const tx = -Math.sin(eDeg * DEG)
      const ty = Math.cos(eDeg * DEG)
      const px = -ty
      const py = tx
      const hl = 5.4
      const hw = 3.4
      const color = i === 0 ? GREEN : GOLD_DEEP
      return `
    <path d="M${n(s.x)},${n(s.y)} A${arrowR} ${arrowR} 0 0 1 ${n(e.x)},${n(e.y)}"
          fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M${n(e.x + tx * hl)},${n(e.y + ty * hl)} L${n(e.x + px * hw)},${n(e.y + py * hw)} L${n(e.x - px * hw)},${n(e.y - py * hw)} Z"
          fill="${color}"/>`
    })
    .join('')

  const seams = Array.from({ length: 5 }, (_, i) => -90 + i * 72)
    .map((deg) => {
      const a = pt(C, C, cR, deg)
      const b = pt(C, C, ballR - 0.8, deg)
      return `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>`
    })
    .join('')

  const rim = Array.from({ length: 5 }, (_, i) => -54 + i * 72)
    .map((deg) => {
      const c = pt(C, C, oDist, deg)
      return `<path d="${pentagon(c.x, c.y, oR, deg + 180)}" fill="${ink}"/>`
    })
    .join('')

  return `
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GOLD}"/>
      <stop offset="45%" stop-color="${GOLD_DEEP}"/>
      <stop offset="100%" stop-color="${GREEN}"/>
    </linearGradient>
  </defs>
  ${disc ? `<circle cx="${C}" cy="${C}" r="47" fill="${PAPER}"/>` : ''}
  <circle cx="${C}" cy="${C}" r="45" fill="none" stroke="url(#${id})" stroke-width="3.2"/>
  ${arrows}
  <circle cx="${C}" cy="${C}" r="${ballR}" fill="none" stroke="${ink}" stroke-width="1.6" opacity="0.92"/>
  ${seams}
  ${rim}
  <path d="${pentagon(C, C, cR, -90)}" fill="${ink}"/>`
}

/** The faint grid from the site's .stage treatment, so the card matches the page. */
const grid = (w, h, step = 64, opacity = 0.05) => {
  const lines = []
  for (let x = step; x < w; x += step)
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${INK}" stroke-opacity="${opacity}" stroke-width="1"/>`)
  for (let y = step; y < h; y += step)
    lines.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${INK}" stroke-opacity="${opacity}" stroke-width="1"/>`)
  return lines.join('')
}

// ── og-default.png ──────────────────────────────────────────────────────────
// 1200x630 is the size every platform crops from. Text is kept well inside a
// safe margin because Twitter and LinkedIn trim the edges differently.
const OG_W = 1200
const OG_H = 630

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
  <rect width="${OG_W}" height="${OG_H}" fill="${PAPER}"/>
  <g>${grid(OG_W, OG_H)}</g>
  <rect width="${OG_W}" height="${OG_H}" fill="none" stroke="${INK}" stroke-opacity="0.10" stroke-width="2"/>

  <!-- Mark sits top-right, clear of the headline: at 84px the first line runs
       to roughly x=830, so the mark starts at 946 and is scaled down. -->
  <g transform="translate(946,86) scale(2.1)">${mark({ id: 'og-g' })}</g>

  <text x="86" y="150" font-family="Inter, system-ui, sans-serif" font-size="19" font-weight="700"
        letter-spacing="9" fill="${INK}" fill-opacity="0.45">TOTAL FOOTBALL</text>

  <text x="86" y="292" font-family="Inter, system-ui, sans-serif" font-size="84" font-weight="900"
        letter-spacing="-2.4" fill="${INK}">The game, explained</text>
  <text x="86" y="384" font-family="Inter, system-ui, sans-serif" font-size="84" font-weight="900"
        letter-spacing="-2.4" fill="url(#og-g)">as a diagram.</text>

  <line x1="86" y1="452" x2="1114" y2="452" stroke="${INK}" stroke-opacity="0.12" stroke-width="2"/>

  <text x="86" y="512" font-family="Inter, system-ui, sans-serif" font-size="27" font-weight="500"
        fill="${INK}" fill-opacity="0.62">Football tactics drawn from scratch. No broadcast clips.</text>
  <text x="86" y="556" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700"
        letter-spacing="3.4" fill="${INK}" fill-opacity="0.38">TOTALFOOTBALL.NAURRA.AI</text>
</svg>`

// ── logo.png ────────────────────────────────────────────────────────────────
// Square, on paper rather than transparent: Google's Organization logo is often
// composited on white, and a transparent PNG with dark ink can vanish.
const LOGO = 512
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO}" height="${LOGO}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${PAPER}"/>
  ${mark({ id: 'logo-g' })}
</svg>`

const TOUCH = 180
const touch = `<svg xmlns="http://www.w3.org/2000/svg" width="${TOUCH}" height="${TOUCH}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="${PAPER}"/>
  <g transform="translate(50,50) scale(0.92) translate(-50,-50)">${mark({ id: 'touch-g' })}</g>
</svg>`

const jobs = [
  ['og-default.png', og, OG_W, OG_H],
  ['logo.png', logo, LOGO, LOGO],
  ['apple-touch-icon.png', touch, TOUCH, TOUCH],
]

for (const [name, svg, w, h] of jobs) {
  const out = join(PUBLIC, name)
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out)
  const { size } = await sharp(out).metadata().then(async (m) => ({ ...m, size: (await import('node:fs')).statSync(out).size }))
  console.log(`  ${name.padEnd(22)} ${w}x${h}  ${(size / 1024).toFixed(0)} KB`)
}

await writeFile(join(PUBLIC, '.brand-assets-generated'), new Date().toISOString() + '\n')
console.log('\nRegenerate with: node scripts/brand-assets.mjs')
