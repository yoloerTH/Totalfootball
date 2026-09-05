import { chromium } from 'playwright'
import fs from 'node:fs'
const posts = JSON.parse(fs.readFileSync('scratch/seeded.json','utf8')).posts
const browser = await chromium.launch()
const errs = []

for (const [w, tag] of [[430,'phone'],[1280,'desktop']]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 2 })
  page.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`) })
  page.on('pageerror', e => errs.push(`${tag} pageerror: ${e.message}`))
  for (const [name, url] of [
    ['feed', 'http://localhost:4321/feed/'],
    ['feed-recent', 'http://localhost:4321/feed/?tab=recent'],
    ['post', `http://localhost:4321/p/?p=${posts[0]}`],
    ['profile', 'http://localhost:4321/c/?h=demo_marta'],
  ]) {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `scratch/shot-${name}-${tag}.png`, fullPage: true })
    console.log(`shot-${name}-${tag}.png`)
  }
  await page.close()
}
await browser.close()
console.log('\nconsole errors:', errs.length ? errs.slice(0,6) : 'none')
