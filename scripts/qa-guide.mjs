// AI guide: open by clicking the companion + header button, quick links, typed commands,
// the aerial glide, greetings, the Home skill wall and the Growth Walk.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const st = () => p.evaluate(() => ({ ...window.__mindscape }))
await p.goto('http://localhost:5173/street?debug&desktop&mode=day')
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await p.getByRole('button', { name: 'Skip intro' }).click()
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1200)
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(5000)
// click the companion in the 3D view (project its position to the screen)
const hit = await p.evaluate(() => {
  const scene = window.__scene
  let pos = null
  scene.traverse((o) => { if (!pos && o.type === 'PointLight' && o.parent && o.parent.children.length > 3 && o.color && o.color.getHexString() === 'ffb070') pos = o.parent })
  if (!pos) return null
  const v = pos.getWorldPosition(new pos.position.constructor())
  const cam = scene.userData.camera
  return v ? { x: v.x, y: v.y, z: v.z } : null
})
console.log('companion world pos', hit)
await p.getByRole('button', { name: /Open your guide/ }).click()
await sleep(700)
await p.screenshot({ path: 'qa-screens/150-guide-open.png' })
await p.getByRole('button', { name: 'Close guide' }).click()
await sleep(500)
const trips = [['quick', 'Home'], ['type', 'college'], ['type', 'show projects'], ['quick', 'Design'], ['type', 'resume'], ['type', 'career']]
for (const [how, what] of trips) {
  await p.getByRole('button', { name: /Open your guide/ }).click()
  await sleep(500)
  if (how === 'quick') await p.locator('.ui-guide__quick button', { hasText: what }).click()
  else {
    await p.locator('.ui-guide__ask input').fill(what)
    await p.keyboard.press('Enter')
  }
  await sleep(1150)
  await p.screenshot({ path: `qa-screens/151-glide-${what.replace(/\s/g, '-')}.png` })
  await sleep(5200)
  const s = await st()
  const where = await p.evaluate(() => document.querySelector('.ui-where b')?.textContent)
  console.log(`${how} "${what}" →`, where, s.x, s.z)
  await p.screenshot({ path: `qa-screens/152-arrive-${what.replace(/\s/g, '-')}.png` })
  await p.keyboard.press('Escape')
  await sleep(600)
}
// unknown command stays put and suggests options
await p.getByRole('button', { name: /Open your guide/ }).click()
await sleep(400)
await p.locator('.ui-guide__ask input').fill('pizza')
await p.keyboard.press('Enter')
await sleep(500)
console.log('unknown command hint:', await p.evaluate(() => document.querySelector('.ui-guide__hint')?.className))
await p.keyboard.press('Escape')
// Home skill wall
await p.getByRole('button', { name: /Open your guide/ }).click()
await sleep(300)
await p.locator('.ui-guide__quick button', { hasText: 'Home' }).click()
await sleep(6500)
await p.evaluate(() => window.__teleport(320 - 7.2, 120 + 3.9, -Math.PI / 2))
await sleep(1500)
await p.screenshot({ path: 'qa-screens/153-home-skills.png' })
// Growth Walk + a greeting
await p.getByRole('button', { name: 'Back outside' }).click()
await sleep(2000)
await p.evaluate(() => window.__teleport(7.6, -46, 0))
await sleep(1500)
await p.keyboard.down('KeyW'); await sleep(2600); await p.keyboard.up('KeyW')
await sleep(600)
await p.screenshot({ path: 'qa-screens/154-growth-walk.png' })
let greet = null
for (let i = 0; i < 30 && !greet; i++) {
  greet = await p.evaluate(() => document.querySelector('.ui-greet.is-visible')?.textContent ?? null)
  if (!greet) { await p.keyboard.down('KeyW'); await sleep(350); await p.keyboard.up('KeyW') }
}
console.log('greeting seen:', greet)
console.log('errors:', errors.length ? errors : 'none')
await b.close()
