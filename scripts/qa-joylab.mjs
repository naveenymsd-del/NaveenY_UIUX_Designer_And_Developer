// Joy Lab + Music Lounge QA (dev server): every game is actually played (score goes up, pause,
// restart, results, best score saved), the music engine really schedules sound, playback survives
// switching apps, controls work, external links are honest, and layouts hold on phone / tablet.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }

async function room(opts) {
  const p = await (await b.newContext(opts)).newPage()
  p.errors = []
  p.on('pageerror', (e) => p.errors.push(e.message))
  p.on('console', (m) => m.type() === 'error' && p.errors.push(m.text()))
  await p.goto(`${base}/mindspace?intro=off`)
  await p.waitForSelector('.ms.is-ready', { timeout: 30000 })
  await sleep(1800)
  return p
}
const openApp = async (p, name) => { await p.getByRole('button', { name: `Open ${name}` }).click(); await p.waitForSelector('.ms-window'); await sleep(800) }
const hudScore = (p) => p.evaluate(() => Number(document.querySelector('[data-score]')?.textContent ?? -1))
const st = (p, fn) => p.evaluate(fn)

const p = await room({ viewport: { width: 1440, height: 900 } })
const labels = await p.evaluate(() => [...document.querySelectorAll('.ms-icon__label')].map((l) => l.textContent))
expect(labels.includes('Joy Lab') && labels.includes('Music') && !labels.includes('Games') && labels.length === 10, `launcher: ${labels.length} apps incl. Joy Lab and Music`)

// ── JOY LAB home ──
await openApp(p, 'Joy Lab')
const cards = await p.evaluate(() => [...document.querySelectorAll('.jl-card h3')].map((h) => h.textContent))
const old = await p.evaluate(() => /Memory Match|Maze|Reaction/.test(document.querySelector('.ms-window').innerText))
expect(cards.join('|') === 'Emoji Panic|Wobble Tower|Pop the Chaos' && !old, `Joy Lab: ${cards.join(', ')} (old games gone)`)
await p.screenshot({ path: 'qa-screens/jl-01-home.png' })

// ── Emoji Panic: steer under happy emojis for 8 s ──
await p.getByRole('button', { name: 'Play Emoji Panic' }).click(); await sleep(700)
await p.getByRole('button', { name: /^Start/ }).click(); await sleep(300)
// steer from inside the page every frame: under the lowest happy emoji (the real steering path: s.target)
await p.evaluate(() => new Promise((res) => {
  const t0 = performance.now()
  const loop = () => {
    const j = window.__joylab, s = j.g.current, w = j.size.current.w, h = j.size.current.h
    const good = s.items.filter((i) => i.good && i.y < h - 30).sort((a, b) => b.y - a.y)[0]
    if (good) s.target = good.x / w
    if (performance.now() - t0 < 8000) requestAnimationFrame(loop); else res()
  }
  loop()
}))
const e1 = await hudScore(p)
const caught = await st(p, () => window.__joylab.g.current.caught)
await p.screenshot({ path: 'qa-screens/jl-02-emoji.png' })
expect(e1 > 0 && caught >= 3, `Emoji Panic: playing — caught ${caught}, score ${e1}`)
await p.keyboard.press('p'); await sleep(300)
const tA = await st(p, () => window.__joylab.g.current.t); await sleep(1200)
const tB = await st(p, () => window.__joylab.g.current.t)
expect(await p.evaluate(() => !!document.querySelector('.jl-overlay')) && Math.abs(tA - tB) < 0.01, 'Emoji Panic: P pauses (timer frozen, overlay shown)')
await p.getByRole('button', { name: 'Resume' }).first().click(); await sleep(300)
await st(p, () => { window.__joylab.g.current.t = 0.05 }); await sleep(500)
const res1 = await p.evaluate(() => document.querySelector('.jl-overlay h3')?.textContent)
const best1 = await p.evaluate(() => localStorage.getItem('joylab:best:emoji'))
expect(!!res1 && Number(best1) > 0, `Emoji Panic: results ("${res1}"), best saved (${best1})`)
await p.screenshot({ path: 'qa-screens/jl-03-emoji-results.png' })
await p.getByRole('button', { name: 'Play again' }).click(); await sleep(400)
expect((await hudScore(p)) === 0 && (await st(p, () => window.__joylab.g.current.t)) > 44, 'Emoji Panic: Play again restarts cleanly')
await p.getByRole('button', { name: 'Joy Lab', exact: true }).click(); await sleep(500)
const cardBest = await p.evaluate(() => document.querySelector('.jl-card--peach .jl-card__best')?.textContent)
expect(/Best/.test(cardBest ?? ''), `back to Joy Lab, best shown on the card ("${cardBest}")`)

// ── Wobble Tower: drop when the crane is over the tower ──
await p.getByRole('button', { name: 'Play Wobble Tower' }).click(); await sleep(700)
await p.getByRole('button', { name: 'Start stacking' }).click(); await sleep(300)
// press Space (through the game's real keyboard handler) on the exact frame the piece lines up
const dropWhen = (fn) => p.evaluate((src) => new Promise((res) => {
  const test = new Function('s', 'w', `return (${src})(s, w)`)
  const t0 = performance.now()
  const loop = () => {
    const j = window.__joylab, s = j.g.current
    if (s.overAt || performance.now() - t0 > 15000) return res(false)
    const d = s.cur.x - (s.stack.at(-1)?.x ?? j.size.current.w / 2)
    const crossed = s.prevD !== undefined && Math.sign(d) !== Math.sign(s.prevD)
    s.prevD = d
    if (!s.falling && (test(s, j.size.current.w) || crossed)) { s.prevD = undefined; window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); return res(true) }
    requestAnimationFrame(loop)
  }
  loop()
}), fn.toString())
for (let n = 0; n < 5; n++) {
  await dropWhen((s, w) => Math.abs(s.cur.x - (s.stack.at(-1)?.x ?? w / 2)) < 3)
  await p.waitForFunction((n) => window.__joylab.g.current.stack.length === n + 1 || window.__joylab.g.current.overAt, n, { timeout: 5000 })
  await sleep(250)
}
const floors = await st(p, () => window.__joylab.g.current.stack.length)
const tScore = await hudScore(p)
await p.screenshot({ path: 'qa-screens/jl-04-tower.png' })
expect(floors === 5 && tScore >= 50, `Wobble Tower: 5 floors stacked, score ${tScore}`)
// a wild drop: wait until the crane is far out, then drop by click → miss / topple → results
// a wild drop, by a real click on the play area, when the piece is far off to the side
const at = await p.evaluate(() => { const r = document.querySelector('.jl-stage canvas').getBoundingClientRect(); return [r.x + 20, r.y + r.height - 20] })
await p.waitForFunction(() => { const s = window.__joylab.g.current; const top = s.stack.at(-1); return !s.falling && Math.abs(s.cur.x - top.x) > top.w + s.cur.w }, null, { timeout: 15000, polling: 'raf' })
await p.mouse.click(at[0], at[1])
await p.waitForSelector('.jl-overlay', { timeout: 6000 })
const tRes = await p.evaluate(() => document.querySelector('.jl-overlay h3')?.textContent)
await p.screenshot({ path: 'qa-screens/jl-05-tower-fall.png' })
expect(!!tRes, `Wobble Tower: a bad drop ends the round ("${tRes}"); click drops`)
await p.getByRole('button', { name: 'Joy Lab', exact: true }).click(); await sleep(400)

// ── Pop the Chaos: click real bubbles; keyboard ring + Space ──
await p.getByRole('button', { name: 'Play Pop the Chaos' }).click(); await sleep(700)
await p.getByRole('button', { name: /^Start/ }).click(); await sleep(1500)
let clicks = 0
for (let k = 0; k < 18; k++) {
  const target = await p.evaluate(() => { const j = window.__joylab; const r = document.querySelector('.jl-stage canvas').getBoundingClientRect(); const bb = j.g.current.bubbles.find((x) => (x.kind === 'n' || x.kind === 'star') && x.y > 40 && x.y < r.height - 30); return bb ? [r.x + bb.x, r.y + bb.y] : null })
  if (target) { await p.mouse.click(target[0], target[1]); clicks++ }
  await sleep(180)
}
const popped = await st(p, () => window.__joylab.g.current.popped)
const pScore = await hudScore(p)
const before = popped
// aim the ring at a bubble and press Space through the game's key handler in the same frame
await p.evaluate(() => { const j = window.__joylab; const s = j.g.current; const bb = s.bubbles.find((x) => x.kind === 'n' && x.y > 60); if (bb) { s.aim.x = bb.x / j.size.current.w; s.aim.y = bb.y / j.size.current.h; window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })) } }); await sleep(200)
const kb = (await st(p, () => window.__joylab.g.current.popped)) > before
await p.screenshot({ path: 'qa-screens/jl-06-pop.png' })
expect(popped >= 4 && popped >= clicks * 0.8 && pScore > 0, `Pop the Chaos: ${popped} popped from ${clicks} clicks, score ${pScore}`)
expect(kb, 'Pop the Chaos: arrow-ring + Space pops too')
await st(p, () => { window.__joylab.g.current.t = 0.05 }); await sleep(500)
expect(await p.evaluate(() => !!document.querySelector('.jl-results')), 'Pop the Chaos: round ends with a summary')
await p.keyboard.press('Escape'); await p.waitForSelector('.ms-window', { state: 'detached' }); await sleep(400)

// ── Music Lounge ──
await openApp(p, 'Music Lounge')
const tiles = await p.evaluate(() => [...document.querySelectorAll('.mu-tile b')].map((x) => x.textContent))
await p.screenshot({ path: 'qa-screens/mu-01-albums.png' })
expect(tiles.length === 5, `Music: ${tiles.length} albums (${tiles.join(', ')})`)
expect(await p.evaluate(() => window.__music.steps()) === -1, 'no music before the visitor presses play (no autoplay; only game sound effects so far)')
await p.locator('.mu-tile', { hasText: 'Pocket Parade' }).click(); await sleep(400)
await p.locator('.mu-album .mu-btn--primary').click(); await sleep(2500)
const m1 = await p.evaluate(() => ({ ctx: window.__music.ctx(), pos: window.__music.position(), steps: window.__music.steps() }))
const cur = await p.evaluate(() => document.querySelector('.mu-row.is-current .mu-row__t b')?.textContent)
expect(m1.ctx === 'running' && m1.pos > 1.5 && m1.steps > 10, `playing "${cur}": audio running, ${m1.steps} steps scheduled, at ${m1.pos.toFixed(1)}s`)
await p.screenshot({ path: 'qa-screens/mu-02-album.png' })
await p.getByRole('button', { name: 'Next track' }).first().click(); await sleep(600)
const cur2 = await p.evaluate(() => document.querySelector('.mu-row.is-current .mu-row__t b')?.textContent)
expect(!!cur2 && cur2 !== cur, `next → "${cur2}"`)
await p.getByRole('button', { name: /^Now playing:/ }).click(); await sleep(900)
await p.screenshot({ path: 'qa-screens/mu-03-now.png' })
const spinning = await p.evaluate(() => document.querySelector('.mu-table')?.classList.contains('is-playing'))
await p.locator('.mu-progress input').fill('60'); await sleep(500)
const sk = await p.evaluate(() => window.__music.position())
expect(spinning && sk >= 59 && sk < 63, `Now Playing: turntable spinning; seek to 1:00 → ${sk.toFixed(1)}s`)
await p.getByRole('button', { name: 'Mute', exact: true }).click(); await sleep(200)
const muted = await p.evaluate(() => JSON.parse(localStorage.getItem('mindspace:music')).muted)
await p.getByRole('button', { name: 'Unmute', exact: true }).click()
await p.locator('.mu-bar__vol input').fill('0.4'); await sleep(200)
const vol = await p.evaluate(() => JSON.parse(localStorage.getItem('mindspace:music')).volume)
expect(muted === true && Math.abs(vol - 0.4) < 0.01, `mute and volume work and are remembered (volume ${vol})`)
await p.locator('.mu-nav--lists button', { hasText: 'Feel-Good Classics' }).click(); await sleep(400)
const links = await p.evaluate(() => [...document.querySelectorAll('.mu-else a')].map((a) => [a.href, a.target]))
const playable = await p.evaluate(() => document.querySelectorAll('.mu-main .mu-row').length)
expect(links.length >= 16 && links.every(([h, t]) => /^https:\/\/(open\.spotify\.com\/search|music\.youtube\.com\/search)/.test(h) && t === '_blank') && playable === 0, `Feel-Good Classics: ${links.length / 2} famous songs as external search links only, nothing playable in-site`)
await p.screenshot({ path: 'qa-screens/mu-04-classics.png' })
const pa = await p.evaluate(() => window.__music.position())
await p.keyboard.press('Escape'); await p.waitForSelector('.ms-window', { state: 'detached' }); await sleep(600)
const mini = await p.evaluate(() => !!document.querySelector('.ms-mini:not(.ms-mini--invite)'))
await openApp(p, 'About Me'); await sleep(1500)
const pb = await p.evaluate(() => window.__music.position())
await p.screenshot({ path: 'qa-screens/mu-05-mini-over-app.png' })
expect(mini && pb > pa + 2, `music keeps playing across apps (mini-player shown; ${pa.toFixed(1)} → ${pb.toFixed(1)}s, no restart)`)
await p.keyboard.press('Escape'); await sleep(500)
await p.getByRole('button', { name: 'Pause music' }).click(); await sleep(300)
const pp = await p.evaluate(() => window.__music.position()); await sleep(1000)
expect(Math.abs((await p.evaluate(() => window.__music.position())) - pp) < 0.05, 'mini-player pause stops playback')
expect(p.errors.length === 0, `desktop: no page errors ${p.errors.length ? JSON.stringify(p.errors.slice(0, 3)) : ''}`)
await p.context().close()

// ── the invitation: appears, never autoplays ──
{
  const q = await room({ viewport: { width: 1280, height: 800 } })
  await q.waitForSelector('.ms-mini--invite', { timeout: 12000 })
  expect((await q.evaluate(() => window.__music.ctx())) !== 'running', '"Set the mood" invitation appears; nothing plays until Play is pressed')
  await q.screenshot({ path: 'qa-screens/mu-06-invite.png' })
  await q.locator('.ms-mini__cta').click(); await sleep(1200)
  expect((await q.evaluate(() => window.__music.ctx())) === 'running', 'invitation Play starts the music')
  await q.context().close()
}

// ── phone + tablet layouts ──
for (const [w, h] of [[390, 844], [820, 1180]]) {
  const q = await room({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })
  await q.getByRole('button', { name: 'Open Music Lounge' }).tap(); await q.waitForSelector('.ms-window'); await sleep(900)
  const fit = await q.evaluate(() => { const r = document.querySelector('.ms-window').getBoundingClientRect(); const bar = document.querySelector('.mu-bar').getBoundingClientRect(); const o = document.querySelector('.mu-main'); return r.left >= 0 && r.right <= innerWidth && bar.bottom <= r.bottom + 1 && bar.left >= r.left - 1 && o.scrollWidth <= o.clientWidth + 1 })
  await q.screenshot({ path: `qa-screens/mu-10-${w}.png` })
  await q.locator('.mu-chips button:visible, .mu-nav button:visible', { hasText: 'Now Playing' }).first().tap(); await sleep(600)
  await q.screenshot({ path: `qa-screens/mu-11-${w}-now.png` })
  await q.locator('.ms-window__close').tap(); await sleep(500)
  await q.getByRole('button', { name: 'Open Joy Lab' }).tap(); await q.waitForSelector('.ms-window'); await sleep(800)
  await q.screenshot({ path: `qa-screens/jl-10-${w}.png` })
  await q.getByRole('button', { name: 'Play Pop the Chaos' }).tap(); await sleep(700)
  await q.getByRole('button', { name: /^Start/ }).tap(); await sleep(1500)
  let taps = 0
  for (let k = 0; k < 10; k++) {
    const t = await q.evaluate(() => { const j = window.__joylab; const r = document.querySelector('.jl-stage canvas').getBoundingClientRect(); const bb = j.g.current.bubbles.find((x) => x.kind === 'n' && x.y > 40 && x.y < r.height - 30); return bb ? [r.x + bb.x, r.y + bb.y] : null })
    if (t) { await q.touchscreen.tap(t[0], t[1]); taps++ }
    await sleep(200)
  }
  const pop = await q.evaluate(() => window.__joylab.g.current.popped)
  await q.screenshot({ path: `qa-screens/jl-11-${w}-pop.png` })
  const stageFits = await q.evaluate(() => { const r = document.querySelector('.jl-stage').getBoundingClientRect(); return r.right <= innerWidth && r.height >= 300 })
  expect(fit && stageFits, `${w}×${h}: Music fits (player bar inside the window, no sideways scroll); game stage fits`)
  expect(taps >= 2 && pop >= Math.max(2, Math.floor(taps * 0.8)), `${w}×${h}: Pop the Chaos by touch — ${pop} popped from ${taps} taps`)
  expect(q.errors.length === 0, `${w}×${h}: no page errors ${q.errors.length ? JSON.stringify(q.errors.slice(0, 3)) : ''}`)
  await q.context().close()
}
console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
await b.close()
