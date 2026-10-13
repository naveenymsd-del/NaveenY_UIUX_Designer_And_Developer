// Mindspace intro: frames through the opening, the hand-over to the room, Skip intro, and
// that a second visit in the same session goes straight to the room.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }

// 1 · the full intro, untouched
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  await p.goto(`${base}/mindspace`)
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  const t0 = Date.now()
  const skip = await p.evaluate(() => !!document.querySelector('.ms-intro__skip'))
  for (const at of [1.2, 2.6, 3.8, 5.0, 5.6]) {
    await sleep(Math.max(0, at * 1000 - (Date.now() - t0)))
    await p.screenshot({ path: `qa-screens/ms-intro-${String(at).replace('.', '_')}.png` })
  }
  await p.waitForFunction(() => document.querySelector('.ms') && !document.querySelector('.ms.is-intro'), null, { timeout: 15000 })
  const secs = (Date.now() - t0) / 1000
  await sleep(2600)
  await p.screenshot({ path: 'qa-screens/ms-intro-arrived.png' })
  const icons = await p.evaluate(() => [...document.querySelectorAll('.ms-icon')].filter((b) => getComputedStyle(b).opacity > 0.9).length)
  expect(skip, 'Skip intro is offered during the opening')
  expect(secs >= 4.5 && secs <= 9, `intro hands over to the room after ${secs.toFixed(1)} s`)
  expect(icons === 9, `icons appear in the room (${icons}/9)`)
  // same session, reload: no intro
  await p.reload()
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  expect(!(await p.evaluate(() => !!document.querySelector('.ms.is-intro'))), 'second visit in the session: straight into the room')
  expect(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`)
  await ctx.close()
}
// 2 · Skip intro at once
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(`${base}/mindspace`)
  await p.waitForSelector('.ms-intro__skip', { timeout: 30000 })
  await sleep(600)
  const t0 = Date.now()
  await p.getByRole('button', { name: 'Skip intro' }).click()
  await p.waitForFunction(() => !document.querySelector('.ms.is-intro'), null, { timeout: 5000 })
  expect(Date.now() - t0 < 800, `Skip intro → the room at once (${Date.now() - t0} ms)`)
  await ctx.close()
}
// 3 · reduced motion: no intro
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(`${base}/mindspace`)
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  expect(!(await p.evaluate(() => !!document.querySelector('.ms.is-intro'))), 'reduced motion: no intro, straight into the room')
  await ctx.close()
}
console.log(`\n${problems.length ? `${problems.length} problem(s)` : 'all checks passed'}`)
await b.close()
