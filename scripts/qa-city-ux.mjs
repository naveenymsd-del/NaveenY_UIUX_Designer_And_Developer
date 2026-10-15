// City UX QA: onboarding (first visit, remembered, reopenable), hero hierarchy, one AI Guide (every
// entry point opens the same panel), panel layout (composer never covered, inside the viewport),
// HUD separation (launcher / minimap / next stop / joystick never overlap), at several sizes.
// Usage: node scripts/qa-city-ux.mjs [baseUrl]    (screens → qa-screens/ux-*.png)
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const only = process.argv[3] // optional: 'baseline' just takes screenshots
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }

async function city(w, h, touch, query = 'debug&mode=day') {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })).newPage()
  p.errors = []
  p.on('pageerror', (e) => p.errors.push(e.message))
  await p.goto(`${base}/street?${query}${touch ? '' : '&desktop'}`)
  return p
}
async function toHero(p) {
  await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
  await p.keyboard.press('Escape')
  await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
  await sleep(1600)
}
async function toWorld(p) {
  await p.getByRole('button', { name: /^Start exploring/i }).click()
  await p.waitForFunction(() => document.querySelector('.app.phase-playing'), null, { timeout: 30000 })
  await sleep(3500)
}

if (only === 'baseline') {
  for (const [w, h, t] of [[1440, 900, false], [1366, 768, false], [390, 844, true]]) {
    const p = await city(w, h, t)
    await toHero(p)
    await p.screenshot({ path: `qa-screens/ux-before-hero-${w}.png` })
    await toWorld(p)
    await p.screenshot({ path: `qa-screens/ux-before-world-${w}.png` })
    await p.context().close()
  }
  await b.close()
  process.exit(0)
}

const box = (p, sel) => p.evaluate((s) => {
  const el = [...document.querySelectorAll(s)].find((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 })
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, r: r.right, b: r.bottom }
}, sel)
const overlap = (a, c) => a && c && a.x < c.r - 1 && c.x < a.r - 1 && a.y < c.b - 1 && c.y < a.b - 1
const inView = (a, w, h) => !!a && a.x >= 0 && a.y >= 0 && a.r <= w + 0.5 && a.b <= h + 0.5
/** nothing sits on top of the centre of `sel` */
const onTop = (p, sel) => p.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return false
  const r = el.getBoundingClientRect()
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return !!hit && (hit === el || el.contains(hit))
}, sel)
const minTarget = (p, sel) => p.evaluate((s) => Math.min(...[...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) })), sel)
const NO_DUPES = /Talk to me|Guide me\b/

const SIZES = [[1440, 900, false, 'desk-1440'], [1366, 768, false, 'desk-1366'], [820, 1180, true, 'tablet'], [390, 844, true, 'phone']]

for (const [w, h, touch, tag] of SIZES) {
  console.log(`\n── ${tag} (${w}×${h}${touch ? ', touch' : ''})`)

  // ── welcome: the city preview, before the cinematic intro ──
  {
    const p = await city(w, h, touch, 'mode=day')
    await p.waitForSelector('.wl', { timeout: 30000 })
    expect(/Welcome to Naveen.s World/.test(await p.locator('.wl h1').innerText()), `${tag}: welcome headline`)
    expect(/Explore the city behind my design journey/.test(await p.locator('#wl-lead').innerText()), `${tag}: welcome message`)
    expect(await p.locator(".wl-head .ui-classic-link").isVisible(), `${tag}: Explore the Classic Portfolio on the welcome screen`)
    expect(await p.locator('.wl-marker').count() === 7 && await p.locator('.wl-dests button').count() === 7, `${tag}: 7 destinations (markers + list)`)
    expect(await p.evaluate(() => !document.querySelector('.app.phase-intro')), `${tag}: intro waits behind the welcome`)
    await p.waitForSelector('.wl-enter:not([disabled])', { timeout: 90000 })
    await sleep(2500)
    await p.screenshot({ path: `qa-screens/ux-welcome-${tag}.png` })
    // one real scene, one camera: the preview is the city itself
    expect(await p.evaluate(() => document.querySelectorAll('canvas').length) === 1, `${tag}: one canvas (no second scene)`)
    const onMap = await p.evaluate(() => document.querySelectorAll('.wl-marker:not(.is-out)').length)
    expect(onMap === 7, `${tag}: all 7 markers on the city preview (${onMap})`)
    expect(await p.evaluate((vw) => document.documentElement.scrollWidth <= vw, w), `${tag}: no horizontal overflow`)
    expect(await onTop(p, '.wl-enter'), `${tag}: "Enter the City" visible and not covered`)
    // every destination in the list selects itself (marker + details agree)
    for (const name of ['Home', 'Education', 'NFC Solutions', 'Projects', 'Design Journey', 'Contact Café', 'Start']) {
      await p.locator('.wl-dests button', { hasText: name }).click()
      await sleep(250)
      const r = await p.evaluate(() => ({ title: document.querySelector('#wl-dest-name')?.textContent, marker: document.querySelector('.wl-marker.is-selected .wl-marker__label')?.textContent }))
      expect(r.title === name && r.marker === name, `${tag}: choose ${name} → details "${r.title}", marker "${r.marker}"`)
    }
    // a marker on the map selects too — and nothing moves (still the welcome, not the city)
    const edu = await box(p, '.wl-marker--education .wl-marker__pin')
    if (touch) await p.touchscreen.tap((edu.x + edu.r) / 2, (edu.y + edu.b) / 2)
    else await p.mouse.click((edu.x + edu.r) / 2, (edu.y + edu.b) / 2)
    await sleep(300)
    expect(await p.locator('#wl-dest-name').innerText() === 'Education' && await p.evaluate(() => !!document.querySelector('.app.phase-loading')), `${tag}: tapping the Education marker selects it; the world doesn't start`)
    expect(/Academic history/.test(await p.locator('.wl-dest__about').innerText()), `${tag}: Education description from the portfolio`)
    // the real AI Guide answers here
    await p.locator('.wl-ai__prompts button', { hasText: 'What design tools does he use?' }).click()
    const tools = await p.waitForFunction(() => [...document.querySelectorAll('.wl-ai__log li.is-guide')].some((l) => /Figma/.test(l.textContent)), null, { timeout: 10000 }).then(() => true, () => false)
    expect(tools, `${tag}: AI Guide answers a question on the welcome screen`)

    if (tag === 'desk-1440' || tag === 'phone') {
      // a trip asked for now is carried out after entering
      await p.locator('.wl-ai__compose input').fill('Take me to Projects')
      await p.keyboard.press('Enter')
      const later = await p.waitForFunction(() => [...document.querySelectorAll('.wl-ai__log li.is-guide')].some((l) => /as soon as you enter the city/.test(l.textContent)), null, { timeout: 10000 }).then(() => true, () => false)
      expect(later, `${tag}: "Take me to Projects" → "as soon as you enter the city"`)
      expect(await p.evaluate(() => !!document.querySelector('.app.phase-loading')), `${tag}: …and nothing moves yet`)
      await p.locator('.wl-never input').check()
      await p.locator('.wl-enter').click()
      const ok = await p.waitForFunction(() => !document.querySelector('.wl') && document.querySelector('.app.phase-intro'), null, { timeout: 10000 }).then(() => true, () => false)
      expect(ok, `${tag}: Enter the City → cinematic intro starts`)
      expect(await p.evaluate(() => localStorage.getItem('naveen-city:onboarding')) === 'off', `${tag}: "don't show again" remembered`)
      await p.getByRole('button', { name: 'Skip intro' }).click({ timeout: 30000 })
      await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
      await sleep(1500)
      await p.getByRole('button', { name: /^Start exploring/i }).click()
      await p.waitForFunction(() => document.querySelector('.app.phase-playing'), null, { timeout: 30000 })
      const went = await p.waitForFunction(() => /is-navigating/.test((document.querySelector('.ag-launch, .ui-voice')?.className ?? '')), null, { timeout: 15000 }).then(() => true, () => false)
      expect(went, `${tag}: in the city, the guide sets off for Projects`)
      await p.evaluate(() => sessionStorage.clear())
      await p.reload()
      await sleep(5000)
      expect(await p.locator('.wl').count() === 0, `${tag}: opted out → not shown on the next visit`)
    } else if (tag === 'desk-1366') {
      // "Explore this destination": straight into the city, and there
      await p.locator('.wl-dests button', { hasText: 'Contact Café' }).click()
      await p.locator('.wl-dest__go').click()
      const ok = await p.waitForFunction(() => document.querySelector('.app.phase-playing'), null, { timeout: 30000 }).then(() => true, () => false)
      expect(ok, `${tag}: Explore this destination → straight into the city`)
      const went = await p.waitForFunction(() => /is-navigating/.test((document.querySelector('.ag-launch, .ui-voice')?.className ?? '')), null, { timeout: 15000 }).then(() => true, () => false)
      expect(went, `${tag}: …and the guide walks to the Contact Café`)
      await p.evaluate(() => sessionStorage.clear())
      await p.reload()
      const again = await p.waitForSelector('.wl', { timeout: 30000 }).then(() => true, () => false)
      expect(again, `${tag}: not opted out → shown again on a new visit`)
    } else {
      await p.locator('.wl-free').click()
      const ok = await p.waitForFunction(() => document.querySelector('.app.phase-playing'), null, { timeout: 30000 }).then(() => true, () => false)
      expect(ok, `${tag}: Explore Without the Guide → straight into the city`)
      await sleep(3000)
      expect(!/is-navigating/.test(await p.evaluate(() => document.querySelector('.ag-launch, .ui-voice')?.className ?? '')), `${tag}: …nobody walks you anywhere`)
      // the AI Guide is still there (not disabled)
      if (touch) await p.locator('.ui-voice__fab').tap()
      else await p.locator('.ag-launcher').click()
      await sleep(600)
      expect(await p.locator('input[aria-label="Message the AI guide"]').count() > 0, `${tag}: …and the AI Guide still opens`)
    }
    expect(p.errors.length === 0, `${tag}: no page errors (welcome) ${p.errors.join(' | ')}`)
    await p.context().close()
  }

  // ── hero ──
  const p = await city(w, h, touch)
  await toHero(p)
  await p.screenshot({ path: `qa-screens/ux-hero-${tag}.png` })
  for (const [name, role] of [['Start exploring', 'button'], ['Explore the map', 'button'], ['Ask AI Guide', 'button'], ['Explore the Classic Portfolio', 'link']]) {
    expect(await p.getByRole(role, { name: new RegExp('^' + name, 'i') }).count() === 1, `${tag}: hero has "${name}"`)
  }
  expect(!NO_DUPES.test(await p.locator('.ui-intro').innerText()), `${tag}: no "Talk to me" / "Guide me" in the hero`)
  expect(await minTarget(p, '.ui-intro__actions .ui-btn, .ui-intro__links > *') >= 44, `${tag}: hero targets ≥ 44px`)

  // ── Ask AI Guide → the panel ──
  await p.getByRole('button', { name: /^Ask AI Guide/i }).click()
  await p.waitForFunction(() => document.querySelector('.app.phase-playing'), null, { timeout: 30000 })
  await sleep(2500)
  const PANEL = touch ? '.ui-voice.is-open .ui-voice__sheet' : '#ag-panel'
  const INPUT = touch ? '.ui-voice.is-open input' : '#ag-panel .ag-form input'
  expect(await p.locator(PANEL).count() === 1, `${tag}: Ask AI Guide opens the AI panel`)
  await p.screenshot({ path: `qa-screens/ux-panel-${tag}.png` })
  expect(inView(await box(p, PANEL), w, h), `${tag}: panel inside the viewport`)
  expect(await onTop(p, INPUT), `${tag}: composer not covered`)
  expect(!(await box(p, '.ui-where')), `${tag}: "Start · Welcome" pill hidden at the start`)
  if (!touch) {
    expect(/Naveen.s AI Companion/.test(await p.locator("#ag-panel h2").innerText()), `${tag}: panel header`)
    expect(await p.locator('#ag-panel .ag-mode [role=radio]').count() === 2, `${tag}: Chat / Voice modes`)
    expect(await p.locator('#ag-panel .ag-quick button').count() >= 5, `${tag}: quick actions`)
    expect(await minTarget(p, '#ag-panel .ag-close, #ag-panel .ag-mic, #ag-panel .ag-send, #ag-panel .ag-mode button') >= 40, `${tag}: panel controls large enough`)
    await p.locator(INPUT).fill('What tools does Naveen use?')
    await p.keyboard.press('Enter')
    await p.waitForFunction(() => document.querySelectorAll('#ag-panel .ui-voice__log li.is-guide').length > 0, null, { timeout: 20000 }).catch(() => {})
    expect(await p.locator('#ag-panel .ui-voice__log li.is-guide').count() > 0, `${tag}: the guide answers in the panel`)
    await p.screenshot({ path: `qa-screens/ux-answer-${tag}.png` })
    await p.locator('#ag-panel .ag-close').click()
    await sleep(500)
    expect(await p.locator('#ag-panel').count() === 0, `${tag}: close button closes the panel`)
    await p.locator('.ag-launcher').click()
    await sleep(500)
    expect(await p.locator('#ag-panel .ui-voice__log li.is-guide').count() > 0, `${tag}: launcher reopens the same conversation`)
    await p.locator('#ag-panel .ag-close').click()
    await sleep(1500)
    const L = { launch: await box(p, '.ag-launcher'), hint: await box(p, '.ui-hint'), map: await box(p, '.ui-minimap'), chip: await box(p, '.ui-journey-chip.is-visible') }
    expect(inView(L.launch, w, h) && L.launch.r > w * 2 / 3, `${tag}: AI Guide launcher visible bottom-right (under its panel)`)
    expect(!!L.map && L.map.x < w / 3 && !!L.chip && L.chip.x < w / 3, `${tag}: minimap and next-stop card on the left`)
    expect(!!L.chip, `${tag}: next-stop card visible`)
    for (const [a, c] of [['launch', 'hint'], ['launch', 'map'], ['launch', 'chip'], ['chip', 'map'], ['chip', 'hint']]) expect(!overlap(L[a], L[c]), `${tag}: ${a} ↔ ${c} don't overlap`)
    expect(/Take me there/.test(await p.locator('.ui-journey-chip__go').innerText()), `${tag}: next-stop action is "Take me there"`)
    expect(!NO_DUPES.test(await p.locator('.ui-layer').innerText()), `${tag}: no duplicate "Talk to me" / "Guide me" in the HUD`)
    expect(await p.locator('.ui-guide').count() === 0, `${tag}: the old guide panel is gone`)
    await p.screenshot({ path: `qa-screens/ux-world-${tag}.png` })
    expect(await p.locator('.ui-top .ui-classic-link').isVisible() && await onTop(p, '.ui-top .ui-classic-link'), `${tag}: Explore the Classic Portfolio in the header while exploring`)
    await p.locator('.ui-menu-btn').click()
    await sleep(800)
    const card = await box(p, '.ui-menu.is-open .ui-classic-card')
    expect(!!card && card.r - card.x > 260 && /Explore the Classic Portfolio/.test(await p.locator('.ui-classic-card').innerText()), `${tag}: menu features the Classic Portfolio as a card`)
    await p.screenshot({ path: `qa-screens/ux-menu-${tag}.png` })
    await p.locator('.ui-explore__more button', { hasText: 'How it works' }).click()
    const re = await p.waitForSelector('.wl', { timeout: 5000 }).then(() => true, () => false)
    expect(re && /Back to the City/.test(await p.locator('.wl-enter').innerText()), `${tag}: How it works reopens the introduction`)
    await sleep(2200)
    const seen = await p.evaluate(() => document.querySelectorAll('.wl-marker:not(.is-out)').length)
    expect(seen === 7, `${tag}: reopened in the city: the overview shows all 7 markers (${seen})`)
    await p.screenshot({ path: `qa-screens/ux-welcome-again-${tag}.png` })
    await p.keyboard.press('Escape')
    await sleep(500)
    expect(await p.locator('.wl').count() === 0 && await p.evaluate(() => !!document.querySelector('.app.phase-playing')), `${tag}: Esc closes it; back in the city`)
    await sleep(1800)
    await p.locator('.ui-menu-btn').click()
    await sleep(800)
    await p.locator('.ui-menu__section .ui-btn--primary', { hasText: 'Guide me through everything' }).click()
    await sleep(1500)
    expect(await p.locator('#ag-panel').count() === 1, `${tag}: menu tour opens the same AI panel`)
  } else {
    await p.locator('.ui-voice.is-open .ui-voice__sheet [aria-label="Collapse the AI guide"]').click()
    await sleep(1000)
    const L = { fab: await box(p, '.ui-voice__fab'), joy: await box(p, '.ui-joystick'), map: await box(p, '.ui-minimap'), chip: await box(p, '.ui-journey-chip.is-visible'), tips: await box(p, '.ui-tips.is-visible'), top: await box(p, '.ui-top__right') }
    expect(!!L.fab, `${tag}: AI orb visible`)
    for (const [a, c] of [['fab', 'joy'], ['fab', 'map'], ['chip', 'tips'], ['chip', 'top'], ['chip', 'map'], ['joy', 'map']]) expect(!overlap(L[a], L[c]), `${tag}: ${a} ↔ ${c} don't overlap`)
    expect(await minTarget(p, '.ui-voice__fab') >= 44, `${tag}: AI orb ≥ 44px`)
    expect(await p.locator(".ui-top .ui-classic-link").isVisible() && await onTop(p, ".ui-top .ui-classic-link"), `${tag}: Classic Portfolio in the header (phone/tablet)`)
    const hdr = await p.evaluate(() => { const r = [...document.querySelectorAll(".ui-top__left > *, .ui-top__right > *")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect()); return r.every((a, i) => r.every((c, j) => i === j || a.right <= c.left + 1 || c.right <= a.left + 1 || a.bottom <= c.top + 1 || c.bottom <= a.top + 1)) && r.every((a) => a.right <= innerWidth + 0.5) })
    expect(hdr, `${tag}: header items fit without overlapping`)
    await p.screenshot({ path: `qa-screens/ux-world-${tag}.png` })
  }
  expect(p.errors.length === 0, `${tag}: no page errors ${p.errors.join(' | ')}`)
  await p.context().close()
}

await b.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nall city UX checks passed')
process.exit(problems.length ? 1 : 0)
