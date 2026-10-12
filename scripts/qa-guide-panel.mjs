// Guide panel layout: at several viewport widths, every card / chip / input / hint sits inside the
// panel's padding with no clipped text; then each place card and project chip still does its job.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }

async function boot(w, h, mobile) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile })).newPage()
  await p.goto(`${base}/street?debug${mobile ? '' : '&desktop'}`)
  await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
  await p.keyboard.press('Escape')
  await sleep(2200)
  await p.getByRole('button', { name: 'Start exploring' }).click()
  await sleep(4500)
  return p
}
const openGuide = async (p) => {
  await p.evaluate(() => window.__ui?.setGuideOpen ? window.__ui.setGuideOpen(true) : document.querySelector('.ui-guide-btn')?.click())
  await p.waitForSelector('.ui-guide.is-open', { timeout: 5000 })
  await sleep(600)
}

const layout = () => {
  const g = document.querySelector('.ui-guide.is-open')
  // short screens: the panel scrolls inside itself — measure with its end in view
  g.scrollTop = g.scrollHeight
  const gr = g.getBoundingClientRect()
  const cs = getComputedStyle(g)
  const inner = { l: gr.left + parseFloat(cs.paddingLeft) - 0.5, r: gr.right - parseFloat(cs.paddingRight) + 0.5, t: gr.top, b: gr.bottom - parseFloat(cs.paddingBottom) + 0.5 }
  const scrolls = g.scrollHeight > g.clientHeight + 1
  const out = []
  for (const el of g.querySelectorAll('.ui-guide__quick button, .ui-guide__projects button, .ui-guide__ask, .ui-guide__ask button, .ui-guide__chip, .ui-guide__close, .ui-guide__head h2')) {
    const r = el.getBoundingClientRect()
    const name = (el.textContent || el.className).trim().slice(0, 24)
    if (r.left < inner.l || r.right > inner.r || (!scrolls && r.bottom > inner.b) || (scrolls && el.matches('.ui-guide__chip:last-child') && r.bottom > gr.bottom + 0.5)) out.push(`outside: ${name}`)
    if (el.scrollWidth > el.clientWidth + 1) out.push(`clipped: ${name}`)
  }
  const cards = [...g.querySelectorAll('.ui-guide__quick button')].map((c) => c.getBoundingClientRect())
  const widths = new Set(cards.map((c) => Math.round(c.width)))
  const heights = new Set(cards.map((c) => Math.round(c.height)))
  const label = g.querySelector('.ui-guide__label').getBoundingClientRect().left
  const chip = g.querySelector('.ui-guide__projects button').getBoundingClientRect().left
  const orb = document.querySelector('.ui-voice__fab')?.getBoundingClientRect()
  const orbClear = !orb || orb.top >= gr.bottom - 0.5 || orb.right <= gr.left || orb.left >= gr.right
  return { orbClear, out, cols: new Set(cards.map((c) => Math.round(c.left))).size, widths: [...widths], heights: [...heights], labelAligned: Math.abs(label - chip) < 1, pageOverflow: document.documentElement.scrollWidth > innerWidth, panel: [Math.round(gr.width), Math.round(gr.height)], bottomInView: gr.bottom <= innerHeight }
}

for (const [w, h, mobile] of [[1536, 864, false], [1366, 768, false], [1024, 768, false], [390, 844, true], [375, 667, true]]) {
  const p = await boot(w, h, mobile)
  await openGuide(p)
  const r = await p.evaluate(layout)
  await p.screenshot({ path: `qa-screens/guide-panel-${w}.png` })
  expect(r.out.length === 0, `${w}px: everything inside the panel padding, nothing clipped ${r.out.join('; ')}`)
  expect(r.widths.length === 1 && r.heights.length === 1, `${w}px: equal cards (${r.cols} columns, ${r.widths}px × ${r.heights}px)`)
  expect(r.labelAligned, `${w}px: "Jump to a project" aligned with the chips`)
  expect(r.orbClear, `${w}px: the guide's orb doesn't cover the panel`)
  expect(!r.pageOverflow && r.bottomInView, `${w}px: no horizontal overflow, panel fully on screen (${r.panel.join('×')})`)
  await p.context().close()
}

// function: each place card starts a walk (panel closes, the player moves); each project chip opens its case study
const p = await boot(1366, 768, false)
// the guide offers its shortcuts once by itself ~15 s after the start (journey.ts) — let that pass first
await p.waitForSelector('.ui-guide.is-open', { timeout: 30000 }).catch(() => {})
await p.evaluate(() => document.querySelector('.ui-guide.is-open .ui-guide__close')?.click())
await sleep(600)
const pos = () => p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 }))
for (const name of ['Home', 'Education', 'NFC Solutions', 'Projects', 'Design Journey', 'Contact Café']) {
  await openGuide(p)
  const a = await pos()
  await p.locator('.ui-guide__quick button', { hasText: name }).click()
  await sleep(3500)
  const z = await pos()
  const closed = await p.evaluate(() => !document.querySelector('.ui-guide.is-open'))
  const moved = Math.hypot(z.x - a.x, z.z - a.z)
  expect(closed && moved > 1, `card "${name}": panel closes and the walk starts (moved ${moved.toFixed(1)} m)`)
  await p.keyboard.press('Escape')
  await sleep(600)
}
for (const name of ['TASK', 'KidPool', 'Calmscient', 'INTA', 'IntelliStaff']) {
  await openGuide(p)
  await p.locator('.ui-guide__projects button', { hasText: name }).click()
  await p.waitForFunction((n) => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent === n, name, { timeout: 40000 }).catch(() => {})
  const t = await p.evaluate(() => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent ?? null)
  expect(t === name, `chip "${name}" opens its case study (${t})`)
  await p.keyboard.press('Escape')
  await sleep(1400)
}
console.log(`\n${problems.length ? `${problems.length} problem(s)` : 'all checks passed'}`)
await b.close()
