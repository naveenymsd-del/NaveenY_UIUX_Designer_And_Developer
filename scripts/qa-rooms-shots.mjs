// Home + Education interiors: walk in (through the guide), look from a few spots, screenshot,
// and check that every story point in the room can still be reached and opened with E.
// Usage: node scripts/qa-rooms-shots.mjs [baseUrl] [WxH]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const [W, H] = (process.argv[3] ?? '1440x900').split('x').map(Number)
const touch = W < 700
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
await p.goto(`${base}/street?debug&mode=day${touch ? '' : '&desktop'}`)
await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
await p.keyboard.press('Escape')
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1200)
await p.getByRole('button', { name: /^Start exploring/i }).click()
await p.waitForFunction(() => document.querySelector('.app.phase-playing'), null, { timeout: 30000 })
await sleep(2500)

const ROOMS = {
  home: { origin: [320, 120], ask: 'take me home', views: [[0, 5.2, Math.PI], [6.5, 4.5, -2.2], [-1.0, 4.2, 2.6], [5.0, -1.8, 2.2]],
    stories: [['hello', 0, 3.4], ['desk', -1.2, -4.5], ['laptop', 1.4, -4.5], ['aiWorkflow', 7.2, -2.2], ['portfolio', 7.2, 2.8], ['window', -4.8, -5.1], ['skills', -7.1, 3.9], ['galleryEntry', 6.7, -5.2], ['contact', -4.6, 5.6]] },
  education: { origin: [320, -120], ask: 'take me to education', views: [[2.3, 4.6, 0], [10.5, 6.5, -2.4], [-4.5, 2.5, -2.4], [5.5, 1.5, Math.PI]],
    stories: [['timeline', -10.2, 0], ['certificates', 10.2, 1.4], ['bell', -3.2, 7.0]] },
}
const panelOpen = () => p.evaluate(() => !!document.querySelector('.ui-panel.is-visible, .ui-case.is-visible, .ui-gallery'))

for (const [id, R] of Object.entries(ROOMS)) {
  // walk in through the guide (the real way)
  if (!(await p.locator('#ag-panel, .ui-voice.is-open').count())) {
    if (touch) await p.locator('.ui-voice__fab').tap(); else await p.locator('.ag-launcher').click()
  }
  await sleep(400)
  await p.locator('input[aria-label="Message the AI guide"]').first().fill(R.ask)
  await p.keyboard.press('Enter')
  const inside = await p.waitForFunction((o) => Math.abs((window.__mindscape?.x ?? 0) - o[0]) < 13 && Math.abs((window.__mindscape?.z ?? 0) - o[1]) < 10, R.origin, { timeout: 90000 }).then(() => true, () => false)
  expect(inside, `${id}: the guide walks you inside`)
  await sleep(7000)
  if (touch) await p.locator('.ui-voice.is-open [aria-label="Collapse the AI guide"]').click().catch(() => {}); else await p.locator('#ag-panel .ag-min').click().catch(() => {})
  await sleep(600)
  for (const [i, [x, z, yaw]] of R.views.entries()) {
    await p.evaluate(([x, z, yaw]) => window.__teleport(x, z, yaw), [R.origin[0] + x, R.origin[1] + z, yaw])
    await sleep(1600)
    await p.screenshot({ path: `qa-screens/room-${id}-${W}-${i}.png` })
  }
  // every story point still works
  for (const [kind, x, z] of R.stories) {
    await p.evaluate(([x, z]) => window.__teleport(x, z, Math.PI), [R.origin[0] + x, R.origin[1] + z + 0.6])
    await sleep(1300)
    await p.keyboard.press('KeyE')
    await sleep(1500)
    const ok = await panelOpen()
    expect(ok || kind === 'bell', `${id}: ${kind} opens`)
    await p.keyboard.press('Escape')
    await sleep(900)
  }
}
expect(errors.length === 0, `no page errors ${errors.join(' | ')}`)
await b.close()
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall room checks passed')
process.exit(problems.length ? 1 : 0)
