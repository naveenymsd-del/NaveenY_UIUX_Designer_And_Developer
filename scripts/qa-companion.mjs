// AI Companion QA: the robot (launcher, panel, phone orb), its expressions, the compact panel
// (no empty space, scrolling log, composer always reachable), chips, voice consent, keeping the
// conversation, Escape, an unknown question, a walk — desktop, tablet, phone portrait + landscape.
// Usage: node scripts/qa-companion.mjs [baseUrl]    (screens → qa-screens/ac-*.png)
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }, sel)
const overlap = (a, c) => a && c && a.x < c.r - 1 && c.x < a.r - 1 && a.y < c.b - 1 && c.y < a.b - 1
const onTop = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (hit === el || el.contains(hit)) }, sel)
const expr = (p, sel) => p.evaluate((s) => document.querySelector(s)?.getAttribute('data-expr') ?? null, sel)

async function world(w, h, touch) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })).newPage()
  p.errors = []
  p.on('pageerror', (e) => p.errors.push(e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) p.errors.push(m.text().slice(0, 140)) })
  await p.goto(`${base}/street?debug&mode=day${touch ? '' : '&desktop'}`)
  await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
  await p.keyboard.press('Escape')
  await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
  await sleep(1400)
  await p.getByRole('button', { name: /^Start exploring/i }).click()
  await p.waitForFunction(() => document.querySelector('.app.phase-playing'), null, { timeout: 30000 })
  await sleep(3000)
  await p.getByRole('button', { name: 'Close tips' }).click({ timeout: 2000 }).catch(() => {})
  return p
}

// ── desktop ───────────────────────────────────────────────────────────────
for (const [w, h, tag] of [[1440, 900, 'desk-1440'], [1366, 768, 'desk-1366']]) {
  console.log(`\n── ${tag}`)
  const p = await world(w, h, false)
  // the launcher: the robot, "AI Guide", "Chat or voice"; clear of the map, the next stop and the controls
  const L = await box(p, '.ag-launcher')
  expect(!!L && L.r <= w && L.b <= h && L.x > w / 2, `${tag}: launcher bottom-right, inside the viewport`)
  expect(await p.locator('.ag-launcher .ui-robot').count() === 1 && /AI Guide/.test(await p.locator('.ag-launcher').innerText()) && /Chat or voice/.test(await p.locator('.ag-launcher').innerText()), `${tag}: launcher shows the robot, "AI Guide", "Chat or voice"`)
  for (const sel of ['.ui-minimap', '.ui-hint', '.ui-journey-chip.is-visible']) expect(!overlap(L, await box(p, sel)), `${tag}: launcher clear of ${sel}`)
  await p.screenshot({ path: `qa-screens/ac-${tag}-city.png` })

  // open: a welcome face, the new header, one status
  await p.locator('.ag-launcher').click()
  await sleep(250)
  expect(await expr(p, '#ag-panel .ag-head .ui-robot') === 'welcome', `${tag}: opening → welcome expression`)
  expect(/Naveen.s AI Companion/.test(await p.locator('#ag-panel h2').innerText()), `${tag}: header "Naveen's AI Companion"`)
  expect(await p.locator('#ag-panel [role=status]').count() === 1, `${tag}: one status line`)
  await sleep(2400)
  expect(await expr(p, '#ag-panel .ag-head .ui-robot') !== 'welcome', `${tag}: …and it settles (${await expr(p, '#ag-panel .ag-head .ui-robot')})`)
  // compact: the panel is as tall as its content, no empty band above the suggestions
  let P = await box(p, '#ag-panel')
  const gap = await p.evaluate(() => { const log = document.querySelector('#ag-panel .ag-body'); const q = document.querySelector('#ag-panel .ag-quick'); return q.getBoundingClientRect().top - log.getBoundingClientRect().bottom })
  expect(P.h < h * 0.62 && gap < 30, `${tag}: a short conversation is a short panel (${Math.round(P.h)}px, gap ${Math.round(gap)}px)`)
  expect(await p.locator('#ag-panel .ag-quick button').count() === 5, `${tag}: five suggestions`)
  const tops = await p.evaluate(() => [...new Set([...document.querySelectorAll('#ag-panel .ag-quick button')].map((x) => Math.round(x.getBoundingClientRect().top)))].length)
  expect(tops === 1, `${tag}: suggestions on one row`)
  expect(await p.locator('#ag-panel .ag-compose .ag-mic').count() === 1 && await p.locator('#ag-panel .ag-compose .ag-send').count() === 1, `${tag}: composer with microphone and send`)
  await p.screenshot({ path: `qa-screens/ac-${tag}-open.png` })

  // a suggestion is a real request: the guide answers, and explains
  await p.locator('#ag-panel .ag-quick button', { hasText: 'Tell me about Naveen' }).click()
  await sleep(500)
  expect(await p.locator('#ag-panel .ui-voice__log li.is-guide').count() >= 2, `${tag}: a suggestion is answered`)
  expect(await expr(p, '#ag-panel .ag-head .ui-robot') === 'explaining', `${tag}: answering → explaining`)
  // an unanswerable question → a friendly, questioning face
  await p.locator('#ag-panel .ag-form input').fill('What is the airspeed velocity of an unladen swallow?')
  await p.keyboard.press('Enter')
  await sleep(400)
  expect(await expr(p, '#ag-panel .ag-head .ui-robot') === 'confused', `${tag}: unknown question → confused`)
  // a long conversation: the panel stays inside the screen, the log scrolls, the composer stays reachable
  for (const q of ['What tools does Naveen use?', 'Where did Naveen study?', 'What is Naveen\'s experience?', 'Tell me about TASK', 'Tell me about KidPool', 'How can I contact Naveen?']) {
    await p.locator('#ag-panel .ag-form input').fill(q)
    await p.keyboard.press('Enter')
    await sleep(250)
  }
  await sleep(600)
  P = await box(p, '#ag-panel')
  const scroll = await p.evaluate(() => { const l = document.querySelector('#ag-panel .ui-voice__log'); return { sh: l.scrollHeight, ch: l.clientHeight, top: l.scrollTop } })
  expect(P.y >= 0 && P.b <= h, `${tag}: long conversation: panel inside the viewport (${Math.round(P.y)}–${Math.round(P.b)})`)
  expect(scroll.sh > scroll.ch && scroll.top > 0, `${tag}: the log scrolls on its own (to the newest)`)
  expect(await onTop(p, '#ag-panel .ag-form input') && await onTop(p, '#ag-panel .ag-send'), `${tag}: composer and send button reachable`)
  await p.screenshot({ path: `qa-screens/ac-${tag}-long.png` })

  // every expression renders (panel + launcher follow the same controller)
  for (const e of ['listening', 'thinking', 'explaining', 'speaking', 'navigating', 'success', 'confused', 'error', 'welcome']) {
    await p.evaluate((k) => window.__react(k, 1600, { force: true }), e)
    await sleep(120)
    // read both in one go (the panel and the launcher share one controller)
    const [a, l] = await p.evaluate(() => ['#ag-panel .ag-head .ui-robot', '.ag-launcher .ui-robot'].map((s) => document.querySelector(s)?.getAttribute('data-expr')))
    expect(a === e && l === e, `${tag}: expression ${e} (panel ${a}, launcher ${l})`)
    if (tag === 'desk-1440') await p.locator('#ag-panel .ag-head').screenshot({ path: `qa-screens/ac-face-${e}.png` })
  }
  await sleep(1800)

  // close keeps the conversation; Escape closes; the city carries on
  const n = await p.locator('#ag-panel .ui-voice__log li').count()
  await p.locator('#ag-panel .ag-close').click()
  await sleep(400)
  expect(await p.locator('#ag-panel').count() === 0 && await p.locator('.ag-launcher').isVisible(), `${tag}: close → the launcher stays`)
  await p.locator('.ag-launcher').click()
  await sleep(400)
  expect(await p.locator('#ag-panel .ui-voice__log li').count() === n, `${tag}: reopening keeps the conversation (${n})`)
  await p.locator('#ag-panel .ag-form input').focus()
  await p.keyboard.press('Escape')
  await sleep(400)
  expect(await p.locator('#ag-panel').count() === 0 && await p.evaluate(() => !!document.querySelector('.app.phase-playing')), `${tag}: Escape closes the panel (still in the city)`)

  // voice asks first (no microphone until the visitor agrees); chat is always one tap away
  await p.locator('.ag-launcher').click()
  await sleep(300)
  await p.locator('#ag-panel .ag-compose .ag-mic').click()
  await sleep(300)
  expect(await p.locator('#ag-panel .ag-consent').isVisible() && await p.evaluate(() => !window.__rec?.running), `${tag}: Voice → explanation first, microphone not started`)
  await p.screenshot({ path: `qa-screens/ac-${tag}-voice-consent.png` })
  await p.getByRole('button', { name: 'Not now' }).click()
  await sleep(200)
  expect(await p.locator('#ag-panel .ag-status').count() === 0 && await p.locator('#ag-panel .ag-form input').isVisible(), `${tag}: "Not now" → still chat`)

  // a walk: navigating, then a celebration only when it actually arrives
  await p.locator('#ag-panel .ag-form input').fill('Take me to Projects')
  await p.keyboard.press('Enter')
  const nav = await p.waitForFunction(() => document.querySelector('.ag-launcher .ui-robot')?.getAttribute('data-expr') === 'navigating', null, { timeout: 8000 }).then(() => true, () => false)
  expect(nav, `${tag}: a walk → navigating`)
  if (tag === 'desk-1440') {
    const arrived = await p.waitForFunction(() => document.querySelector('.ag-launcher .ui-robot, #ag-panel .ui-robot')?.getAttribute('data-expr') === 'success', null, { timeout: 90000 }).then(() => true, () => false)
    expect(arrived, `${tag}: arrival → success`)
  }
  expect(p.errors.length === 0, `${tag}: no console errors ${p.errors.join(' | ')}`)
  await p.context().close()
}

// ── touch: phone portrait / landscape, tablet ─────────────────────────────
for (const [w, h, tag] of [[390, 844, 'phone'], [844, 390, 'phone-landscape'], [820, 1180, 'tablet']]) {
  console.log(`\n── ${tag}`)
  const p = await world(w, h, true)
  const fab = await box(p, '.ui-voice__fab')
  expect(!!fab && fab.r <= w && fab.b <= h && await p.locator('.ui-voice__fab .ui-robot').count() === 1, `${tag}: the robot orb is on screen`)
  expect(!overlap(fab, await box(p, '.ui-joystick')), `${tag}: orb clear of the joystick`)
  await p.locator('.ui-voice__fab').tap()
  await sleep(600)
  const S = await box(p, '.ui-voice__sheet')
  expect(!!S && S.y >= 0 && S.b <= h + 1 && S.r <= w + 1, `${tag}: the sheet fits the screen`)
  expect(/Naveen.s AI Companion/i.test(await p.locator('.ui-voice__sheet').innerText()), `${tag}: sheet header`)
  expect(await onTop(p, '.ui-voice.is-open input'), `${tag}: the composer is reachable`)
  expect(await p.evaluate((vw) => document.documentElement.scrollWidth <= vw, w), `${tag}: no horizontal overflow`)
  await p.screenshot({ path: `qa-screens/ac-${tag}.png` })
  expect(p.errors.length === 0, `${tag}: no console errors ${p.errors.join(' | ')}`)
  await p.context().close()
}

await b.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nall AI companion checks passed')
process.exit(problems.length ? 1 : 0)
