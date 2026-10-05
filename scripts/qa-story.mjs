// The two required flows, end to end:
// A) airplane intro → city → AI → Naveen walks in → Start exploring
// B) story path via the "Next stop" chip: Home → Education → Naveen → Projects → Design Park → Contact
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const mode = process.argv[2] || 'day'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await p.goto(`http://localhost:5173/street?debug&desktop&mode=${mode}`)
await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
// A — sample the plane's on-screen x through the pass
const planeX = () => p.evaluate(() => {
  let plane = null
  window.__scene.traverse((o) => { if (!plane && o.isGroup && o.children.length >= 3 && o.children.some((c) => c.type === 'Line')) plane = o })
  if (!plane || !plane.visible) return null
  const v = plane.getWorldPosition(plane.position.clone())
  const cam = window.__scene.userData.cam || null
  return v.x
})
const xs = []
for (const t of [0.2, 1.8, 3.6, 5.4, 7.0]) {
  await p.waitForFunction((t) => window.__intro.t >= t, t, { timeout: 30000 })
  xs.push(await planeX())
  await p.screenshot({ path: `qa-screens/180-${mode}-A-plane-${t}.png` })
}
console.log('A plane world x over time (right → left):', xs.map((x) => x?.toFixed(1)).join(' → '))
for (const [t, name] of [[10.5, 'descend'], [13.9, 'ai'], [15.8, 'walkin'], [18.2, 'hero']]) {
  await p.waitForFunction((t) => window.__intro.t >= t, t, { timeout: 40000 })
  await p.screenshot({ path: `qa-screens/181-${mode}-A-${name}.png` })
}
console.log('A hero buttons:', await p.evaluate(() => [...document.querySelectorAll('.ui-intro.is-hero button')].map((b) => b.textContent.trim()).join(' | ')))
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(5500)
// B — follow the chip
for (let i = 0; i < 7; i++) {
  const chip = await p.evaluate(() => document.querySelector('.ui-journey-chip.is-visible b')?.textContent ?? null)
  if (!chip || chip === 'Thank you') break
  await p.screenshot({ path: `qa-screens/182-${mode}-B-${i}-chip.png` })
  await p.locator('.ui-journey-chip button').click()
  await sleep(9000)
  const where = await p.evaluate(() => document.querySelector('.ui-where b')?.textContent)
  const panel = await p.evaluate(() => document.querySelector('.ui-cafe.is-visible')?.textContent?.slice(0, 60) ?? null)
  console.log(`B next stop "${chip}" → arrived: ${where}${panel ? ' · ' + panel : ''}`)
  await p.screenshot({ path: `qa-screens/183-${mode}-B-${i}-${chip.replace(/\s/g, '')}.png` })
  await p.keyboard.press('Escape')
  await sleep(700)
}
console.log('B chip at end:', await p.evaluate(() => document.querySelector('.ui-journey-chip b')?.textContent))
console.log('errors:', errors.length ? errors : 'none')
await b.close()
