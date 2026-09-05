import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errs = []
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
page.on('pageerror', e => errs.push('pageerror: ' + e.message))

for (const [label, url] of [
  ['feed', 'http://localhost:4321/feed/'],
  ['post (missing id)', 'http://localhost:4321/p/?p=zzzzzzz'],
  ['profile (public handle)', 'http://localhost:4321/c/?h=yoer'],
]) {
  errs.length = 0
  await page.goto(url, { waitUntil: 'networkidle' })
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 220)
  console.log(`\n## ${label}\n${text}\nconsole errors: ${errs.length ? JSON.stringify(errs.slice(0,3)) : 'none'}`)
}
await browser.close()
