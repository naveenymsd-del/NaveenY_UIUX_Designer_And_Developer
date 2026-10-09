// Guided tours in the browser: "give me a tour" walks to the first stop (no
// teleport), introduces it, then waits; a question mid-tour is answered and
// followed by "Want to continue the tour?"; "yes"/"next" walks on; "skip"
// moves on; "stop the tour" ends it; "show me all projects" walks the screens.
// Usage: node scripts/qa-tour.mjs [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
const problems = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const until = async (fn, ms) => { for (let t = 0; t < ms; t += 250) { if (await fn()) return true; await sleep(250) } return false }
const guide = () => p.evaluate(() => [...document.querySelectorAll('.ui-voice__log li.is-guide')].map((l) => l.textContent.replace(/^Guide: /, '')))
const lastGuide = async () => (await guide()).pop() ?? ''
const pos = () => p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 }))
const type = async (text) => {
  const input = p.getByLabel('Message the AI guide')
  if (!(await input.isVisible().catch(() => false))) await p.getByRole('button', { name: 'Type a message instead' }).click()
  await input.fill(text)
  await input.press('Enter')
}

await p.goto(`${base}/street?debug&desktop&mode=day`)
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await p.getByRole('button', { name: 'Skip intro' }).click()
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1000)
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(3000)
await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
await sleep(300)
await p.getByRole('button', { name: 'Type instead' }).click()
await sleep(600)

// full tour: Home first, walked
await p.getByRole('button', { name: 'Show the whole conversation' }).click().catch(() => {})
await type('Tell me everything about Naveen')
await sleep(1500)
expect((await guide()).some((g) => /Let me give you the tour/.test(g)) && (await guide()).some((g) => /personal side/.test(g)), 'tour starts: "Let me give you the tour" → "Let’s start with the personal side"')
let prev = await pos()
let maxStep = 0
let prevT = Date.now()
const home = await until(async () => {
  const q = await pos()
  { const now = Date.now(); if ((q.x > 300) === (prev.x > 300)) maxStep = Math.max(maxStep, Math.hypot(q.x - prev.x, q.z - prev.z) / Math.max(0.05, (now - prevT) / 1000)); prevT = now }
  prev = q
  return /Ready for the next stop/.test(await lastGuide())
}, 90000)
expect(home && /This is Naveen’s home/.test(await lastGuide()), `arrives Home, introduces it, waits: "${(await lastGuide()).slice(0, 60)}…"`)
expect(maxStep < 15, `walked there (fastest ${maxStep.toFixed(1)} m/s — a jog is ~5.6, a teleport would be far more)`)
await p.screenshot({ path: 'qa-screens/610-tour-home.png' })

// a question mid-tour, then the offer to continue
await type('What tools does he use?')
await sleep(900)
expect(/Figma.*Want to continue the tour\?$/.test(await lastGuide()), 'question answered, then "Want to continue the tour?"')
await type('yes')
await sleep(1200)
expect(/where his academic journey began/.test((await guide()).slice(-2).join(' ')), '"yes" walks on to Education')
const edu = await until(async () => /Ready for the next stop/.test(await lastGuide()), 120000)
expect(edu && /This is Education\. He did a B\.Sc\. in Computer Science from 2016 to 2019, then an M\.Sc\. from 2019 to 2021/.test(await lastGuide()), 'Education stop: degrees from the data')

// skip, then stop the tour
await type('skip this')
await sleep(1200)
expect(/professional side/.test(await lastGuide()) || (await guide()).slice(-2).some((g) => /professional side/.test(g)), '"skip this" moves on (to NFC Solutions)')
await sleep(2500)
await type('stop the tour')
await sleep(1500)
const a = await pos()
await sleep(1500)
const c = await pos()
expect(/I’ll stay with you/.test(await lastGuide()) && Math.hypot(c.x - a.x, c.z - a.z) < 0.4, '"stop the tour": stays put, hands over')

// project tour: walks to the first screen and opens it
await type('show me all the projects')
const first = await until(async () => /This is TASK\..*Would you like to explore this project further, or should I show you the next one\?/.test(await lastGuide()), 120000)
await sleep(1500) // the case study slides in
const title = await p.evaluate(() => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent ?? null)
expect(first && title === 'TASK', `project tour: walked to TASK, opened its case study, asked before moving on (${title})`)
await p.screenshot({ path: 'qa-screens/611-tour-task.png' })
await type('next')
const second = await until(async () => /This is KidPool\./.test(await lastGuide()), 60000)
expect(second, '"next" → KidPool')

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
console.log('errors:', errors.length ? errors : 'none')
await b.close()
