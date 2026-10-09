// Menu (journey, about, AI workflow, contact, feedback), minimap, menu travel, mobile hero.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const errors = []
async function open(vp, qs = 'debug&desktop') {
  const p = await (await b.newContext({ viewport: vp, hasTouch: qs.includes('touch'), isMobile: qs.includes('touch') })).newPage()
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await p.goto(`http://localhost:5173/street?${qs}`)
  await p.waitForFunction(() => document.querySelector('.ui-intro__skip'), null, { timeout: 90000 })
  return p
}
let p = await open({ width: 1440, height: 900 })
await sleep(600)
await p.getByRole('button', { name: 'Skip intro' }).click()
await sleep(2400)
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(5000)
await p.screenshot({ path: 'qa-screens/110-street-hud.png' })
await p.getByRole('button', { name: 'Open menu' }).click()
await sleep(900)
await p.screenshot({ path: 'qa-screens/111-menu-journey.png' })
for (const [label, file] of [['About', 'about'], ['AI Workflow', 'workflow'], ['Contact', 'contact'], ['Feedback', 'feedback']]) {
  await p.locator('.ui-explore__more button', { hasText: new RegExp('^' + label + '$') }).click()
  await sleep(600)
  await p.screenshot({ path: `qa-screens/112-menu-${file}.png` })
}
await p.getByRole('button', { name: 'Close menu' }).click()
await sleep(700)
// (the journey now ends at the Contact Café — thank-you and feedback are covered by qa-cafe.mjs)
// Explore menu → Project Studio: walks there (no teleport), the guide narrates on arrival
await p.getByRole('button', { name: 'Open menu' }).click()
await sleep(700)
await p.locator('.ui-explore__item', { hasText: 'Project Studio' }).click()
let arrived = false
for (let t = 0; t < 120000 && !arrived; t += 1000) {
  await sleep(1000)
  arrived = await p.evaluate(() => [...document.querySelectorAll('.ui-voice__log li.is-guide')].some((l) => /Here we are — the Project Studio/.test(l.textContent)))
}
const s = await p.evaluate(() => ({ ...window.__mindscape }))
console.log('menu → Project Studio (walked):', arrived ? 'arrived' : 'NOT ARRIVED', s.x, s.z)
if (!arrived) process.exitCode = 1
await p.screenshot({ path: 'qa-screens/115-menu-projects.png' })
await p.close()
// mobile hero + play
p = await open({ width: 390, height: 844 }, 'debug&touch')
await sleep(600)
await p.getByRole('button', { name: 'Skip intro' }).click()
await sleep(2600)
await p.screenshot({ path: 'qa-screens/116-mobile-hero.png' })
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(5200)
await p.screenshot({ path: 'qa-screens/117-mobile-play.png' })
await p.close()
console.log('errors:', errors.length ? errors : 'none')
await b.close()
