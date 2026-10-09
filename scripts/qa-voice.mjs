// AI voice guide, end to end in the browser: intro lines, consent, typed
// conversation, a guided walk to the Project Studio (position sampled — no
// teleporting on the street), walking to a project screen, the Challenges
// tab, the prototype, manual takeover, "stop", and the dock on a phone.
// Usage: node scripts/qa-voice.mjs [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=d3d11', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const errors = []
const problems = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const shot = (n) => p.screenshot({ path: `qa-screens/5${n}.png` })
const pos = () => p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 }))
const bubble = () => p.evaluate(() => document.querySelector('.ui-bubble.is-visible')?.textContent ?? '')
const lastGuide = () => p.evaluate(() => [...document.querySelectorAll('.ui-voice__log li.is-guide')].pop()?.textContent?.replace(/^Guide: /, '') ?? '')
const status = () => p.evaluate(() => (document.querySelector('.ui-voice__state') ?? document.querySelector('.ui-voice__status'))?.textContent ?? '')
const until = async (fn, ms) => { for (let t = 0; t < ms; t += 200) { if (await fn()) return true; await sleep(200) } return false }
const caseTitle = () => p.evaluate(() => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent ?? null)
const type = async (text) => {
  const input = p.getByLabel('Message the AI guide')
  if (!(await input.isVisible().catch(() => false))) await p.getByRole('button', { name: 'Type a message instead' }).click()
  await input.fill(text)
  await input.press('Enter')
}
/** sample the walk: returns the largest step between samples on the street */
async function follow(untilFn, maxMs) {
  let prev = await pos()
  let maxStep = 0
  let prevT = Date.now()
  const t0 = Date.now()
  let moved = 0
  while (Date.now() - t0 < maxMs) {
    await sleep(150)
    const q = await pos()
    const step = Math.hypot(q.x - prev.x, q.z - prev.z)
    const roomChange = (q.x > 300) !== (prev.x > 300)
    const now = Date.now()
    if (!roomChange) maxStep = Math.max(maxStep, step / Math.max(0.05, (now - prevT) / 1000))
    prevT = now
    moved += roomChange ? 0 : step
    prev = q
    if (await untilFn(q)) break
  }
  return { maxStep, moved, ms: Date.now() - t0 }
}

await p.goto(`${base}/street?debug&desktop&mode=day`)
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await p.getByRole('button', { name: 'Skip intro' }).click()
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1000)
await p.getByRole('button', { name: 'Start exploring' }).click()
const invited = await until(async () => /explore normally, or you can just talk to me/i.test(await bubble()), 16000)
expect(invited, `after the intro, the guide invites talking: "${await bubble()}"`)

// the dock: an invitation, voice off until the visitor opts in
expect((await status()) === 'Talk to me', `dock says "${await status()}"`)
await shot('00-dock')
await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
await sleep(400)
const consent = await p.evaluate(() => document.querySelector('.ui-voice__consent')?.textContent ?? '')
expect(/uses your microphone/.test(consent) && /doesn’t store your voice recordings/.test(consent), 'consent explains the microphone first')
await shot('01-consent')
await p.getByRole('button', { name: 'Type instead' }).click()
await sleep(1200)
expect(/type to me/i.test(await lastGuide()), `text mode greeting: "${await lastGuide()}"`)

// conversation: text + bubble match
await type('What does Naveen do?')
await sleep(900)
const a1 = await lastGuide()
expect(/UI\/UX and Product Designer with 4\+ years/.test(a1), `answer: "${a1.slice(0, 80)}…"`)
expect((await bubble()) === a1, 'bubble shows exactly the same text')
await type('what is TASK')
await sleep(700)
await type('what did he do there?')
await sleep(700)
expect(/UI\/UX Designer on TASK/.test(await lastGuide()), 'follow-up "there" → TASK')
await shot('02-conversation')

// guided walk to the Project Studio — no teleporting on the street
const start = await pos()
await type('Take me to your projects')
await sleep(800)
expect(/Taking you to Project Studio/.test(await status()), `status while walking: "${await status()}"`)
const walk = await follow(async (q) => q.x > 320 + 14.5, 120000)
expect(walk.maxStep < 15, `street walk is continuous (fastest ${walk.maxStep.toFixed(1)} m/s — a jog is ~5.6, ${walk.moved.toFixed(0)} m walked in ${(walk.ms / 1000).toFixed(0)} s)`)
expect(walk.moved > 20, 'the character actually walked the avenue')
const guideSaid = (re) => p.evaluate((src) => [...document.querySelectorAll('.ui-voice__log li.is-guide')].some((l) => new RegExp(src).test(l.textContent)), re.source)
await until(() => guideSaid(/this is the Project Studio. I’ll walk you through the projects one by one/), 20000)
const inStudio = await pos()
expect(inStudio.x - 320 > 14, `arrived in the Project Studio (room x ${(inStudio.x - 320).toFixed(1)})`)
expect(await guideSaid(/this is the Project Studio. I’ll walk you through the projects one by one/), 'arrival: the studio introduces itself and presents the projects one by one')
expect(await until(() => guideSaid(/This is TASK./), 30000), 'then the first project, TASK, is presented')
await shot('03-studio')

// a project: walk to its screen, open it, then its Challenges tab and prototype
await type('Show me KidPool')
await p.waitForFunction(() => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent === 'KidPool', null, { timeout: 30000 }).catch(() => {})
expect((await caseTitle()) === 'KidPool', `"Show me KidPool" opens "${await caseTitle()}"`)
await sleep(1200)
await type('Show me the challenge')
await sleep(2200)
const tab = await p.evaluate(() => document.querySelector('.ui-case.is-visible [role=tab][aria-selected=true]')?.textContent)
expect(tab === 'Challenges', `Challenges tab shown (${tab})`)
await shot('04-challenges')
const [popup] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null),
  type('Open the prototype'),
])
const link = await p.evaluate(() => document.querySelector('.ui-voice__link')?.getAttribute('href') ?? null)
const url = popup?.url() ?? link ?? ''
expect(/figma\.com\/proto\/UkougomRKZEjdNS0EC1Twf\//.test(url), `UI prototype: ${popup ? 'opened in a new tab' : link ? 'one-tap link offered' : 'nothing'} (${url.slice(0, 70)}…)`)
if (popup) await popup.close()
const [popup2] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null),
  type('Open the full case study in Figma'),
])
const link2 = await p.evaluate(() => document.querySelector('.ui-voice__link')?.getAttribute('href') ?? null)
const url2 = popup2?.url() ?? link2 ?? ''
expect(/figma\.com\/proto\/i852L2XjU3cEM6LpoRVOWN\/.*node-id=1066-64859/.test(url2), `case study: ${popup2 ? 'opened in a new tab' : link2 ? 'one-tap link offered' : 'nothing'} (${url2.slice(0, 70)}…)`)
if (popup2) await popup2.close()
await type('go back')
await sleep(1500)
expect((await caseTitle()) === null, '"go back" closes the case study')

// manual takeover during a walk
await type('Take me to the education campus')
// wait until we're out on the street and walking, then take the controls
await until(async () => (await pos()).x < 300, 30000)
await sleep(2500)
await p.keyboard.down('KeyS')
await sleep(700)
await p.keyboard.up('KeyS')
await sleep(1200)
const take = await lastGuide()
expect(/you’re driving/.test(take), `manual input takes over: "${take}"`)
const after = await pos()
await sleep(1500)
const still = await pos()
expect(Math.hypot(still.x - after.x, still.z - after.z) < 0.4, 'no more auto-walking after takeover')

// "stop" during a walk
await type('take me home')
await sleep(5000)
await type('stop')
await sleep(1200)
const s1 = await pos()
await sleep(1500)
const s2 = await pos()
expect(Math.hypot(s2.x - s1.x, s2.z - s1.z) < 0.4, `"stop" stops walking (${(await lastGuide()).slice(0, 40)})`)

// honesty
await type('what is the weather tomorrow')
await sleep(700)
expect(/outside what I know/.test(await lastGuide()), 'out-of-domain answered honestly')

// voice mode in this browser: never crashes; without a usable mic it falls back to text
await p.getByRole('button', { name: 'Close the guide' }).click()
await sleep(400)
await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
await sleep(300)
const voiceBtn = p.getByRole('button', { name: 'Turn on voice' })
if (await voiceBtn.isVisible().catch(() => false)) {
  await voiceBtn.click()
  await sleep(2500)
  const st = await p.evaluate(() => document.querySelector('.ui-voice')?.className ?? '')
  console.log(`  voice mode state after enabling: ${st.replace('ui-voice ', '')} · status "${await status()}"`)
  expect(/is-on/.test(st), 'voice mode on (or graceful text fallback)')
  await shot('05-voice-on')
} else console.log('  (no speech recognition in this browser — consent offers typing only)')

// phone
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage()
await m.goto(`${base}/street?debug&mode=day`)
await m.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await m.getByRole('button', { name: 'Skip intro' }).click()
await m.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1000)
await m.getByRole('button', { name: 'Start exploring' }).click()
await sleep(4000)
expect(await m.locator('.ui-voice__fab').waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false), 'phone: the AI orb is ready bottom-right (first-run hints are a small card, not a wall)')
await m.getByRole('button', { name: 'Close tips' }).click().catch(() => {})
await sleep(800)
await m.getByRole('button', { name: 'Talk to the AI guide' }).click()
await sleep(400)
await m.getByRole('button', { name: 'Type instead' }).click()
await sleep(600)
await m.getByLabel('Message the AI guide').fill('What tools does he use?')
await m.getByLabel('Message the AI guide').press('Enter')
await sleep(1200)
const box = await m.evaluate(() => { const r = document.querySelector('.ui-voice')?.getBoundingClientRect(); return r ? { l: r.left, r: r.right, t: r.top, b: r.bottom } : null })
expect(!!box && box.l >= 0 && box.r <= 390 && box.t > 90, `phone: dock fits under the header (${JSON.stringify(box)})`)
await m.screenshot({ path: 'qa-screens/506-phone.png' })

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
console.log('errors:', errors.length ? errors : 'none')
await b.close()
