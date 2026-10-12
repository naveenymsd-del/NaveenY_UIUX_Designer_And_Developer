// Rain-glass opening: captures the pane, a mouse wipe (desktop), a finger swipe (touch emulation),
// and checks the glass clears by itself and hands over to the intro cinematic.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const results = []
const expect = (ok, name) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`) }

async function run(label, ctxOpts, interact) {
  const p = await (await b.newContext(ctxOpts)).newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  const t0 = Date.now()
  await p.addInitScript(() => {
    // record whether the cinematic began only after the glass knew the world was ready
    const iv = setInterval(() => {
      const el = document.querySelector('.ui-rain.is-done')
      if (el) { window.__handoffReady = el.classList.contains('is-ready'); clearInterval(iv) }
    }, 30)
  })
  await p.goto(`${base}/street`)
  await p.waitForSelector('.ui-rain', { timeout: 15000 })
  await sleep(900)
  await p.screenshot({ path: `qa-screens/rain-${label}-0-glass.png` })
  const old = await p.evaluate(() => !!document.querySelector('.ui-splash__brand, .ui-splash__hello, .ui-loading__meter'))
  expect(!old, `${label}: old welcome splash content is gone`)
  await interact(p)
  await p.screenshot({ path: `qa-screens/rain-${label}-1-wiped.png` })
  await p.waitForSelector('.ui-rain.is-ready', { timeout: 90000 })
  await sleep(1400)
  await p.screenshot({ path: `qa-screens/rain-${label}-1b-ready-blurred.png` })
  // hands-off: the cinematic starts once the glass has cleared (and the world is ready)
  await p.waitForFunction(() => window.__intro?.running || document.querySelector('.ui-rain.is-done'), null, { timeout: 90000 })
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  await p.screenshot({ path: `qa-screens/rain-${label}-2-handoff.png` })
  await p.waitForFunction(() => window.__handoffReady !== undefined, null, { timeout: 30000 })
  const ready = await p.evaluate(() => window.__handoffReady)
  expect(ready, `${label}: hand-off only after the world is ready (took ${secs}s incl. load)`)
  await sleep(2200)
  const gone = await p.evaluate(() => !document.querySelector('.ui-rain'))
  expect(gone, `${label}: glass removed after hand-off`)
  await p.screenshot({ path: `qa-screens/rain-${label}-3-after.png` })
  expect(errors.length === 0, `${label}: no page errors ${errors.length ? JSON.stringify(errors) : ''}`)
  await p.context().close()
}

await run('desktop', { viewport: { width: 1440, height: 900 } }, async (p) => {
  await p.mouse.move(200, 300)
  for (let i = 0; i <= 30; i++) await p.mouse.move(200 + i * 35, 300 + Math.sin(i / 4) * 120)
})

await run('phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, async (p) => {
  // a finger swipe via CDP touch events (pointer events of type "touch")
  const s = await p.context().newCDPSession(p)
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 40, y: 500 }] })
  for (let i = 1; i <= 20; i++) await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 40 + i * 15, y: 500 - i * 12 }] })
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
})

console.log(results.join('\n'))
await b.close()
