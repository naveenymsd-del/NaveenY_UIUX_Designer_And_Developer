// Close-ups of the intro aircraft + banner (freezes the intro clock mid-pass).
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const mode = process.argv[2] || 'day'
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto(`http://localhost:5173/street?debug&desktop&mode=${mode}`)
await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
for (const t of [2.4, 3.6]) {
  await p.waitForFunction((t) => window.__intro.t >= t, t, { timeout: 30000 })
  await p.screenshot({ path: `qa-screens/170-plane-${mode}-${t}.png` })
}
// frozen close-up
await p.evaluate(() => { window.__intro.t = 3.4; window.__intro.freeze = true })
const x = await p.evaluate(() => 95 - 27 * 3.4)
await p.evaluate(([x]) => window.__shot([x - 2, 61.5, 50 + 17], [x + 6, 59.6, 50]), [x])
await sleep(1500)
await p.screenshot({ path: `qa-screens/171-plane-close-${mode}.png` })
await b.close()
