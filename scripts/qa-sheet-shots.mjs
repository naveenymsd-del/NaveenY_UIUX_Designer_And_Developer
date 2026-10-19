// Screenshots: the welcome sheet on a short phone (top and scrolled to the end) and the desktop hero.
// Checks: chips not clipped, the opt-out left-aligned, hero buttons one height.
// Usage: node scripts/qa-sheet-shots.mjs [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }

for (const [w, h] of [[425, 601], [390, 844]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })).newPage()
  await p.goto(`${base}/street?mode=day`)
  await p.waitForSelector('.wl.is-ready', { timeout: 120000 })
  await sleep(2000)
  await p.screenshot({ path: `qa-screens/sheet-${w}x${h}-top.png` })
  const r = await p.evaluate(() => {
    const sheet = document.querySelector('.wl-sheet').getBoundingClientRect()
    const row = document.querySelector('.wl-dests ol').getBoundingClientRect()
    const chip = document.querySelector('.wl-dests button').getBoundingClientRect()
    return { sheetPct: Math.round((sheet.height / innerHeight) * 100), clipTop: chip.top < row.top - 0.5, clipBottom: chip.bottom > row.bottom + 0.5 }
  })
  expect(r.sheetPct >= 55, `${w}×${h}: the sheet takes ${r.sheetPct}% of the screen`)
  expect(!r.clipTop && !r.clipBottom, `${w}×${h}: destination chips not clipped`)
  await p.evaluate(() => { const s = document.querySelector('.wl-sheet'); s.scrollTop = s.scrollHeight })
  await sleep(500)
  await p.screenshot({ path: `qa-screens/sheet-${w}x${h}-end.png` })
  const al = await p.evaluate(() => {
    const n = document.querySelector('.wl-never').getBoundingClientRect()
    const help = document.querySelector('.wl-help').getBoundingClientRect()
    return Math.abs(n.left - help.left)
  })
  expect(al < 4, `${w}×${h}: "Don't show this introduction again" left-aligned (${Math.round(al)}px)`)
  await p.context().close()
}

// the welcome side panel: no empty band below its content, at every desktop size
for (const [w, h] of [[1440, 900], [1366, 768], [1920, 1080], [1280, 720]]) {
  const q = await (await b.newContext({ viewport: { width: w, height: h } })).newPage()
  await q.goto(`${base}/street?mode=day&desktop`)
  await q.waitForSelector('.wl.is-ready', { timeout: 120000 })
  await sleep(1500)
  const gap = await q.evaluate(() => { const s = document.querySelector('.wl-side'); const r = s.getBoundingClientRect(); const last = [...s.children].pop().getBoundingClientRect(); return Math.round(r.bottom - last.bottom) })
  expect(gap <= 24, `${w}×${h}: welcome side panel has no empty space below (${gap}px)`)
  await q.screenshot({ path: `qa-screens/side-${w}x${h}.png` })
  await q.context().close()
}
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto(`${base}/street?debug&mode=day&desktop`)
await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
await p.keyboard.press('Escape')
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1600)
await p.screenshot({ path: 'qa-screens/sheet-hero-1440.png' })
const hs = await p.evaluate(() => [...document.querySelectorAll('.ui-intro__actions .ui-btn, .ui-intro__links > a')].map((e) => Math.round(e.getBoundingClientRect().height)))
expect(new Set(hs).size === 1, `hero buttons one height (${hs.join(', ')})`)
await b.close()
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall sheet checks passed')
process.exit(problems.length ? 1 : 0)
