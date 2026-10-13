// Mindspace time of day: each of the four looks (forced with ?tod=), the room from two angles, an app
// window over it, and the measured contrast of white text on the window's glass in each look.
// Also checks that, without a preview parameter, the room follows the browser's local clock.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }

/** average colour of a screen region, read from a real screenshot (so it includes the blurred room) */
async function regionLuma(p, box) {
  const png = (await p.screenshot({ clip: box })).toString('base64')
  return p.evaluate(async (src) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + src
    await img.decode()
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height })
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let max = 0, sum = 0, n = 0
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    for (let i = 0; i < d.length; i += 4) {
      const L = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
      sum += L; n++
      if (L > max) max = L
    }
    return { avg: sum / n, max }
  }, png)
}
const ratio = (Lbg, Lfg = 1) => (Math.max(Lbg, Lfg) + 0.05) / (Math.min(Lbg, Lfg) + 0.05)

for (const tod of ['morning', 'afternoon', 'evening', 'night']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  await p.goto(`${base}/mindspace?intro=off&tod=${tod}`)
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  await sleep(2800)
  await p.screenshot({ path: `qa-screens/tod-${tod}-1-room.png` })
  const attr = await p.evaluate(() => document.querySelector('.ms')?.dataset.tod)
  expect(attr === tod, `${tod}: the room reports "${attr}"`)
  // look toward the left wall and the lamp
  await p.mouse.move(720, 870); await p.mouse.down()
  for (let i = 1; i <= 14; i++) await p.mouse.move(720 + i * 40, 870)
  await p.mouse.up(); await sleep(1200)
  await p.screenshot({ path: `qa-screens/tod-${tod}-2-side.png` })
  await p.getByRole('button', { name: 'Reset view' }).click(); await sleep(1400)
  // an app window over the room: measure the text contrast on its glass
  await p.getByRole('button', { name: 'Open About Me' }).click()
  await p.waitForSelector('.ms-window'); await sleep(1600)
  await p.screenshot({ path: `qa-screens/tod-${tod}-3-window.png` })
  // an empty patch of glass (inside the padding, right of the hero text) and the header strip
  const r = await p.evaluate(() => { const w = document.querySelector('.ms-window').getBoundingClientRect(); return { x: w.right - 70, y: w.top + 80, w: 40, h: Math.min(400, w.height - 120) } })
  const L = await regionLuma(p, { x: r.x, y: r.y, width: r.w, height: r.h })
  const body = ratio(L.max, 1), muted = ratio(L.max, 0.56 * 1 + 0.44 * L.max)
  expect(body >= 4.5, `${tod}: white text on the window glass — contrast ${body.toFixed(1)}:1 at the brightest point (≥ 4.5)`)
  expect(muted >= 3, `${tod}: secondary text — contrast ${muted.toFixed(1)}:1 (≥ 3, large/secondary)`)
  await p.keyboard.press('Escape'); await sleep(600)
  // the launcher labels over the room
  const lab = await p.evaluate(() => { const l = document.querySelector('.ms-icon:nth-child(3) .ms-icon__label').getBoundingClientRect(); return { x: l.x, y: l.y, width: l.width, height: l.height } })
  const LL = await regionLuma(p, lab)
  expect(errors.length === 0, `${tod}: no page errors`)
  console.log(`   (label backing luminance avg ${LL.avg.toFixed(2)})`)
  await ctx.close()
}

// no preview parameter: the look matches the browser's clock (a fixed fake time in the browser)
for (const [hh, want] of [[7, 'morning'], [14, 'afternoon'], [18, 'evening'], [23, 'night'], [3, 'night']]) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } })
  const p = await ctx.newPage()
  await p.clock.setFixedTime(new Date(2026, 9, 13, hh, 10))
  await p.goto(`${base}/mindspace?intro=off`)
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  await sleep(600)
  const got = await p.evaluate(() => document.querySelector('.ms')?.dataset.tod)
  expect(got === want, `local clock ${String(hh).padStart(2, '0')}:10 → ${got}`)
  await ctx.close()
}
console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
await b.close()
