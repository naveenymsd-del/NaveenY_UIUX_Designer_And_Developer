// Collision + simulation checks: walk into a facade, verify we stop; verify traffic & NPCs move.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage()
await p.goto('http://localhost:5173/street?debug&desktop&quality=low')
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
 await new Promise((r) => setTimeout(r, 600))
 await p.getByRole('button', { name: 'Skip intro' }).click()
 await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
 await new Promise((r) => setTimeout(r, 1200))
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(4500)
await p.keyboard.press('Escape')
const st = () => p.evaluate(() => ({ ...window.__mindscape }))
// 1) walk west into the Daily Goods facade (front at x = -9)
await p.evaluate(() => window.__teleport(-6.2, -27.5, -Math.PI / 2))
await sleep(1200)
await p.keyboard.down('KeyW'); await sleep(2500); await p.keyboard.up('KeyW')
const s1 = await st()
console.log('home fence / facade: x =', s1.x, s1.x > -9.2 ? 'BLOCKED ✓' : 'PASSED THROUGH ✗')
// 2) walk into the fountain basin from the west
await p.evaluate(() => window.__teleport(12, -25, Math.PI / 2))
await sleep(1200)
await p.keyboard.down('KeyW'); await sleep(2500); await p.keyboard.up('KeyW')
const s2 = await st()
console.log('fountain: x =', s2.x, s2.x < 15 ? 'BLOCKED ✓' : 'PASSED THROUGH ✗')
// 3) walk up the park ramp onto the lookout deck (top ≈ 1.5)
await p.evaluate(() => window.__teleport(-14.3, 29.6, 0))
await sleep(1200)
await p.keyboard.down('KeyW'); await sleep(4200); await p.keyboard.up('KeyW')
const s3 = await st()
console.log('park ramp: y =', s3.y, 'x', s3.x, 'z', s3.z, s3.state, s3.y > 1.2 ? 'ON DECK ✓' : 'not on deck')
// 4) world boundary: run east along a road toward the edge
await p.evaluate(() => window.__teleport(52, 0.5, Math.PI / 2))
await sleep(1000)
await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await sleep(3000); await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft')
const s4 = await st()
console.log('boundary: x =', s4.x, s4.x < 58.2 ? 'CONTAINED ✓' : 'ESCAPED ✗')
// 5) traffic + pedestrians move
const snap = () => p.evaluate(() => {
  const out = { cars: [], npcs: [] }
  window.__scene.traverse((o) => {
    if (o.name === 'traffic') o.children.forEach((c) => c.position && out.cars.push([c.position.x, c.position.z]))
    if (o.name === 'npcs') o.children.forEach((c) => c.position && out.npcs.push([c.position.x, c.position.z]))
  })
  return out
})
await p.evaluate(() => window.__teleport(0, 20, Math.PI))
await sleep(800)
const a = await snap(); await sleep(3000); const c = await snap()
const moved = (A, B) => A.filter((v, i) => B[i] && Math.hypot(v[0] - B[i][0], v[1] - B[i][1]) > 0.5).length
console.log('vehicles moving:', moved(a.cars, c.cars), '/', a.cars.length, ' npc groups moving:', moved(a.npcs, c.npcs), '/', a.npcs.length)
await b.close()
