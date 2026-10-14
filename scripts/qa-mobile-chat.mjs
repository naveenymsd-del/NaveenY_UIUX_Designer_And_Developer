// Phone AI chat sheet: rows never overlap (header · conversation · quick row · composer), compact
// default height, expand/collapse, 44px chips scrolling sideways, composer above a (simulated)
// keyboard, smaller visible viewport (browser bars), and the quick destinations still work.
// The keyboard is simulated by overriding visualViewport.height and firing its resize event (Chrome
// device emulation has no real on-screen keyboard); browser bars by resizing the window.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }

const measure = () => {
  const q = (s) => document.querySelector(s)?.getBoundingClientRect()
  const sheet = q('.ui-voice__sheet'), head = q('.ui-voice__sheet-head'), body = q('.ui-voice__sheet-body'), quick = q('.ui-voice__quick'), bar = q('.ui-voice__sheet-bar')
  const rows = [head, body, quick, bar]
  let ordered = rows.every(Boolean)
  for (let i = 1; ordered && i < rows.length; i++) if (rows[i].top < rows[i - 1].bottom - 0.5) ordered = false
  const chips = [...document.querySelectorAll('.ui-voice__quick button')]
  const qEl = document.querySelector('.ui-voice__quick')
  const bodyEl = document.querySelector('.ui-voice__sheet-body')
  const lastMsg = bodyEl?.querySelector('.ui-voice__log li:last-child')?.getBoundingClientRect()
  const vvh = window.visualViewport?.height ?? innerHeight
  const send = q('.ui-voice__sheet-bar .ui-voice__form button'), input = q('.ui-voice__sheet-bar .ui-voice__form input')
  return {
    ordered,
    inside: rows.every((r) => r && r.left >= sheet.left - 0.5 && r.right <= sheet.right + 0.5 && r.bottom <= sheet.bottom + 0.5),
    pct: Math.round((sheet.height / vvh) * 100),
    // on very short screens the sheet holds a 272px floor so the rows never cramp
    floor: sheet.height <= 273,
    sheetBottom: Math.round(sheet.bottom), vvh: Math.round(vvh), composerBottom: Math.round(bar.bottom),
    chips: chips.map((c) => c.textContent),
    chipH: Math.min(...chips.map((c) => c.getBoundingClientRect().height)),
    chipFont: Math.min(...chips.map((c) => parseFloat(getComputedStyle(c).fontSize))),
    chipOneLine: chips.every((c) => c.getBoundingClientRect().height < 50),
    scrollsX: qEl.scrollWidth > qEl.clientWidth + 1,
    bodyMin: Math.round(body.height),
    // scrolled to the latest line: the end of the newest message is on screen (a long one may start above)
    lastVisible: !!lastMsg && lastMsg.bottom <= body.bottom + 1 && lastMsg.bottom >= body.top + 20,
    sendInside: !!send && !!input && send.right <= bar.right + 0.5 && send.top >= bar.top - 0.5 && send.bottom <= bar.bottom + 0.5,
    pageOverflow: document.documentElement.scrollWidth > innerWidth,
    fullReplies: [...document.querySelectorAll('.ui-voice__sheet .ui-voice__log li.is-guide')].every((li) => li.scrollHeight <= li.clientHeight + 1 && getComputedStyle(li).webkitLineClamp === 'none'),
    hintOver: (() => { const t = document.querySelector('.ui-tips.is-visible'); return !!t && getComputedStyle(t).visibility !== 'hidden' })(),
  }
}
const setViewport = (p, h) => p.evaluate((h) => {
  const vv = window.visualViewport
  if (h == null) { delete vv.__h } else vv.__h = h
  if (!vv.__patched) {
    const desc = Object.getOwnPropertyDescriptor(VisualViewport.prototype, 'height')
    Object.defineProperty(vv, 'height', { configurable: true, get() { return this.__h ?? desc.get.call(this) } })
    vv.__patched = true
  }
  vv.dispatchEvent(new Event('resize'))
}, h)

for (const [w, h] of [[320, 700], [375, 812], [390, 844], [430, 932]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage()
  await p.goto(`${base}/street?mode=day&onboarding=off`)
  await p.waitForSelector('.ui-intro.is-hero', { timeout: 120000 })
  await sleep(1000)
  await p.getByRole('button', { name: 'Start exploring' }).click()
  await p.waitForSelector('.ui-voice__fab', { timeout: 30000 })
  await sleep(1500)
  await p.locator('.ui-voice__fab').tap()
  await p.getByRole('button', { name: 'Type instead' }).tap({ timeout: 1500 }).catch(() => {}) // (the orb now opens the chat directly)
  await sleep(400)
  for (const t of ['Tell me about Naveen', 'What tools does he use?']) {
    await p.locator('.ui-voice__sheet-bar input').fill(t)
    await p.keyboard.press('Enter')
    await sleep(1800)
  }
  await p.evaluate(() => window.speechSynthesis?.cancel())
  await sleep(500)
  const m = await p.evaluate(measure)
  await p.screenshot({ path: `qa-screens/chat-${w}x${h}.png` })
  expect(m.ordered && m.inside, `${w}×${h}: header · conversation · quick row · composer stacked, no overlap`)
  expect(m.pct >= 30 && (m.pct <= 45 || m.floor), `${w}×${h}: compact by default (${m.pct}% of the visible screen)`)
  expect(m.chips.join(',') === 'Projects,NFC,About,Education,Contact' && m.chipH >= 44 && m.chipFont >= 14 && m.chipOneLine, `${w}×${h}: five chips, one line, ${m.chipH}px tall, ${m.chipFont}px text${m.scrollsX ? ' (row scrolls sideways)' : ''}`)
  expect(m.lastVisible && m.bodyMin >= 60, `${w}×${h}: latest message in view (${m.bodyMin}px conversation)`)
  expect(m.fullReplies, `${w}×${h}: replies shown in full in the sheet (no 3-line clamp)`)
  expect(!m.hintOver, `${w}×${h}: no hint card over the open sheet`)
  expect(m.sendInside && !m.pageOverflow, `${w}×${h}: send button inside the composer, no horizontal page overflow`)

  // expand / collapse
  await p.getByRole('button', { name: 'Make the conversation taller' }).tap()
  await sleep(450)
  const t = await p.evaluate(measure)
  await p.getByRole('button', { name: 'Make the conversation smaller' }).tap()
  await sleep(450)
  const s = await p.evaluate(measure)
  expect(t.pct >= 55 && t.pct <= 62 && t.ordered && s.pct === m.pct, `${w}×${h}: expand → ${t.pct}%, back → ${s.pct}%`)

  // sideways scroll of the chips by touch
  if (m.scrollsX) {
    const box = await p.locator('.ui-voice__quick').boundingBox()
    const cdp = await p.context().newCDPSession(p)
    const y = box.y + box.height / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width - 30, y }] })
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 30 - i * 18, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(500)
    const sl = await p.evaluate(() => document.querySelector('.ui-voice__quick').scrollLeft)
    const lastIn = await p.evaluate(() => { const q = document.querySelector('.ui-voice__quick').getBoundingClientRect(), c = document.querySelector('.ui-voice__quick button:last-child').getBoundingClientRect(); return c.right <= q.right + 1 })
    expect(sl > 20 && lastIn, `${w}×${h}: swipe scrolls the chips; "Contact" comes fully into view (scrolled ${Math.round(sl)}px)`)
  }

  // browser bars visible (smaller visible viewport), then the keyboard
  // browser bars visible: the whole window gets shorter (innerHeight and the visual viewport together)
  await p.setViewportSize({ width: w, height: h - 110 })
  await sleep(500)
  const bars = await p.evaluate(measure)
  await p.setViewportSize({ width: w, height: h })
  await sleep(500)
  await p.locator('.ui-voice__sheet-bar input').focus()
  const kbH = Math.round(h * 0.42)
  await setViewport(p, h - kbH)
  await sleep(300)
  const k = await p.evaluate(measure)
  await p.screenshot({ path: `qa-screens/chat-${w}x${h}-keyboard.png` })
  expect(bars.ordered && bars.pct >= 30 && (bars.pct <= 45 || bars.floor), `${w}×${h}: with browser bars (${bars.vvh}px visible): still compact (${bars.pct}%) and stacked`)
  expect(k.ordered && k.composerBottom <= k.vvh && k.sheetBottom <= h - kbH + 1, `${w}×${h}: keyboard (${kbH}px): composer stays above it (composer bottom ${k.composerBottom} ≤ ${k.vvh})`)
  await setViewport(p, null)
  await p.locator('.ui-voice__sheet-bar input').blur()
  await sleep(300)
  const back = await p.evaluate(measure)
  expect(back.pct === m.pct, `${w}×${h}: keyboard closed → back to ${back.pct}% (no leftover space)`)

  // a quick destination still does its job: the guide walks there (the sheet steps aside while walking)
  if (w === 390) {
    const before = await p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 }))
    await p.locator('.ui-voice__quick button', { hasText: 'Education' }).tap()
    await sleep(5000)
    const after = await p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 }))
    const moved = Math.hypot(after.x - before.x, after.z - before.z)
    const lines = await p.evaluate(() => [...document.querySelectorAll('.ui-voice .ui-voice__log li.is-guide')].map((l) => l.textContent).slice(-2).join(' | '))
    expect(moved > 2 || /education/i.test(lines), `quick "Education" → the guide heads there (moved ${moved.toFixed(1)} m; "${lines.slice(0, 70)}")`)
  }
  await p.context().close()
}
console.log(`\n${problems.length ? `${problems.length} problem(s)` : 'all checks passed'}`)
await b.close()
