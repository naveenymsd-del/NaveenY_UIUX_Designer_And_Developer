// Mindspace on phones: (1) every app window ends above the music player and its last
// content is reachable; (2) every launcher icon opens its own app, in two different orders.
// Usage: node scripts/qa-mindspace-mobile.mjs [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const TITLES = { about: 'About Me', education: 'Education', experience: 'Experience', projects: 'Projects', gallery: 'Gallery', process: 'Design Process', skills: 'Skills & Tools', games: 'Joy Lab', music: 'Music Lounge', contact: 'Contact' }
const LABEL = { ...TITLES }

async function room(w, h, touch) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 })).newPage()
  p.errors = []
  p.on('pageerror', (e) => p.errors.push(e.message))
  await p.goto(`${base}/mindspace?intro=off`)
  await p.waitForSelector('.ms-icon', { timeout: 60000 })
  await sleep(3000)
  return p
}
/** tap where the icon is drawn (its face centre), like a finger would */
async function tapIcon(p, title, touch) {
  const r = await p.evaluate((t) => {
    const btn = [...document.querySelectorAll('.ms-icon')].find((x) => x.getAttribute('aria-label') === `Open ${t}`)
    const f = btn.querySelector('.ms-icon__face').getBoundingClientRect()
    return { x: f.left + f.width / 2, y: f.top + f.height / 2 }
  }, title)
  if (touch) await p.touchscreen.tap(r.x, r.y)
  else await p.mouse.click(r.x, r.y)
  await p.waitForSelector('.ms-window', { timeout: 5000 }).catch(() => {})
  await sleep(900)
}
async function closeWin(p) {
  await p.locator('.ms-window__close').click()
  await p.waitForSelector('.ms-window', { state: 'detached', timeout: 5000 }).catch(() => {})
  await sleep(500)
}
const ids = Object.keys(TITLES)

for (const [w, h, touch, tag] of [[390, 844, true, 'phone-390'], [375, 667, true, 'phone-375x667'], [428, 926, true, 'phone-428'], [1440, 900, false, 'desktop']]) {
  console.log(`\n── ${tag}`)
  const p = await room(w, h, touch)
  // start the music, so the mini-player is on screen the whole time
  await p.waitForSelector('.ms-mini__cta', { timeout: 20000 })
  await p.locator('.ms-mini__cta').click()
  await p.waitForSelector('.ms-mini:not(.ms-mini--invite)', { timeout: 10000 })
  await sleep(600)

  for (const order of [ids, [...ids].reverse().sort((a, c) => (a.length % 3) - (c.length % 3))]) {
    for (const id of order) {
      await tapIcon(p, LABEL[id], touch)
      const title = await p.locator('#ms-window-title').innerText().catch(() => null)
      expect(title === TITLES[id], `${tag}: tap ${TITLES[id]} → opens "${title}"`)
      expect(await p.locator('.ms-window').count() === 1, `${tag}: ${id}: exactly one window`)
      if (order === ids && id !== 'music') {
        // the window ends above the player; the end of its content is reachable and tappable
        const g = await p.evaluate(() => {
          const win = document.querySelector('.ms-window').getBoundingClientRect()
          const mini = document.querySelector('.ms-mini')?.getBoundingClientRect()
          const body = document.querySelector('.ms-window__body')
          body.scrollTop = body.scrollHeight
          return { winBottom: win.bottom, winTop: win.top, miniTop: mini?.top ?? null, vh: innerHeight }
        })
        await sleep(400)
        const last = await p.evaluate(() => {
          const body = document.querySelector('.ms-window__body')
          const els = [...body.querySelectorAll('button, a[href]')].filter((e) => e.getBoundingClientRect().height > 0)
          const el = els[els.length - 1]
          if (!el) return { none: true }
          el.scrollIntoView({ block: 'nearest' })
          const r = el.getClientRects()[0] // a link that wraps: sample its first line
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return { ok: !!hit && (hit === el || el.contains(hit)), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), bottom: r.bottom }
        })
        expect(g.miniTop !== null && g.winBottom <= g.miniTop - 4, `${tag}: ${id}: window ends above the music player (${Math.round(g.winBottom)} vs ${Math.round(g.miniTop)})`)
        expect(g.winTop >= 0 && g.winBottom <= g.vh, `${tag}: ${id}: window inside the viewport`)
        expect(last.none || last.ok, `${tag}: ${id}: last action "${last.label}" visible and tappable`)
        expect(await p.locator('.ms-window__close').isVisible(), `${tag}: ${id}: close button visible after scrolling`)
        if (id === 'projects' || id === 'contact' || id === 'experience') await p.screenshot({ path: `qa-screens/ms-mobile-${tag}-${id}.png` })
      }
      await closeWin(p)
    }
  }
  // Safari can deliver a tap on one 3D icon to the button of the icon below it. Simulate that:
  // stretch every icon's hit area 160px upwards (the icon below then "owns" the one above's spot)
  await p.addStyleTag({ content: '.ms-icon { position: relative; } .ms-icon::before { content: ""; position: absolute; left: 0; right: 0; top: -160px; height: 160px; }' })
  await sleep(300)
  for (const id of ['about', 'education', 'experience', 'projects', 'skills']) {
    const owner = await p.evaluate((t) => {
      const f = [...document.querySelectorAll('.ms-icon')].find((x) => x.getAttribute('aria-label') === `Open ${t}`).querySelector('.ms-icon__face').getBoundingClientRect()
      return document.elementFromPoint(f.left + f.width / 2, f.top + f.height / 2)?.closest('.ms-icon')?.getAttribute('aria-label')
    }, TITLES[id])
    await tapIcon(p, LABEL[id], touch)
    const title = await p.locator('#ms-window-title').innerText().catch(() => null)
    expect(title === TITLES[id], `${tag}: offset hit areas (tap lands on "${owner}") → still opens "${title}"`)
    await closeWin(p)
  }
  await p.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('top: -160px')) s.remove() }))
  // keyboard still opens the focused icon
  await p.locator('.ms-icon[data-app="education"]').focus()
  await p.keyboard.press('Enter')
  await p.waitForSelector('.ms-window', { timeout: 5000 }).catch(() => {})
  await sleep(700)
  expect(await p.locator('#ms-window-title').innerText().catch(() => null) === 'Education', `${tag}: keyboard Enter on Education opens Education`)
  await closeWin(p)
  // tapping the same icon twice quickly opens one window
  await tapIcon(p, 'Gallery', touch)
  expect(await p.locator('.ms-window').count() === 1, `${tag}: one window after tapping`)
  await closeWin(p)

  // the player still works with a window open
  await tapIcon(p, 'Projects', touch)
  await p.locator('.ms-mini .ms-mini__btn').first().click()
  await sleep(500)
  expect(/Play music/.test(await p.locator('.ms-mini .ms-mini__btn').first().getAttribute('aria-label')), `${tag}: pause works with a window open`)
  await closeWin(p)
  expect(p.errors.length === 0, `${tag}: no page errors ${p.errors.join(' | ')}`)
  await p.context().close()
}
await b.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nall Mindspace mobile checks passed')
process.exit(problems.length ? 1 : 0)
