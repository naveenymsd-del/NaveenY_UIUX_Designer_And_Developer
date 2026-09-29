// Enter each room and screenshot (optionally with ?off= flags) — interior QA.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const off = process.argv[2] ?? ''
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await p.goto(`http://localhost:5173/street?debug&desktop${off ? `&off=${off}` : ''}`)
await p.waitForSelector('.ui-intro__actions button', { timeout: 90000 })
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(4500)
await p.keyboard.press('Escape')
for (const [name, x, z, yaw] of [['education', 0, -55.4, Math.PI], ['office', 13.2, 17, Math.PI / 2], ['home', -11.6, -25, -Math.PI / 2]]) {
  await p.evaluate(([x, z, yaw]) => window.__teleport(x, z, yaw), [x, z, yaw])
  await sleep(1400)
  await p.keyboard.press('KeyE')
  await sleep(6200)
  await p.screenshot({ path: `qa-screens/70-room-${name}${off ? '-' + off : ''}.png` })
  const s = await p.evaluate(() => ({ ...window.__mindscape }))
  console.log(name, 'pos', s.x, s.y, s.z, 'fps', s.fps, 'calls', s.calls)
  // exit via the door
  await p.keyboard.down('KeyS'); await sleep(900); await p.keyboard.up('KeyS')
  await sleep(300)
  await p.keyboard.press('KeyE')
  await sleep(1600)
  const o = await p.evaluate(() => ({ ...window.__mindscape }))
  console.log(name, 'after exit', o.x, o.z)
}
console.log('errors:', errors.length ? errors : 'none')
await b.close()
