import { chromium } from 'playwright'
import { startPreview } from '../../scripts/lib/preview.mjs'

const OUT = 'scratch/studio-page'
const server = await startPreview({ port: 4345, path: '/studio/', skipBuild: true })
const browser = await chromium.launch({ headless: true })
const W = Number(process.env.W || 1440)
const page = await browser.newPage({ viewport: { width: W, height: 1000 }, deviceScaleFactor: 2 })
await page.goto(server.origin + '/studio/', { waitUntil: 'load' })
await page.waitForTimeout(1200)
await page.evaluate(() => {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'))
  document.querySelectorAll('[data-popup], .fixed').forEach((el) => el.remove())
  document.querySelectorAll('header').forEach((el) => (el.style.display = 'none'))
})
await page.waitForTimeout(800)

const targets = process.argv.slice(2)
const sections = await page.$$('main section, section')
console.log('sections:', sections.length)
for (const [i, sec] of sections.entries()) {
  if (targets.length && !targets.includes(String(i))) continue
  await sec.screenshot({ path: `${OUT}/${W}-sec-${String(i).padStart(2, '0')}.png` }).catch((e) => console.log(i, 'skip', e.message))
}
await browser.close()
await server.stop()
console.log('done')
