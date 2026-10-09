// The phone experience end to end (390×844, touch), with no API key or
// endpoint: splash → hero → world, the AI orb in place of jump, the compact
// sheet, browser voice (listening / speaking), typed chat, the joystick, the
// Explore menu, walking to places with the guide narrating arrivals, NFC in
// full, the project presentation (TASK → next), the AI never covering a
// panel's close button, the phone back button, a change of course mid-walk,
// the Contact Café as a real destination, and a parked car across a guided
// route.
//
// Speech is scripted at the browser-API edge (see qa-browser-voice.mjs):
// a fake SpeechRecognition the test "speaks" into, and a speechSynthesis
// that records what would be said. Everything else is the real app.
// Usage: node scripts/qa-mobile-ux.mjs [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
const problems = []
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && errors.push(m.text()))
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const until = async (fn, ms) => { for (let t = 0; t < ms; t += 250) { if (await fn()) return true; await sleep(250) } return false }
const shot = (n) => p.screenshot({ path: `qa-screens/8${n}.png` })

await p.addInitScript(() => {
  window.__spoken = []
  class FakeRecognition {
    constructor() { window.__rec = this; this.running = false }
    start() { if (this.running) throw new Error('InvalidStateError'); this.running = true }
    stop() { this.abort() }
    abort() { if (!this.running) return; this.running = false; setTimeout(() => this.onend?.(), 10) }
  }
  window.SpeechRecognition = FakeRecognition
  window.webkitSpeechRecognition = FakeRecognition
  window.__hear = (text) => {
    const r = window.__rec
    if (!r || !r.running) return false
    const alt = [{ transcript: text }]
    alt.isFinal = true
    r.onresult?.({ resultIndex: 0, results: [alt] })
    return true
  }
  const synth = {
    speaking: false, pending: false, queue: [], getVoices: () => [], addEventListener() {},
    cancel() { const q = this.queue; this.queue = []; this.speaking = false; for (const u of q) u.onerror?.({ error: 'canceled' }) },
    speak(u) { if (u.text.trim()) window.__spoken.push(u.text); this.queue.push(u); if (this.queue.length === 1) this.next() },
    next() {
      const u = this.queue[0]
      if (!u) { this.speaking = false; return }
      this.speaking = true
      setTimeout(() => {
        if (this.queue[0] !== u) return
        u.onstart?.()
        setTimeout(() => { if (this.queue[0] !== u) return; this.queue.shift(); u.onend?.(); this.next() }, Math.max(200, u.text.length * 12))
      }, 20)
    },
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
})

const pos = () => p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 }))
const guideLines = () => p.evaluate(() => [...document.querySelectorAll('.ui-voice__log li.is-guide')].map((l) => l.textContent.replace(/^Guide: /, '')))
const lastGuide = async () => (await guideLines()).pop() ?? ''
const said = async (re) => (await guideLines()).some((g) => re.test(g))
const hear = async (text) => {
  // the mic pauses while the guide talks on phones: wait for it, then speak
  await until(() => p.evaluate(() => !!window.__rec?.running), 20000)
  return p.evaluate((t) => window.__hear(t), text)
}
/** what the app looks like right now (printed when a walk check fails) */
const diag = async (label) => console.log(`   [${label}]`, JSON.stringify(await p.evaluate(() => {
  const g = window.__mindscape ?? {}
  return {
    x: g.x, z: g.z, state: g.state, dock: document.querySelector('.ui-voice')?.className, rec: !!window.__rec?.running, speaking: window.speechSynthesis.speaking,
    panel: document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent ?? null,
    last: [...document.querySelectorAll('.ui-voice__log li')].slice(-4).map((l) => l.textContent.slice(0, 80)),
  }
})))
const box = (sel) => p.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } : null }, sel)
const hit = (sel) => p.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return false
  const r = el.getBoundingClientRect()
  return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(s)
}, sel)
/** walk and measure: largest step between samples while not changing rooms (a teleport shows as a big jump) */
async function walkUntil(fn, ms) {
  let prev = await pos()
  let maxStep = 0
  let prevT = Date.now()
  const ok = await until(async () => {
    const q = await pos()
    { const now = Date.now(); if ((q.x > 300) === (prev.x > 300)) maxStep = Math.max(maxStep, Math.hypot(q.x - prev.x, q.z - prev.z) / Math.max(0.05, (now - prevT) / 1000)); prevT = now }
    prev = q
    return fn()
  }, ms)
  return { ok, maxStep }
}

// ── 1–3. splash → hero → world ────────────────────────────────────────────
await p.goto(`${base}/street?debug&mode=day`)
const splash = await until(() => p.evaluate(() => !!document.querySelector('.ui-splash .ui-splash__brand')), 15000)
const greetings = new Set()
for (let t = 0; t < 5000; t += 300) {
  const g = await p.evaluate(() => document.querySelector('.ui-splash__hello')?.textContent?.trim())
  if (g) greetings.add(g)
  await sleep(300)
}
expect(splash && !(await p.evaluate(() => !!document.querySelector('.ui-loading__meter'))), 'splash: cinematic opening (companion, name), no progress bar')
expect(['Welcome', 'స్వాగతం', 'स्वागत है'].filter((g) => greetings.has(g)).length >= 2, `splash: multilingual welcome (${[...greetings].join(' · ')})`)
await shot('00-splash')
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await p.getByRole('button', { name: 'Skip intro' }).click()
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1200)
const ways = await p.evaluate(() => [...document.querySelectorAll('.ui-intro__ways button')].map((x) => x.textContent.trim()))
expect(ways.join('|') === 'Start exploring|Guide me|Explore the map' && /Good (morning|afternoon|evening)\. Welcome to Naveen’s world/.test(await p.evaluate(() => document.querySelector('.ui-intro__welcome')?.textContent ?? '')), `hero: time-aware welcome + three ways to explore (${ways.join(', ')})`)
await shot('01-hero')
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(4000)

// ── 4. AI collapsed, in place of jump ─────────────────────────────────────
const fab = await box('.ui-voice__fab')
const joy = await box('.ui-joystick')
expect((await p.evaluate(() => document.querySelectorAll('.ui-jump').length)) === 0, 'no jump button on the phone')
expect(!!fab && fab.r > 300 && fab.b > 700 && !!joy && joy.l < 60 && joy.b > 700, `AI orb bottom-right where jump was (${fab && `${Math.round(fab.l)},${Math.round(fab.t)}`}), joystick bottom-left`)
expect(!(await p.evaluate(() => !!document.querySelector('.ui-voice__sheet'))), 'AI collapsed by default (no sheet)')
const tips = await p.evaluate(() => document.querySelector('.ui-tips.is-visible .ui-tips__title')?.textContent ?? '')
expect(/Explore the city|Move with the joystick|Talk to your AI guide|Open the menu/.test(tips), `first-run hint shown: "${tips}"`)
await shot('02-world')

// ── 5–8. sheet, voice, typed chat ─────────────────────────────────────────
await p.locator('.ui-voice__fab').tap()
await sleep(500)
const sheet = await box('.ui-voice__sheet')
expect(!!sheet && sheet.h <= 844 * 0.31 + 1, `AI sheet expands, at most ~30% of the screen (${sheet && Math.round((sheet.h / 844) * 100)}%)`)
await p.getByRole('button', { name: 'Turn on voice' }).click()
await sleep(1200)
const head = await p.evaluate(() => document.querySelector('.ui-voice__sheet-head p span')?.textContent ?? '')
expect(/Listening|Speaking/.test(head), `voice on: sheet shows "${head}"`)
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 8000)
await p.getByRole('button', { name: 'Collapse the AI guide' }).click()
await sleep(400)
expect((await p.evaluate(() => document.querySelector('.ui-voice__fablabel')?.textContent)) === 'Listening…', 'collapsed + listening: "Listening…" beside the orb')
await hear('What does Naveen do?')
const speaking = await until(() => p.evaluate(() => document.querySelector('.ui-voice')?.classList.contains('is-speaking') && getComputedStyle(document.querySelector('.ui-voice__wave')).display !== 'none'), 4000)
expect(speaking, 'speaking: waveform on the orb')
expect(/UI\/UX and Product Designer/.test(await p.evaluate(() => document.querySelector('.ui-voice__caption')?.textContent ?? '')), 'collapsed: the answer shows briefly above the orb')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 15000)
await p.locator('.ui-voice__fab').tap()
await sleep(400)
await p.getByLabel('Message the AI guide').fill('What tools does Naveen use?')
await p.getByLabel('Message the AI guide').press('Enter')
await sleep(900)
expect(/Figma/.test(await lastGuide()), 'typed chat in the sheet')
await shot('03-sheet')
await p.getByRole('button', { name: 'Collapse the AI guide' }).click()
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 15000)

// ── 9. joystick ───────────────────────────────────────────────────────────
const j = await box('.ui-joystick')
const before = await pos()
await p.mouse.move(j.l + j.w / 2, j.t + j.h / 2)
await p.mouse.down()
await p.mouse.move(j.l + j.w / 2, j.t + 8, { steps: 4 })
await sleep(1300)
await p.mouse.up()
await sleep(500)
const after = await pos()
expect(Math.hypot(after.x - before.x, after.z - before.z) > 1, `joystick walks (${Math.hypot(after.x - before.x, after.z - before.z).toFixed(1)} m)`)

// ── 11–13. Explore menu → Home (walked, narrated) ─────────────────────────
await p.getByRole('button', { name: 'Open menu' }).click()
await sleep(900)
const items = await p.evaluate(() => [...document.querySelectorAll('.ui-explore__item')].map((x) => `${x.querySelector('.ui-explore__name')?.textContent?.replace(/^\d+/, '')} — ${x.querySelector('.ui-explore__about')?.textContent}`))
expect(items.length === 6 && /Home — About me/.test(items[0]) && /Design Journey — How I approach design/.test(items[4]) && /Contact Café — Let’s talk/.test(items[5]), `Explore menu: six places with descriptions (${items.map((x) => x.split(' — ')[0]).join(', ')})`)
await shot('04-menu')
await p.locator('.ui-explore__item').first().tap()
const toHome = await walkUntil(() => said(/this is Naveen’s home/), 90000)
expect(toHome.ok && toHome.maxStep < 15, `menu → Home: walked (fastest ${toHome.maxStep.toFixed(1)} m/s), arrival narrated`)
expect(/Want the full story here/.test(await lastGuide()), 'arrival offers the full story or somewhere else')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 15000)
await hear('yes')
await sleep(1200)
expect(/UI\/UX and Product Designer with 4\+ years.*Where should we go\?/.test(await lastGuide()), '"yes" → Home in full, then where next')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 30000)

// ── NFC: walk there and present it in full ────────────────────────────────
await hear('Take me to NFC and explain the company')
const toNfc = await walkUntil(() => said(/This is NFC Solutions — NFC Solutions India Pvt\. Ltd\./), 120000)
const nfc = (await guideLines()).find((g) => /This is NFC Solutions — /.test(g)) ?? ''
expect(toNfc.ok && toNfc.maxStep < 15, `NFC: walked there (fastest ${toNfc.maxStep.toFixed(1)} m/s)`)
expect(/since May 2022/.test(nfc) && /His role/.test(nfc) && /Project Studio/.test(nfc) && /Figma/.test(nfc) && /won’t guess/.test(nfc), 'NFC presented in full: role, work, process, projects, tools, colleagues (no invented facts)')
expect(/What would you like to explore next\?.*Where should we go\?$/.test(nfc), 'NFC: then asks what to explore next')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 40000)

// ── 16–20. projects one by one; the AI never covers the panel ─────────────
await hear('projects')
const studio = await until(() => said(/Here we are — this is the Project Studio\. I’ll walk you through the projects one by one/), 90000)
expect(studio, 'Project Studio: arrival introduces the studio and the plan')
const task = await until(async () => (await said(/This is TASK\./)) && (await p.evaluate(() => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent)) === 'TASK', 60000)
expect(task, 'TASK presented and its case study opened')
expect(/Would you like to explore this project further, or should I show you the next one\?/.test((await guideLines()).find((g) => /This is TASK\./.test(g)) ?? ''), 'TASK: "explore further, or the next one?"')
await sleep(800)
const small = await box('.ui-voice__fab')
expect(!(await p.evaluate(() => !!document.querySelector('.ui-voice__sheet'))) && !!small && small.w <= 52, `panel open: AI collapsed to a small orb in the corner (${small && Math.round(small.w)} px), no sheet`)
expect(await hit('.ui-case__close'), 'panel close button is on top and receives the tap')
expect(await hit('.ui-case__proto:not(.ui-case__proto--case)'), '"View prototype" reachable')
await shot('05-task')
const popupP = ctx.waitForEvent('page', { timeout: 30000 }).catch(() => null)
await hear('Show me the prototype')
const popup = await Promise.race([popupP, sleep(6000).then(() => null)])
const link = await p.evaluate(() => document.querySelector('.ui-voice__link')?.getAttribute('href') ?? null)
const pointed = /use “View prototype” at the top of the TASK panel/.test(await lastGuide())
expect(/figma\.com\/proto\/vUIgk3l5i7TXJwCPXHq7xu/.test(popup?.url() ?? link ?? '') || pointed, `prototype: ${popup ? 'opened TASK’s own Figma link' : link ? 'one-tap link offered' : pointed ? 'popup blocked → points at the panel’s “View prototype”' : 'nothing'}`)
if (popup) await popup.close()
// the phone's back button closes the panel, not the site
await p.goBack()
await sleep(800)
expect(!(await p.evaluate(() => !!document.querySelector('.ui-case.is-visible'))) && /\/street/.test(p.url()), 'back button closes the panel and stays on the site')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 20000)
await hear('Next project')
const kid = await until(async () => (await said(/This is KidPool\./)) && (await p.evaluate(() => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent)) === 'KidPool', 60000)
expect(kid, '"next project" → KidPool presented')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 30000)

// ── change of course mid-walk ─────────────────────────────────────────────
await hear('Guide me')
await until(() => p.evaluate(() => /On our way/.test(document.querySelector('.ui-voice__fablabel')?.textContent ?? '') || document.querySelector('.ui-voice')?.classList.contains('is-navigating')), 15000)
await sleep(2500)
await hear('Actually, take me to education')
await sleep(1200)
expect(/change of plan.*Education/.test(await lastGuide()), `change of course acknowledged: "${(await lastGuide()).slice(0, 50)}"`)
const toEdu = await walkUntil(() => said(/Education, where Naveen’s journey began|This is where Naveen’s journey began/), 150000)
expect(toEdu.ok, 'the new route is walked to Education')
if (!toEdu.ok) await diag('education')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 20000)

// ── 21–23. the Contact Café is a real destination ─────────────────────────
await hear('Take me to contact')
const toCafe = await walkUntil(() => said(/We’ve reached the Contact Café/), 150000)
const cafe = (await guideLines()).find((g) => /We’ve reached the Contact Café/.test(g)) ?? ''
if (!toCafe.ok) await diag('cafe')
expect(toCafe.ok && toCafe.maxStep < 15, `contact: walked there (fastest ${toCafe.maxStep.toFixed(1)} m/s)`)
expect(/naveenyarramallugalla@gmail\.com/.test(cafe) && /\+91 70362 82178/.test(cafe) && /somewhere else/.test(cafe) && /finish the journey here\?$/.test(cafe), 'contact: presented, contact options, then offers where next or finishing')
await shot('06-cafe')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 30000)
await hear('What can I do here?')
await sleep(900)
expect(/email Naveen/.test(await lastGuide()), 'what can I do here → at the café')
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 15000)
await hear('Take me somewhere else')
await sleep(900)
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 15000)
await hear('the design journey')
const leaving = await until(() => p.evaluate(() => document.querySelector('.ui-voice')?.classList.contains('is-navigating')), 15000)
expect(leaving, 'a destination named in reply → walking there')
await hear('stop')
await sleep(1500)

// ── a parked car across a guided route ────────────────────────────────────
// (step out of any room first — a teleport doesn't leave a room, the door does — then confirm the spot)
if (await p.getByRole('button', { name: 'Back outside' }).isVisible().catch(() => false)) {
  await p.getByRole('button', { name: 'Back outside' }).click()
  await until(async () => (await pos()).x < 300 && !(await p.getByRole('button', { name: 'Back outside' }).isVisible().catch(() => false)), 15000)
}
for (let i = 0; i < 4; i++) {
  await sleep(2500)
  await p.evaluate(() => window.__teleport(-7, -28, Math.PI))
  await sleep(2000)
  const q = await pos()
  if (Math.hypot(q.x + 7, q.z + 28) < 1.5) break
}
expect(Math.hypot((await pos()).x + 7, (await pos()).z + 28) < 1.5, 'standing on the sidewalk north of the parked car')
const kind = await p.evaluate(() => window.__parkVehicle(-7, -34, Math.PI / 2))
await sleep(600)
await until(() => p.evaluate(() => !window.speechSynthesis.speaking), 15000)
await hear('Take me to education')
let minCar = Infinity
const pass = await until(async () => {
  const q = await pos()
  minCar = Math.min(minCar, Math.hypot(q.x + 7, q.z + 34))
  // arrived: the arrival line is the latest, and the player is inside Education (rooms sit at x > 300)
  return /Education, where Naveen’s journey began/.test(await lastGuide()) && q.x > 300
}, 90000)
const stuck = await said(/can’t find a clear way/)
if (!pass || stuck) await diag('parked car')
expect(pass && !stuck, `a ${kind} parked across the route: the guided walk gets past it and arrives (closest ${minCar.toFixed(1)} m to it)`)
await p.evaluate(() => window.__unparkVehicles())

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
console.log('errors:', errors.length ? errors : 'none')
await b.close()
