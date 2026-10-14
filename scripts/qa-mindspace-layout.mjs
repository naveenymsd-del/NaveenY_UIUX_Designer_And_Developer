// Mindspace window layout: at desktop, laptop and tablet sizes every app window fits on screen,
// and the Music Lounge's player bar overhangs (wide) or sits inside (narrower) the window.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
for (const [w, h, app] of [[1440, 900, 'Music'], [1366, 768, 'Music'], [1024, 768, 'Music'], [1024, 768, 'About Me'], [1366, 768, 'Joy Lab'], [820, 1180, 'Music']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage()
  await p.goto(`${base}/mindspace?intro=off`)
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  await sleep(1500)
  await p.getByRole('button', { name: `Open ${app === 'Music' ? 'Music Lounge' : app}` }).click()
  await sleep(1800)
  const r = await p.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) } }
    return { win: q('.ms-window'), bar: q('.mu-bar'), rail: document.querySelector('.mu-rail') ? getComputedStyle(document.querySelector('.mu-rail')).display : null }
  })
  const fits = r.win.t >= 0 && r.win.b <= h && r.win.l >= 0 && r.win.r <= w
  let barOk = true, barNote = ''
  if (r.bar) {
    const wide = w >= 1240 && w / h >= 1
    barOk = r.bar.b <= h && (wide ? r.bar.b > r.win.b : r.bar.b <= r.win.b + 1)
    barNote = wide ? ' · player bar overhangs the window, rail floats outside' : ' · player bar inside the window'
  }
  await p.screenshot({ path: `qa-screens/layout-${app.replace(/\W/g, '')}-${w}x${h}.png` })
  expect(fits && barOk, `${w}×${h} ${app}: window ${r.win.t}–${r.win.b} fits on screen${barNote}`)
  await p.context().close()
}
console.log(`\n${problems.length ? `${problems.length} problem(s)` : 'all checks passed'}`)
await b.close()
