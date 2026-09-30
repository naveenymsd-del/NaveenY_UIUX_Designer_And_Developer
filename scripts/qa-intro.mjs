// Captures the loading screen, each beat of the cinematic intro, the hero, and the hand-off.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const vp = process.argv[2] && process.argv[2] !== '-' ? process.argv[2].split('x').map(Number) : [1440, 900]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: vp[0], height: vp[1] } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
await p.goto(`http://localhost:5173/street?debug&desktop${process.argv[3] ? '&' + process.argv[3] : ''}`)
await sleep(1500)
await p.screenshot({ path: `qa-screens/90-loading-${process.argv[3] ? 'n-' : ''}${vp[0]}.png` })
await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
for (const t of [1.5, 3.2, 4.8, 6.4, 9, 12.5]) {
  await p.waitForFunction((t) => window.__intro.t >= t, t, { timeout: 60000 })
  await p.screenshot({ path: `qa-screens/91-intro-${process.argv[3] ? 'n-' : ''}${String(t).replace('.', '_')}-${vp[0]}.png` })
}
await p.waitForFunction(() => window.__intro.t >= 16.8, null, { timeout: 60000 })
await p.screenshot({ path: `qa-screens/92-hero-${process.argv[3] ? 'n-' : ''}${vp[0]}.png` })
await p.waitForFunction(() => window.__intro.t >= 20.4, null, { timeout: 60000 })
await p.screenshot({ path: `qa-screens/93-hero-msg-${process.argv[3] ? 'n-' : ''}${vp[0]}.png` })
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(5200)
await p.screenshot({ path: `qa-screens/94-street-${process.argv[3] ? 'n-' : ''}${vp[0]}.png` })
await sleep(6000)
await p.screenshot({ path: `qa-screens/95-street-msg-${process.argv[3] ? 'n-' : ''}${vp[0]}.png` })
console.log('errors:', errors.length ? errors : 'none')
await b.close()
