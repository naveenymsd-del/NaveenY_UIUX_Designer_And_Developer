// Project Studio QA: every bay → E → Overview + Challenges + prototype link → Esc;
// previous/next; AI guide project commands; movement after closing.
// Usage: node scripts/qa-projects.mjs [1440x900] [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const vp = process.argv[2] ? process.argv[2].split('x').map(Number) : [1440, 900]
const base = process.argv[3] ?? 'http://localhost:5173'
const tag = `${vp[0]}x${vp[1]}`
const mobile = vp[0] < 700
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile })).newPage()
const errors = []
const problems = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const shot = (n) => p.screenshot({ path: `qa-screens/3${n}-${tag}.png` })
const title = () => p.evaluate(() => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent ?? null)
const pos = () => p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 }))

// mirrors src/data/projects.ts (order) and STUDIO bays in src/data/interiors.ts, office origin x = 320
const PROJECTS = [
  { title: 'TASK', proto: 'vUIgk3l5i7TXJwCPXHq7xu', bay: [21.6, -6.2, Math.PI / 2] },
  { title: 'KidPool', proto: 'UkougomRKZEjdNS0EC1Twf', bay: [21.6, -2.8, Math.PI / 2] },
  { title: 'Spyder', proto: 'i852L2XjU3cEM6LpoRVOWN', bay: [21.6, 0.6, Math.PI / 2] },
]
const REMOVED = ['IntelliStaff', 'Ebounti', 'WasteBeMinerals', 'ServiceNow', 'Calmscient', 'INTA']

await p.goto(`${base}/street?debug${mobile ? '' : '&desktop'}`)
await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
await p.keyboard.press('Escape')
await sleep(2400)
await p.getByRole('button', { name: 'View my work' }).click()
await p.waitForFunction(() => (window.__mindscape?.x ?? 0) > 300, null, { timeout: 60000 })
await sleep(4500)
await shot('00-studio')

for (const [i, pr] of PROJECTS.entries()) {
  const [x, z, yaw] = pr.bay
  await p.evaluate(([x, z, yaw]) => window.__teleport(320 + x, z, yaw), [x, z, yaw])
  await sleep(1600)
  const prompt = await p.evaluate(() => document.querySelector('.ui-prompt.is-visible .ui-prompt__name')?.textContent ?? null)
  expect(prompt === pr.title, `bay ${i + 1}: prompt shows "${prompt}"`)
  await p.keyboard.press('KeyE')
  await sleep(2200)
  expect((await title()) === pr.title, `bay ${i + 1}: case study opens "${await title()}"`)
  const r = await p.evaluate(() => {
    const c = document.querySelector('.ui-case.is-visible')
    const a = c?.querySelector('.ui-case__titlerow a.ui-case__proto')
    return {
      tabs: c?.querySelectorAll('[role=tab], [role=tablist]').length ?? -1,
      heads: [...(c?.querySelectorAll('.ui-case__section h3') ?? [])].map((h) => h.textContent.trim()),
      overview: c?.querySelectorAll('.ui-case__section:first-of-type p').length ?? 0,
      challenges: c?.querySelectorAll('.ui-case__challenges li').length ?? 0,
      href: a?.getAttribute('href') ?? '',
      target: a?.getAttribute('target') ?? '',
      label: a?.textContent.trim() ?? '',
      count: c?.querySelector('.ui-case__count')?.textContent ?? '',
      brackets: /\[[^\]]+\]/.test(c?.textContent ?? ''),
    }
  })
  expect(r.tabs === 0, `  no tab navigation (${r.tabs})`)
  expect(r.heads.join('|') === '01 Overview|02 Challenges', `  sections: ${r.heads.join(' | ')}`)
  expect(r.overview >= 2 && r.challenges >= 3, `  ${r.overview} overview paragraphs, ${r.challenges} challenges`)
  expect(r.href.includes(`figma.com/proto/${pr.proto}/`) && r.target === '_blank', `  prototype button → ${r.href.slice(0, 60)}… (new tab: ${r.target === '_blank'})`)
  expect(r.count === `Project 0${i + 1} / 0${PROJECTS.length}`, `  count "${r.count}"`)
  expect(!r.brackets, '  no placeholders')
  await shot(`1${i}-${pr.title}`)
  await p.locator('.ui-case__scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await sleep(500)
  await shot(`1${i}-${pr.title}-challenges`)
  await p.keyboard.press('Escape')
  await sleep(1500)
  expect((await title()) === null, `bay ${i + 1}: Esc closes`)
}

// movement resumes after closing
const before = await pos()
await p.keyboard.down('KeyS')
await sleep(900)
await p.keyboard.up('KeyS')
await sleep(300)
const after = await pos()
expect(Math.hypot(after.x - before.x, after.z - before.z) > 0.5, `player moves after closing (${Math.hypot(after.x - before.x, after.z - before.z).toFixed(2)} m)`)

// prototype opens in a new tab and the portfolio stays put
await p.evaluate(() => window.__teleport(320 + 21.6, -6.2, Math.PI / 2))
await sleep(1500)
await p.keyboard.press('KeyE')
await sleep(2200)
const [popup] = await Promise.all([p.context().waitForEvent('page', { timeout: 8000 }).catch(() => null), p.locator('.ui-case__proto').click()])
expect(!!popup, `prototype opened a new tab: ${popup ? popup.url().slice(0, 60) : 'none'}`)
if (popup) await popup.close()
expect((await title()) === 'TASK', 'portfolio kept its state after opening the prototype')

// previous / next cycle the verified list only
const seen = []
for (let k = 0; k < PROJECTS.length; k++) {
  await p.getByRole('button', { name: /Next project/ }).click()
  await sleep(2200)
  seen.push(await title())
}
expect(seen.join('>') === 'KidPool>Spyder>TASK', `next cycles ${seen.join(' > ')}`)
await p.getByRole('button', { name: /Previous project/ }).click()
await sleep(2200)
expect((await title()) === 'Spyder', `previous from TASK → "${await title()}"`)
await p.getByRole('button', { name: /Back to Project Studio/ }).click()
await sleep(1500)

// AI guide
const ask = async (text) => {
  await p.getByRole('button', { name: /Open your guide/ }).click()
  await sleep(500)
  await p.getByLabel('Ask the guide where you want to go').fill(text)
  await p.keyboard.press('Enter')
}
const chips = await p.evaluate(() => [...document.querySelectorAll('.ui-guide__projects button')].map((b) => b.textContent.replace(/^\d+/, '')))
expect(chips.join(',') === 'TASK,KidPool,Spyder', `guide project buttons: ${chips.join(', ')}`)
for (const cmd of ['Show TASK', 'Open KidPool', 'show spyder']) {
  await ask(cmd)
  await sleep(2800)
  const t = await title()
  expect(!!t && cmd.toLowerCase().includes(t.toLowerCase()), `guide "${cmd}" → "${t}"`)
  await p.keyboard.press('Escape')
  await sleep(1400)
}
for (const gone of ['Show IntelliStaff', 'Open Calmscient', 'show ServiceNow']) {
  await ask(gone)
  await sleep(1500)
  expect((await title()) === null, `guide "${gone}" opens nothing`)
  await p.keyboard.press('Escape')
  await sleep(500)
}
// from the street
await p.getByRole('button', { name: 'Back outside' }).click().catch(() => {})
await sleep(2500)
await ask('open kidpool')
await p.waitForFunction(() => document.querySelector('.ui-case.is-visible .ui-case__title')?.textContent === 'KidPool', null, { timeout: 40000 }).catch(() => {})
await sleep(800)
expect((await title()) === 'KidPool', `guide "open kidpool" (from street) → "${await title()}"`)
await shot('50-guide-from-street')

const text = await p.evaluate(() => document.body.innerText)
const leaks = REMOVED.filter((n) => new RegExp(`\\b${n}\\b`, 'i').test(text))
expect(!leaks.length, `no removed project names on the page${leaks.length ? `: ${leaks.join(', ')}` : ''}`)

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
console.log('errors:', errors.length ? errors : 'none')
await b.close()
