// Captures the loading screen, each beat of the cinematic intro, the hero, and the hand-off.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const vp = process.argv[2] ? process.argv[2].split('x').map(Number) : [1440, 900]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: vp[0], height: vp[1] } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
await p.goto('http://localhost:5173/street?debug&desktop')
await sleep(1500)
await p.screenshot({ path: `qa-screens/90-loading-${vp[0]}.png` })
await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
for (const t of [2, 6.5, 10, 13.5]) {
  await p.waitForFunction((t) => window.__intro.t >= t, t, { timeout: 60000 })
  await p.screenshot({ path: `qa-screens/91-intro-${String(t).replace('.', '_')}-${vp[0]}.png` })
}
await p.waitForFunction(() => window.__intro.t >= 17.5, null, { timeout: 60000 })
await p.screenshot({ path: `qa-screens/92-hero-${vp[0]}.png` })
await p.waitForFunction(() => window.__intro.t >= 21.5, null, { timeout: 60000 })
await p.screenshot({ path: `qa-screens/93-hero-msg-${vp[0]}.png` })
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(5200)
await p.screenshot({ path: `qa-screens/94-street-${vp[0]}.png` })
await sleep(6000)
await p.screenshot({ path: `qa-screens/95-street-msg-${vp[0]}.png` })
console.log('errors:', errors.length ? errors : 'none')
await b.close()
