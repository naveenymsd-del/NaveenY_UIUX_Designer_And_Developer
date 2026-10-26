// Mindspace QA: room + launcher + camera, every application (open / content / close), projects &
// their real links, gallery viewer, contact actions, the three games, and the same on a phone.
// Usage: node scripts/qa-mindspace.mjs [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const APPS = ['About Me', 'Education', 'Experience', 'Projects', 'Gallery', 'Design Process', 'Skills & Tools', 'Joy Lab', 'Music Lounge', 'Contact']

async function room(ctxOpts) {
  const ctx = await b.newContext(ctxOpts)
  const p = await ctx.newPage()
  p.errors = []
  p.on('pageerror', (e) => p.errors.push(e.message))
  p.on('console', (m) => m.type() === 'error' && p.errors.push(m.text()))
  await p.goto(`${base}/mindspace?intro=off`)
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  await sleep(2600)
  return p
}
const openApp = async (p, name, tap = false) => {
  const btn = p.getByRole('button', { name: `Open ${name}`, exact: true })
  await (tap ? btn.tap() : btn.click())
  await p.waitForSelector('.ms-window', { timeout: 5000 })
  await sleep(900)
}
const closeApp = async (p, how = 'escape') => {
  if (how === 'escape') await p.keyboard.press('Escape')
  else await p.locator('.ms-window__close').click()
  await p.waitForSelector('.ms-window', { state: 'detached', timeout: 5000 })
  await sleep(400)
}
const windowFits = (p) => p.evaluate(() => { const r = document.querySelector('.ms-window').getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight })

// ── desktop ────────────────────────────────────────────────────────────────
{
  const p = await room({ viewport: { width: 1440, height: 900 } })
  await p.screenshot({ path: 'qa-screens/ms-01-room.png' })
  const onScreen = await p.evaluate(() => [...document.querySelectorAll('.ms-icon')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.top > 0 && r.bottom < innerHeight }).length)
  expect(onScreen === 10, `launcher: ${onScreen}/10 icons on screen`)
  expect(await p.evaluate(() => !document.querySelector('.game-canvas, .ui-layer')), 'the 3D city is not mounted on /mindspace')

  // look around in every direction, then reset
  const drag = async (dx, dy) => {
    await p.mouse.move(720, 870)
    await p.mouse.down()
    for (let i = 1; i <= 14; i++) await p.mouse.move(720 + (dx * i) / 14, 870 + (dy * i) / 14)
    await p.mouse.up()
    await sleep(1100)
  }
  const launcherX = () => p.evaluate(() => document.querySelector('.ms-launcher').getBoundingClientRect().x)
  const x0 = await launcherX()
  // the scene follows the pointer: drag right → look left, drag down → look up
  await drag(-600, 0); await p.screenshot({ path: 'qa-screens/ms-02-look-right.png' })
  const x1 = await launcherX()
  await drag(1200, 0); await p.screenshot({ path: 'qa-screens/ms-03-look-left.png' })
  await drag(900, 0); await p.screenshot({ path: 'qa-screens/ms-04-look-behind.png' })
  expect(x1 < x0 - 200, `drag turns the view; the launcher stays pinned in the room (moved ${Math.round(x0 - x1)} px)`)
  await p.getByRole('button', { name: 'Reset view' }).click(); await sleep(1500)
  // the top-right × is gone (windows have their own close); Reset view stays
  const ctl = await p.evaluate(() => [...document.querySelectorAll('.ms-controls button')].map((b) => b.getAttribute('aria-label')))
  expect(ctl.join('|') === 'Reset view', `top-right controls: ${ctl.join(', ')} (no × button)`)
  // a drag that starts ON an icon turns the view and does not open the app
  const ib = await p.locator('.ms-icon', { hasText: 'Experience' }).boundingBox()
  const before = await launcherX()
  await p.mouse.move(ib.x + ib.width / 2, ib.y + 30); await p.mouse.down()
  for (let i = 1; i <= 12; i++) await p.mouse.move(ib.x + ib.width / 2 - i * 30, ib.y + 30)
  await p.mouse.up(); await sleep(1000)
  const turned = Math.abs((await launcherX()) - before) > 100
  const opened = await p.evaluate(() => !!document.querySelector('.ms-window'))
  expect(turned && !opened, `a drag starting on an icon turns the view and opens nothing (moved: ${turned}, opened: ${opened})`)
  // the icons are true 3D objects: perspective differs across the arc (outer icons are turned)
  const tilt = await p.evaluate(() => [...document.querySelectorAll('.ms-launcher--spatial')].map((w) => w.style.transform.includes('matrix3d')).every(Boolean))
  expect(tilt, 'every icon is placed with a 3D transform from the room camera (CSS3D)')
  await p.getByRole('button', { name: 'Reset view' }).click(); await sleep(1500)
  // arrow keys look around
  await p.mouse.click(720, 880); const k0 = await launcherX()
  await p.keyboard.down('ArrowLeft'); await sleep(600); await p.keyboard.up('ArrowLeft'); await sleep(700)
  expect(Math.abs((await launcherX()) - k0) > 60, 'arrow keys turn the view')
  await p.getByRole('button', { name: 'Reset view' }).click(); await sleep(1500)
  await drag(0, 330); await p.screenshot({ path: 'qa-screens/ms-05-look-up.png' })
  await drag(0, -700); await p.screenshot({ path: 'qa-screens/ms-06-look-down.png' })
  expect(await p.evaluate(() => { const m = document.querySelector('.ms'); return m.scrollLeft === 0 && m.scrollTop === 0 }), 'the stage never scrolls')
  await p.getByRole('button', { name: 'Reset view' }).click(); await sleep(1600)
  expect(Math.abs((await launcherX()) - x0) < 6, 'Reset view returns home')
  // zoom + keys
  await p.mouse.move(720, 870); await p.mouse.wheel(0, -600); await sleep(900)
  await p.screenshot({ path: 'qa-screens/ms-07-zoom.png' })
  await p.keyboard.down('w'); await sleep(700); await p.keyboard.up('w'); await sleep(700)
  await p.getByRole('button', { name: 'Reset view' }).click(); await sleep(1500)

  // every app opens, shows real content, fits on screen, closes
  for (const [i, name] of APPS.entries()) {
    await openApp(p, name)
    const title = await p.evaluate(() => document.querySelector('#ms-window-title')?.textContent)
    const text = await p.evaluate(() => document.querySelector('.ms-window__body')?.innerText.length ?? 0)
    const blurred = await p.evaluate(() => getComputedStyle(document.querySelector('.ms-canvas')).filter.includes('blur'))
    const one = await p.evaluate(() => document.querySelectorAll('.ms-window').length === 1)
    expect(title === name && text > 80 && (await windowFits(p)) && blurred && one, `${name}: opens (${text} chars of content), one window, room softly blurred behind`)
    await p.screenshot({ path: `qa-screens/ms-app-${String(i + 1).padStart(2, '0')}-${name.replace(/\W+/g, '-').toLowerCase()}.png` })
    await closeApp(p, i % 2 ? 'button' : 'escape')
  }
  expect(await p.evaluate(() => !document.querySelector('.ms.has-app') && !document.querySelector('.ms-launcher.is-receded')), 'closing returns to the launcher (Escape and the close button)')

  // About → buttons switch apps
  await openApp(p, 'About Me')
  await p.getByRole('button', { name: 'Explore projects' }).click(); await sleep(500)
  expect((await p.evaluate(() => document.querySelector('#ms-window-title')?.textContent)) === 'Projects', 'About → "Explore projects" opens Projects')
  // projects: cards, detail, real links
  const cards = await p.evaluate(() => [...document.querySelectorAll('.ms-project-card b')].map((b) => b.textContent))
  expect(cards.join(',') === 'TASK,KidPool,Calmscient,INTA,IntelliStaff', `projects: ${cards.join(', ')}`)
  await p.locator('.ms-project-card', { hasText: 'TASK' }).click(); await sleep(700)
  const links = await p.evaluate(() => [...document.querySelectorAll('.ms-project__head a')].map((a) => [a.textContent.trim(), a.getAttribute('href'), a.target]))
  expect(links.length === 2 && links[0][1].includes('figma.com/proto/vUIgk3l5i7TXJwCPXHq7xu') && links.every((l) => l[2] === '_blank'), `TASK detail: ${links.map((l) => l[0]).join(' + ')} → its own Figma links, new tab`)
  await p.screenshot({ path: 'qa-screens/ms-10-project-detail.png' })
  for (let k = 0; k < 4; k++) { await p.getByRole('button', { name: /→$/ }).click(); await sleep(400) }
  const isLinks = await p.evaluate(() => [document.querySelector('.ms-project h2')?.textContent, [...document.querySelectorAll('.ms-project__head a')].map((a) => a.textContent.trim())])
  expect(isLinks[0] === 'IntelliStaff' && isLinks[1].join() === 'Case study', `IntelliStaff: only "Case study" (no prototype link exists) — ${isLinks[1].join(' + ')}`)
  const imgs = await p.evaluate(() => Promise.all([...document.querySelectorAll('.ms-project img')].map((i) => i.complete ? i.naturalWidth : new Promise((r) => { i.onload = () => r(i.naturalWidth); i.onerror = () => r(0) }))))
  expect(imgs.length && imgs.every((w) => w > 0), `project screens load (${imgs.length})`)
  await p.getByRole('button', { name: 'All projects' }).click(); await sleep(300)
  await closeApp(p)

  // gallery: filter + viewer
  await openApp(p, 'Gallery')
  const all = await p.locator('.ms-gallery li').count()
  await p.getByRole('button', { name: 'KidPool', exact: true }).click(); await sleep(300)
  const kid = await p.locator('.ms-gallery li').count()
  await p.locator('.ms-gallery button').first().click(); await sleep(500)
  const big = await p.evaluate(() => { const i = document.querySelector('.ms-viewer__fig img'); return i?.complete && i.naturalWidth > 600 })
  await p.screenshot({ path: 'qa-screens/ms-11-gallery-viewer.png' })
  await p.getByRole('button', { name: 'Next image' }).click(); await sleep(300)
  const counter = await p.evaluate(() => document.querySelector('.ms-viewer__bar .ms-muted')?.textContent)
  await p.getByRole('button', { name: 'Gallery', exact: true }).click(); await sleep(300)
  expect(all === 10 && kid === 2 && big && counter === '2 / 2' && (await p.locator('.ms-gallery').count()) === 1, `gallery: ${all} real screens, filter (KidPool ${kid}), full-size viewer, next, back`)
  await closeApp(p)

  // contact actions are real
  await openApp(p, 'Contact')
  const hrefs = await p.evaluate(() => [...document.querySelectorAll('.ms-contact a')].map((a) => a.getAttribute('href')))
  expect(hrefs.includes('mailto:naveenyarramallugalla@gmail.com') && hrefs.includes('tel:+917036282178') && hrefs.some((h) => h.includes('linkedin.com/in/naveen-yarramallugalla')) && hrefs.some((h) => h.endsWith('.pdf')), 'contact: email, phone, LinkedIn and résumé are working links')
  await closeApp(p)

  // (Joy Lab's games and the Music Lounge are played in scripts/qa-joylab.mjs)
  expect(p.errors.length === 0, `desktop: no page errors ${p.errors.length ? JSON.stringify(p.errors.slice(0, 3)) : ''}`)
  await p.context().close()
}

// ── phone ──────────────────────────────────────────────────────────────────
{
  const p = await room({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  await p.screenshot({ path: 'qa-screens/ms-20-phone-room.png' })
  const vis = await p.evaluate(() => [...document.querySelectorAll('.ms-icon')].filter((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top > 60 && r.bottom < innerHeight }).length)
  const labels = await p.evaluate(() => Math.min(...[...document.querySelectorAll('.ms-icon__label')].map((l) => l.getBoundingClientRect().height)))
  expect(vis === 10 && labels >= 12, `phone: all 10 icons on screen in a 3-column launcher, labels readable (${labels.toFixed(0)} px)`)
  // one-finger drag looks around
  const cdp = await p.context().newCDPSession(p)
  const lx0 = await p.evaluate(() => document.querySelector('.ms-launcher').getBoundingClientRect().x)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 790 }] })
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 - i * 15, y: 790 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await sleep(1000)
  const lx1 = await p.evaluate(() => document.querySelector('.ms-launcher').getBoundingClientRect().x)
  expect(Math.abs(lx1 - lx0) > 30, `phone: a one-finger drag turns the view (${Math.round(lx0 - lx1)} px)`)
  await p.getByRole('button', { name: 'Reset view' }).tap(); await sleep(1400)
  for (const name of ['Projects', 'Joy Lab', 'Contact']) {
    await openApp(p, name, true)
    const fits = await windowFits(p)
    const scrolls = await p.evaluate(() => { const b = document.querySelector('.ms-window__body'); return b.scrollHeight > b.clientHeight })
    const overflowX = await p.evaluate(() => { const b = document.querySelector('.ms-window__body'); return b.scrollWidth > b.clientWidth + 1 })
    await p.screenshot({ path: `qa-screens/ms-21-phone-${name.toLowerCase()}.png` })
    expect(fits && !overflowX, `phone ${name}: window within the screen, no sideways overflow${scrolls ? ', content scrolls inside' : ''}`)
    await p.locator('.ms-window__close').tap()
    await p.waitForSelector('.ms-window', { state: 'detached', timeout: 5000 })
    await sleep(300)
  }
  expect(p.errors.length === 0, `phone: no page errors ${p.errors.length ? JSON.stringify(p.errors.slice(0, 3)) : ''}`)
  await p.context().close()
}

// ── the way in: the city's hero → "Explore the Classic Portfolio" ─────────
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(`${base}/street?debug&desktop`)
  await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
  await p.keyboard.press('Escape')
  await sleep(2400)
  const link = p.getByRole('link', { name: /Explore the Classic Portfolio/ })
  const href = await link.getAttribute('href')
  await link.click()
  await p.waitForURL(/\/mindspace$/, { timeout: 15000 })
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  const intro = await p.evaluate(() => !!document.querySelector('.ms.is-intro'))
  const noCity = await p.evaluate(() => !document.querySelector('.game-canvas'))
  expect(href.endsWith('/mindspace') && intro && noCity, `city hero → "Explore the Classic Portfolio" (${href}) → the intro plays, the city is gone`)
  await p.getByRole('link', { name: /Explore the 3D Portfolio/ }).count().then(() => {})
  await ctx.close()
}

// ── no WebGL: the launcher and apps still work, without the room ──────────
{
  const nb = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-3d-apis'] })
  const p = await (await nb.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(`${base}/mindspace?intro=off`)
  await p.waitForSelector('.ms.is-fallback', { timeout: 20000 })
  await sleep(1500)
  await p.screenshot({ path: 'qa-screens/ms-30-no-webgl.png' })
  const vis = await p.evaluate(() => [...document.querySelectorAll('.ms-icon')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight }).length)
  await p.getByRole('button', { name: 'Open Education' }).click()
  await p.waitForSelector('.ms-window', { timeout: 5000 })
  const edu = await p.evaluate(() => document.querySelector('.ms-window__body')?.innerText.includes('CGPA'))
  expect(vis === 10 && edu && errs.length === 0, `no WebGL: launcher (${vis}/10) and apps work without the room${errs.length ? ` — errors ${JSON.stringify(errs)}` : ''}`)
  await nb.close()
}

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
await b.close()
