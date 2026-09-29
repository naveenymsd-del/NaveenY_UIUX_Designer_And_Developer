// Toggle cycle (Auto → Day → Sunset → Night → Auto) with smooth time-lapses, plus the office studio at night.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await p.goto('http://localhost:5173/street?debug&desktop')
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await p.getByRole('button', { name: 'Skip intro' }).click()
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1000)
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(4500)
const hour = () => p.evaluate(() => window.__hour())

console.log('start (auto, local time):', await hour())
for (const step of ['day', 'sunset', 'night', 'auto']) {
  await p.locator('.ui-top .ui-daynight').click()
  const samples = []
  for (let i = 0; i < 8; i++) { await sleep(700); samples.push(await hour()) }
  console.log(`→ ${step}:`, samples.join(' '))
  // monotonic in one direction (allowing the 24 ↔ 0 wrap)
  const dirs = new Set()
  for (let i = 1; i < samples.length; i++) {
    let d = samples[i] - samples[i - 1]
    if (d > 12) d -= 24
    if (d < -12) d += 24
    if (Math.abs(d) > 0.02) dirs.add(Math.sign(d)) // ignore auto mode's slow normal tick
  }
  if (dirs.size > 1) errors.push(`time changed direction during ${step}`)
  await p.screenshot({ path: `qa-screens/140-toggle-${step}.png` })
}
// office + studio at night
await p.evaluate(() => { window.__mode('night'); window.__time(21.5) })
await sleep(600)
await p.evaluate(() => window.__teleport(13.2, 17, Math.PI / 2))
await sleep(1500)
await p.keyboard.press('KeyE')
await sleep(6000)
await p.screenshot({ path: 'qa-screens/141-office-night.png' })
await p.evaluate(() => window.__teleport(320 + 21.2, -0.2, Math.PI / 2))
await sleep(2000)
await p.screenshot({ path: 'qa-screens/142-studio-night.png' })
console.log('errors:', errors.length ? errors : 'none')
await b.close()
