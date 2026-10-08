// Same places at every moment of the day: day, golden hour, sunset, blue hour, night.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const only = process.argv[2]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await p.goto('http://localhost:5173/street?debug&desktop&time=14.5')
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await sleep(500)
await p.getByRole('button', { name: 'Skip intro' }).click()
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1200)
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(4500)
const places = [
  ['avenue', 0, 60, Math.PI],
  ['nfc', 4.5, 22, Math.PI * 0.62],
  ['park', -25.5, 38, Math.PI],
  ['home', -3, -21, -Math.PI * 0.62],
  ['campus', 0, -44, Math.PI],
]
const times = [['1-day', 14.5], ['2-golden', 17.5], ['3-sunset', 18.25], ['4-blue', 18.9], ['5-night', 21.5]]
for (const [pname, x, z, yaw] of places) {
  if (only && !pname.startsWith(only)) continue
  await p.evaluate(([x, z, yaw]) => window.__teleport(x, z, yaw), [x, z, yaw])
  await sleep(1600)
  for (const [tname, h] of times) {
    await p.evaluate((h) => window.__time(h), h)
    await sleep(900)
    await p.screenshot({ path: `qa-screens/130-${pname}-${tname}.png` })
  }
}
const s = await p.evaluate(() => ({ ...window.__mindscape }))
console.log('fps at night', s.fps, 'calls', s.calls, 'tris', s.triangles)
console.log('errors:', errors.length ? errors : 'none')
await b.close()
