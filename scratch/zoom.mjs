import { chromium } from 'playwright'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:4321/feed/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const card = page.locator('article').first()
await card.screenshot({ path: 'scratch/zoom-card1.png' })
// What is that dark bar? Dump any element sitting over the board.
const html = await card.locator('svg').first().evaluate(el => {
  const groups = [...el.querySelectorAll('g,rect,image,foreignObject')]
    .filter(n => n.getAttribute('fill')?.includes('#') || n.tagName === 'image' || n.tagName === 'foreignObject')
  return groups.slice(0, 12).map(n => `${n.tagName} fill=${n.getAttribute('fill')} class=${n.getAttribute('class')}`).join('\n')
})
console.log(html)
await b.close()
