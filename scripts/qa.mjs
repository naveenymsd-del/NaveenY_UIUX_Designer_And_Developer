/**
 * Automated browser QA using the locally installed Chrome (playwright-core).
 * Usage: node scripts/qa.mjs [scenario] [--url=http://localhost:5173]
 * Scenarios: smoke (default), move, mobile, projects, all
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const scenario = args.find((a) => !a.startsWith('--')) ?? 'smoke'
const base = (args.find((a) => a.startsWith('--url=')) ?? '--url=http://localhost:5173').slice(6)
const outDir = path.resolve('qa-screens')
fs.mkdirSync(outDir, { recursive: true })

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const errors = []
function attach(page, label) {
  page.on('console', (m) => {
    const t = m.type()
    if (t === 'error' || t === 'warning') errors.push(`[${label}] ${t}: ${m.text()}`)
    if (process.env.VERBOSE) console.log(`[${label}] ${t}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errors.push(`[${label}] requestfailed: ${r.url()} ${r.failure()?.errorText}`))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`[${label}] http ${r.status()}: ${r.url()}`)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stats = (page) => page.evaluate(() => window.__mindscape ?? null)

/** load, then skip the cinematic straight to the hero (Start exploring / View my work) */
async function toHero(page) {
  await page.waitForSelector('.ui-intro__skip', { timeout: 90000 })
  await sleep(600)
  await page.getByRole('button', { name: 'Skip intro' }).click()
  await page.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
  await sleep(1400)
}

async function boot(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await toHero(page)
}

async function start(page, which = 'Start exploring') {
  await page.getByRole('button', { name: which }).click()
  await sleep(4600)
}

async function hold(page, keys, ms) {
  for (const k of keys) await page.keyboard.down(k)
  await sleep(ms)
  for (const k of keys) await page.keyboard.up(k)
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file })
  console.log('screenshot', file)
}

async function desktop(browser, w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  attach(page, `desktop-${w}`)
  return { ctx, page }
}

async function runSmoke(browser) {
  const { ctx, page } = await desktop(browser)
  await page.goto(`${base}/street?debug&desktop`, { waitUntil: 'domcontentloaded' })
  await sleep(700)
  await shot(page, '01-loading')
  await page.waitForSelector('.ui-intro__skip', { timeout: 90000 })
  await sleep(2500)
  await shot(page, '02-intro-flight')
  await toHero(page)
  await shot(page, '02-intro-hero')
  await start(page)
  await shot(page, '03-playing-tips')
  console.log('stats after start', await stats(page))
  await page.keyboard.press('Escape')
  await sleep(400)
  await shot(page, '04-playing')
  await ctx.close()
}

async function runMove(browser) {
  const { ctx, page } = await desktop(browser)
  await boot(page, `${base}/street?debug&desktop`)
  await start(page)
  await page.keyboard.press('Escape')
  const s0 = await stats(page)
  console.log('start', s0)
  await hold(page, ['KeyW'], 1500)
  const s1 = await stats(page)
  console.log('after W 1.5s', s1)
  await shot(page, '10-walk-forward')
  await hold(page, ['ShiftLeft', 'KeyW'], 1600)
  const s2 = await stats(page)
  console.log('after run', s2)
  await shot(page, '11-run')
  await page.keyboard.down('KeyW')
  await sleep(200)
  await page.keyboard.press('Space')
  await sleep(200)
  const sj = await stats(page)
  console.log('jump mid-air', sj)
  await shot(page, '12-jump')
  await sleep(500)
  await page.keyboard.up('KeyW')
  await sleep(600)
  console.log('after landing', await stats(page))
  // turn around (S) — character should rotate smoothly toward the camera
  await hold(page, ['KeyS'], 900)
  await shot(page, '13-backward')
  await hold(page, ['KeyA'], 900)
  await shot(page, '14-left')
  // mouse drag to orbit
  const box = await page.locator('.game-canvas').boundingBox()
  await page.mouse.move(box.width / 2, box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.width / 2 + 300, box.height / 2 + 60, { steps: 12 })
  await page.mouse.up()
  await sleep(600)
  await shot(page, '15-orbit')
  // collision: walk north into the kiosk / arch area for a while and ensure we don't pass through
  console.log('final', await stats(page))
  await ctx.close()
}

async function runMobile(browser) {
  for (const [w, h] of [[390, 844], [393, 852], [430, 932]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    attach(page, `mobile-${w}`)
    await boot(page, `${base}/street?debug&touch`)
    await shot(page, `20-mobile-intro-${w}`)
    await page.getByRole('button', { name: 'Start exploring' }).tap()
    // wait for the hand-off to finish (slower GPUs take a little longer), then a beat
    await page.waitForSelector('.ui-mobile.is-visible', { timeout: 20000 })
    await sleep(800)
    await shot(page, `21-mobile-play-${w}`)
    // drive the joystick with a synthetic pointer
    const j = await page.locator('.ui-joystick').boundingBox()
    if (j) {
      const cx = j.x + j.width / 2
      const cy = j.y + j.height / 2
      const s0 = await stats(page)
      await page.evaluate(({ cx, cy }) => {
        const el = document.querySelector('.ui-joystick')
        const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }))
        ev('pointerdown', cx, cy)
        ev('pointermove', cx, cy - 40)
        window.__stickMove = () => ev('pointermove', cx + 2, cy - 60)
        window.__stickUp = () => ev('pointerup', cx, cy - 60)
      }, { cx, cy })
      await sleep(300)
      await page.evaluate(() => window.__stickMove())
      await sleep(1500)
      await shot(page, `22-mobile-joystick-${w}`)
      await page.evaluate(() => window.__stickUp())
      await sleep(400)
      const s1 = await stats(page)
      console.log(`mobile ${w} joystick moved`, s0 && s1 ? Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2) : 'n/a')
      // phones have no jump button: the AI guide's orb sits bottom-right instead
      const orb = await page.evaluate(() => { const r = document.querySelector('.ui-voice__fab')?.getBoundingClientRect(); return r ? [Math.round(r.right), Math.round(r.bottom)] : null })
      const jumps = await page.evaluate(() => document.querySelectorAll('.ui-jump').length)
      console.log(`mobile ${w} AI orb bottom-right`, orb, 'jump buttons', jumps)
      if (!orb || jumps) errors.push(`[mobile-${w}] expected the AI orb and no jump button`)
    }
    await ctx.close()
  }
}

async function runProjects(browser) {
  const { ctx, page } = await desktop(browser)
  await boot(page, `${base}/street?debug&desktop`)
  await start(page)
  await page.keyboard.press('Escape')
  // /projects still works as an overview (fallback route)
  await page.evaluate(() => { history.pushState({}, '', '/projects' + location.search); dispatchEvent(new PopStateEvent('popstate')) })
  await sleep(2400)
  await shot(page, '30-projects-mode')
  console.log('url', page.url())
  await page.locator('.ui-rail__card').nth(1).click()
  await sleep(2200)
  await shot(page, '31-project-open')
  await page.getByRole('button', { name: /Next project/ }).click()
  await sleep(2000)
  await shot(page, '32-project-next')
  await page.getByRole('button', { name: 'Close project' }).click()
  await sleep(1200)
  await page.getByRole('button', { name: 'Back to street' }).click()
  await sleep(1800)
  await shot(page, '33-back-to-street')
  console.log('url', page.url())
  // menu
  await page.getByRole('button', { name: 'Open menu' }).click()
  await sleep(900)
  await shot(page, '34-menu')
  await page.getByRole('button', { name: /AI Workflow/ }).click()
  await sleep(600)
  await shot(page, '35-menu-workflow')
  // the Explore menu lists the places (choosing one walks there — covered by qa-mobile-ux); here: stand at NFC and open it with E
  console.log('explore menu places:', await page.evaluate(() => [...document.querySelectorAll('.ui-explore__name')].map((n) => n.textContent.replace(/^\d+/, '')).join(', ')))
  await page.getByRole('button', { name: 'Close menu' }).click()
  await sleep(600)
  await page.evaluate(() => window.__teleport(10.8, 17, Math.PI / 2))
  await sleep(2500)
  await shot(page, '36-travel-cafe')
  const near = await page.evaluate(() => document.querySelector('.ui-prompt.is-visible')?.textContent ?? null)
  console.log('prompt near NFC Solutions:', near)
  await page.keyboard.press('KeyE')
  await sleep(2200)
  await sleep(4500)
  await shot(page, '37-office-inside')
  // story card in the Design Park
  await page.evaluate(() => window.__teleport(-21.6, 22.4, Math.PI))
  await sleep(2500)
  await page.keyboard.press('KeyE')
  await sleep(2000)
  await shot(page, '38-process-card')
  console.log('story card:', await page.evaluate(() => document.querySelector('.ui-panel.is-visible h2')?.textContent ?? null))
  await page.keyboard.press('Escape')
  await sleep(1000)
  await page.evaluate(() => window.__teleport(-25.5, 21.5, Math.PI))
  await sleep(2500)
  await page.keyboard.press('KeyE')
  await sleep(2000)
  await shot(page, '39-ai-card')
  console.log('ai card:', await page.evaluate(() => document.querySelector('.ui-panel.is-visible h2')?.textContent ?? null))
  await page.keyboard.press('Escape')
  // sound toggle persistence
  await page.getByRole('button', { name: /Mute sound|Turn sound on/ }).click()
  const pref = await page.evaluate(() => localStorage.getItem('mindscape-avenue:sound'))
  console.log('sound pref after toggle:', pref)
  console.log('stats', await stats(page))
  await ctx.close()
}

async function runViewports(browser) {
  for (const [w, h] of [[1920, 1080], [1366, 768], [1024, 768]]) {
    const { ctx, page } = await desktop(browser, w, h)
    await boot(page, `${base}/street?debug&desktop`)
    await start(page)
    await shot(page, `40-viewport-${w}x${h}`)
    console.log(`viewport ${w}x${h}`, await stats(page))
    await ctx.close()
  }
}

async function runPerf(browser) {
  const { ctx, page } = await desktop(browser)
  await boot(page, `${base}/street?debug&desktop`)
  await start(page)
  await page.keyboard.press('Escape')
  await sleep(1500)
  const report = await page.evaluate(() => {
    const scene = window.__scene
    const rows = []
    let total = 0
    let meshes = 0
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return
      const g = o.geometry
      const tris = (g.index ? g.index.count : g.attributes.position.count) / 3
      const inst = o.isInstancedMesh ? o.count : 1
      const t = tris * inst
      total += t
      meshes++
      rows.push({ name: o.name || o.type, tris: Math.round(t), inst, cast: o.castShadow })
    })
    const byName = {}
    for (const r of rows) {
      const k = r.name.split('|').slice(0, 2).join('|')
      byName[k] = byName[k] || { tris: 0, meshes: 0, inst: 0 }
      byName[k].tris += r.tris
      byName[k].meshes++
      byName[k].inst += r.inst
    }
    const top = Object.entries(byName).sort((a, b) => b[1].tris - a[1].tris).slice(0, 18)
    return { total: Math.round(total), meshes, top }
  })
  const gpu = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown' })
  console.log('GPU', gpu)
  console.log('scene triangles', report.total, 'meshes', report.meshes)
  for (const [k, v] of report.top) console.log('  ', k.padEnd(28), String(v.tris).padStart(8), 'tris', String(v.meshes).padStart(4), 'meshes', String(v.inst).padStart(6), 'inst')
  const samples = []
  for (let i = 0; i < 6; i++) {
    await sleep(500)
    samples.push(await stats(page))
  }
  console.log('fps samples', samples.map((s) => s.fps).join(' '), 'calls', samples.at(-1).calls, 'tris', samples.at(-1).triangles)
  await ctx.close()
}

async function runQualityTiers(browser) {
  for (const q of ['low', 'medium', 'high']) {
    const { ctx, page } = await desktop(browser)
    await boot(page, `${base}/street?debug&desktop&quality=${q}`)
    await start(page)
    await page.keyboard.press('Escape')
    await sleep(1200)
    const s = []
    for (let i = 0; i < 6; i++) {
      await sleep(500)
      s.push(await stats(page))
    }
    console.log(`quality=${q} fps`, s.map((x) => x.fps).join(' '), 'calls', s.at(-1).calls, 'tris', s.at(-1).triangles)
    await ctx.close()
  }
}

async function runProfile(browser) {
  for (const off of ['', 'shadows', 'npc', 'traffic', 'parts', 'env', 'npc,traffic,particles']) {
    const { ctx, page } = await desktop(browser)
    await boot(page, `${base}/street?debug&desktop&quality=low${off ? `&off=${off}` : ''}`)
    await start(page)
    await page.keyboard.press('Escape')
    await sleep(1200)
    const s = []
    for (let i = 0; i < 5; i++) {
      await sleep(500)
      s.push(await stats(page))
    }
    const avg = s.reduce((a, x) => a + x.fps, 0) / s.length
    console.log(`off=${off || '(none)'}`.padEnd(32), 'avg fps', avg.toFixed(1), 'calls', s.at(-1).calls, 'tris', s.at(-1).triangles)
    await ctx.close()
  }
}

async function runTour(browser) {
  const { ctx, page } = await desktop(browser)
  await boot(page, `${base}/street?debug&desktop`)
  await start(page)
  await page.keyboard.press('Escape')
  const stops = [
    ['50-education', 2.5, -47, Math.PI - 0.1],
    ['51-nfc-office', 6.5, 21.5, Math.PI / 2 + 0.35],
    ['52-home', -6.4, -21.5, -Math.PI / 2 - 0.4],
    ['53-design-park', -13.5, 25.2, Math.PI + 0.3],
    ['54-ai-area', -21, 25, -Math.PI / 2],
    ['55-project-district', 8, -22, Math.PI / 2 + 0.3],
  ]
  for (const [name, x, z, yaw] of stops) {
    await page.evaluate(([x, z, yaw]) => window.__teleport(x, z, yaw), [x, z, yaw])
    await sleep(2600)
    await shot(page, name)
  }
  // enter each building through its door
  for (const [name, x, z, yaw] of [['60-enter-education', 0, -55.4, Math.PI], ['61-enter-office', 13.2, 17, Math.PI / 2], ['62-enter-home', -11.6, -25, -Math.PI / 2]]) {
    await page.evaluate(([x, z, yaw]) => window.__teleport(x, z, yaw), [x, z, yaw])
    await sleep(1400)
    await page.keyboard.press('KeyE')
    await sleep(1800)
    await shot(page, name + '-establish')
    await sleep(3200)
    await shot(page, name + '-inside')
    await page.keyboard.down('KeyW'); await sleep(1500); await page.keyboard.up('KeyW')
    await sleep(600)
    await shot(page, name + '-walk')
    console.log(name, await stats(page))
  }
  console.log('stats', await stats(page))
  await ctx.close()
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: !process.env.HEADED,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
})
try {
  if (scenario === 'smoke' || scenario === 'all') await runSmoke(browser)
  if (scenario === 'move' || scenario === 'all') await runMove(browser)
  if (scenario === 'projects' || scenario === 'all') await runProjects(browser)
  if (scenario === 'mobile' || scenario === 'all') await runMobile(browser)
  if (scenario === 'viewports' || scenario === 'all') await runViewports(browser)
  if (scenario === 'perf' || scenario === 'all') await runPerf(browser)
  if (scenario === 'tiers') await runQualityTiers(browser)
  if (scenario === 'profile') await runProfile(browser)
  if (scenario === 'tour' || scenario === 'all') await runTour(browser)
} catch (e) {
  console.error('QA FAILED:', e)
  process.exitCode = 1
} finally {
  await browser.close()
}
const unique = [...new Set(errors)]
console.log(`\n${unique.length} console errors/warnings:`)
for (const e of unique.slice(0, 60)) console.log(' ', e)
