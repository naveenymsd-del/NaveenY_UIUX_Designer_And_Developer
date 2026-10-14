// Liquid glass QA: screenshots of each surface (idle / hover / focus), every glass control is the
// element actually hit at its centre (decorative layers never intercept), hit areas didn't shrink,
// the hover sweep runs once and stops, and reduced motion turns the motion off.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const shot = (p, name, el) => el ? el.screenshot({ path: `qa-screens/glass-${name}.png` }) : p.screenshot({ path: `qa-screens/glass-${name}.png` })

/** every visible glass control: centre hit-test and size */
const audit = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }).map((e) => {
  const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return { name: (e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 28), ok: !!hit && (hit === e || e.contains(hit)), h: Math.round(r.height), w: Math.round(r.width) }
}), sel)
const SEL = '.ms-btn, .mu-btn, .jl-play, .jl-ghost, .ms-mini__cta, .jl-back, .ms-filters button, .mu-chips button, .ms-round, .ms-pill, .ms-window__close, .jl-hud__ctl button, .mu-bar__ctl button, .mu-bar__vol button, .mu-card__ctl button, .ms-mini__btn, .mu-rail button, .mu-mini-play'
const report = (label, list) => {
  const bad = list.filter((x) => !x.ok)
  const small = list.filter((x) => Math.min(x.h, x.w) < 34)
  expect(list.length > 0 && !bad.length && !small.length, `${label}: ${list.length} glass controls receive their own clicks, none smaller than 34px${bad.length ? ` — blocked: ${bad.map((x) => x.name).join(', ')}` : ''}${small.length ? ` — small: ${small.map((x) => `${x.name} ${x.w}×${x.h}`).join(', ')}` : ''}`)
}

// ── the city: only the one button ──
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await p.goto(`${base}/street?debug&desktop`)
  await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
  await p.keyboard.press('Escape'); await sleep(4600)
  const btn = p.getByRole('link', { name: /Explore the Classic Portfolio/ })
  const box = await btn.boundingBox()
  const area = { x: box.x - 260, y: box.y - 110, width: box.width + 300, height: box.height + 150 }
  await p.screenshot({ path: 'qa-screens/glass-city-idle.png', clip: area })
  await btn.hover(); await sleep(500)
  await p.screenshot({ path: 'qa-screens/glass-city-hover.png', clip: area })
  const hit = await p.evaluate(() => { const a = document.querySelector('a.ui-intro__classic'); const r = a.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return a === h || a.contains(h) })
  const href = await btn.getAttribute('href')
  expect(hit && /\/mindspace$/.test(href) && box.height >= 44, `city: "Explore the Classic Portfolio" is pearl glass, clickable, ${Math.round(box.height)}px tall, still → ${href}`)
  await btn.click()
  await p.waitForURL(/\/mindspace$/, { timeout: 15000 })
  expect(true, 'city button still opens Mindspace')
  await p.context().close()
}

// ── Mindspace surfaces ──
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
await p.goto(`${base}/mindspace?intro=off&tod=afternoon`)
await p.waitForSelector('.ms.is-ready', { timeout: 30000 }); await sleep(2000)
report('room controls', await audit(p, SEL))
await p.getByRole('button', { name: 'Open About Me', exact: true }).click(); await p.waitForSelector('.ms-window'); await sleep(1100)
report('About window', await audit(p, SEL))
const primary = p.locator('.ms-btn--primary').first()
await shot(p, 'about-idle', p.locator('.ms-actions').first())
await primary.hover(); await sleep(450)
await shot(p, 'about-hover', p.locator('.ms-actions').first())
// the sweep runs once and settles
const angles = await p.evaluate(async () => { const el = document.querySelector('.ms-btn--primary'); const a = () => getComputedStyle(el, '::before').getPropertyValue('--lg-a'); const s = []; s.push(a()); await new Promise((r) => setTimeout(r, 1600)); s.push(a()); await new Promise((r) => setTimeout(r, 600)); s.push(a()); return s })
expect(angles[1] === angles[2], `hover sweep runs once and stops (rim angle ${angles.join(' → ')})`)
await p.mouse.move(5, 450); await sleep(300)
await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await sleep(250)
const focused = await p.evaluate(() => { const e = document.activeElement; return { cls: e.className, ring: getComputedStyle(e).boxShadow.includes('120, 150, 255') } })
await shot(p, 'about-focus', p.locator('.ms-actions').first())
expect(focused.ring, `keyboard focus shows the glass focus ring (${String(focused.cls).slice(0, 30)})`)
await p.keyboard.press('Escape'); await sleep(500)
// Joy Lab
await p.getByRole('button', { name: 'Open Joy Lab', exact: true }).click(); await p.waitForSelector('.ms-window'); await sleep(1300)
report('Joy Lab', await audit(p, SEL))
await shot(p, 'joylab')
await p.getByRole('button', { name: 'Play Pop the Chaos' }).click(); await sleep(700)
await p.getByRole('button', { name: /^Start/ }).click(); await sleep(1200)
report('in-game', await audit(p, SEL))
const canvasHit = await p.evaluate(() => { const c = document.querySelector('.jl-stage canvas'); const r = c.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === c })
expect(canvasHit, 'the game canvas is not covered by any glass layer')
await shot(p, 'game')
await p.keyboard.press('Escape'); await sleep(500)
// Music
await p.getByRole('button', { name: 'Open Music Lounge', exact: true }).click(); await p.waitForSelector('.ms-window'); await sleep(1300)
report('Music Lounge', await audit(p, SEL))
await shot(p, 'music')
await p.locator('.mu-bar__play').click(); await sleep(1500)
const playing = await p.evaluate(() => window.__music?.steps() > 0)
await p.getByRole('button', { name: /^Now playing:/ }).click(); await sleep(1200)
await shot(p, 'music-now')
expect(playing, 'music still plays from the glass play button')
await p.keyboard.press('Escape'); await sleep(600)
await shot(p, 'mini')
report('mini-player', await audit(p, SEL))
expect(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`)
await p.context().close()

// ── night and phone ──
{
  const q = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await q.goto(`${base}/mindspace?intro=off&tod=night`); await q.waitForSelector('.ms.is-ready'); await sleep(1800)
  await q.getByRole('button', { name: 'Open About Me', exact: true }).click(); await sleep(1300)
  await shot(q, 'night-about')
  await q.context().close()
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage()
  await m.goto(`${base}/mindspace?intro=off`); await m.waitForSelector('.ms.is-ready'); await sleep(1800)
  await m.getByRole('button', { name: 'Open Music Lounge', exact: true }).tap(); await sleep(1300)
  report('phone Music', await audit(m, SEL))
  await shot(m, 'phone-music')
  await m.locator('.ms-window__close').tap(); await sleep(500)
  await m.getByRole('button', { name: 'Open Joy Lab', exact: true }).tap(); await sleep(1300)
  report('phone Joy Lab', await audit(m, SEL))
  await shot(m, 'phone-joylab')
  await m.context().close()
}
// ── reduced motion: no lift, no sweep ──
{
  const r = await (await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })).newPage()
  await r.goto(`${base}/mindspace?intro=off`); await r.waitForSelector('.ms.is-ready'); await sleep(1500)
  await r.getByRole('button', { name: 'Open About Me', exact: true }).click(); await sleep(900)
  await r.locator('.ms-btn--primary').first().hover(); await sleep(300)
  const st = await r.evaluate(() => { const el = document.querySelector('.ms-btn--primary'); return { t: getComputedStyle(el).transform, anim: getComputedStyle(el, '::before').animationName } })
  expect((st.t === 'none') && st.anim === 'none', `reduced motion: no lift (${st.t}), no sweep (${st.anim})`)
  await r.context().close()
}
console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
await b.close()
