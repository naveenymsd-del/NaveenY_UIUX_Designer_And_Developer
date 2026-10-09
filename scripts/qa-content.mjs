// Content QA: the résumé content in every place — AI guide answers, Home boards,
// Education, NFC Solutions, the Gallery (easels + AI area), the Contact Café and
// the minimap — and that no placeholder or removed section is visible anywhere.
// Usage: node scripts/qa-content.mjs [1440x900] [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const vp = process.argv[2] ? process.argv[2].split('x').map(Number) : [1440, 900]
const base = process.argv[3] ?? 'http://localhost:5173'
const tag = `${vp[0]}x${vp[1]}`
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: vp[0], height: vp[1] } })).newPage()
const errors = []
const problems = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const shot = (n) => p.screenshot({ path: `qa-screens/4${n}-${tag}.png` })
const where = () => p.evaluate(() => document.querySelector('.ui-where b')?.textContent ?? '')
// rooms sit far east of the street (data/interiors.ts origins): infer the room from the position
const ROOM_OF = (x, z) => (x < 300 ? null : Math.abs(z - 120) < 20 ? 'home' : Math.abs(z + 120) < 20 ? 'education' : Math.abs(z - 240) < 20 ? 'cafe' : Math.abs(z) < 20 ? 'office' : '?')
const interior = () => p.evaluate(() => [window.__mindscape?.x ?? 0, window.__mindscape?.z ?? 0]).then(([x, z]) => ROOM_OF(x, z))
const waitRoom = async (room) => { for (let t = 0; t < 30000 && (await interior()) !== room; t += 250) await sleep(250) }
const BANNED = /\[ADD|\[PLACEHOLDER|lorem ipsum|\bTBD\b|coming soon|My Journey|How I Design|Career Journey|Looking Ahead|Certificate [23]|myProfile|portfolio\.link|Spyder/i
const seenText = []
const panel = async () => {
  const r = await p.evaluate(() => {
    const el = document.querySelector('.ui-panel.is-visible')
    return el ? { title: el.querySelector('.ui-panel__title')?.textContent ?? '', text: el.innerText } : null
  })
  if (r) seenText.push(r.text)
  return r
}

await p.goto(`${base}/street?debug&desktop&mode=day`)
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await p.getByRole('button', { name: 'Skip intro' }).click()
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1000)
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(5000)

// ── minimap + guide quick links
const markers = await p.evaluate(() => [...document.querySelectorAll('.ui-minimap__marker')].map((m) => m.textContent.trim()))
expect(markers.join('|').includes('DESIGN JOURNEY'), `minimap stops: ${markers.join(' · ')}`)
await p.getByRole('button', { name: /Open your guide/ }).click()
await sleep(500)
const quick = await p.evaluate(() => [...document.querySelectorAll('.ui-guide__quick button')].map((b) => b.textContent.trim()))
expect(quick.join('|') === 'Home|Education|NFC Solutions|Projects|Design Journey|Contact Café', `guide quick links: ${quick.join(' · ')}`)
await shot('00-guide')
await p.getByRole('button', { name: 'Close guide' }).click()
await sleep(400)

// ── guide answers: the companion replies, then travels
const ask = async (q) => {
  await p.getByRole('button', { name: /Open your guide/ }).click()
  await sleep(400)
  await p.getByLabel('Ask the guide where you want to go').fill(q)
  await p.keyboard.press('Enter')
}
const QUESTIONS = [
  ['What does Naveen do?', 'UI/UX and Product Designer with 4+ years', 'home'],
  ['What tools does Naveen use?', 'Figma, Figma Make, Adobe XD', 'home'],
  ['What AI tools does Naveen use?', 'remains responsible for UX judgment', null],
  ['How does he use AI?', 'remains responsible for UX judgment', null],
  ['Where did Naveen study?', 'M.Sc. in Computer Science (2019–2021', 'education'],
  ["What is Naveen's experience?", 'NFC Solutions India Pvt. Ltd., Hyderabad, India, since May 2022', 'office'],
  ['How can I contact Naveen?', 'naveenyarramallugalla@gmail.com', 'cafe'],
]
for (const [q, want, room] of QUESTIONS) {
  await ask(q)
  await sleep(1300)
  const said = await p.evaluate(() => document.querySelector('.ui-bubble')?.textContent ?? '')
  expect(said.includes(want), `"${q}" → ${said.slice(0, 90)}…`)
  // the trip takes 8–12 s depending on where it starts: wait for the room rather than a fixed time
  if (room) { await waitRoom(room); await sleep(7000) } // (let the door transition and the room’s welcome line finish, as a visitor would)
  else await sleep(10500)
  const r = await interior()
  if (room) expect(r === room, `  travelled to ${r ?? 'street'} (${await where()})`)
  else expect(r === null, `  travelled to the street: ${await where()}`)
}

// ── Home boards (room-local positions from data/interiors.ts, origin [320, 0, 120])
await ask('take me home')
await waitRoom('home')
await sleep(3500)
const HOME = [
  ['hello', 0, 3.4, 'Hi, I’m Naveen.', 'UI/UX Designer · Product Designer'],
  ['skills', -7.1, 3.9, 'What I work with', 'Heuristic Evaluation'],
  ['aiWorkflow', 7.2, -2.2, 'AI helps me explore. I make the design decisions.', 'Human judgment'],
  ['galleryEntry', 6.7, -5.2, 'Selected work & interests', 'Go to the Design Journey'],
  ['desk', -1.2, -4.5, 'UI/UX Designer', 'May 2022 – Present'],
  ['laptop', 1.4, -4.5, 'Tools I work with', 'Google Stitch'],
  ['window', -4.8, -5.1, 'Interests', 'Pencil Art & Sketching · Cricket · Dance'],
]
for (const [kind, x, z, title, has] of HOME) {
  await p.evaluate(([x, z]) => window.__teleport(320 + x, 120 + z + 0.6, Math.PI), [x, z])
  await sleep(1200)
  await p.keyboard.press('KeyE')
  await sleep(1800)
  const r = await panel()
  expect(r?.title === title && r.text.includes(has), `home ${kind}: "${r?.title}" (has "${has}": ${!!r?.text.includes(has)})`)
  await shot(`1-home-${kind}`)
  await p.keyboard.press('Escape')
  await sleep(900)
}

// ── Education
await ask('show my education')
await waitRoom('education')
await sleep(3500)
for (const [kind, x, z, has] of [['timeline', -10.2, 0, 'CSSR & SRRM Degree and PG College, Kadapa · CGPA 8.1'], ['certificates', 10.2, 1.4, 'Tech Mahindra Smart Academy · 2021']]) {
  await p.evaluate(([x, z]) => window.__teleport(320 + x + (x < 0 ? 1.2 : -1.2), -120 + z, x < 0 ? -Math.PI / 2 : Math.PI / 2), [x, z])
  await sleep(1300)
  await p.keyboard.press('KeyE')
  await sleep(1800)
  const r = await panel()
  expect(!!r?.text.includes(has), `education ${kind}: "${r?.title}"`)
  await shot(`2-education-${kind}`)
  await p.keyboard.press('Escape')
  await sleep(900)
}

// ── NFC Solutions
await ask('NFC')
await waitRoom('office')
await sleep(3500)
for (const [kind, x, z, has] of [['reception', -3.6, 6.4, 'End-to-end ownership of UX and UI'], ['workspace', 11, 5.0, 'Enterprise SaaS · Healthcare · Recruitment / HR Tech']]) {
  await p.evaluate(([x, z]) => window.__teleport(320 + x, z + 0.5, Math.PI), [x, z])
  await sleep(1300)
  await p.keyboard.press('KeyE')
  await sleep(1800)
  const r = await panel()
  expect(!!r?.text.includes(has), `office ${kind}: "${r?.title}"`)
  await shot(`3-office-${kind}`)
  await p.keyboard.press('Escape')
  await sleep(900)
}

// ── Gallery: easels open the viewer on that project's screens; AI area
await ask('gallery')
await sleep(9000)
expect((await interior()) === null, `gallery stop: ${await where()}`)
await shot('4-gallery-arrive')
await p.evaluate(() => window.__teleport(-21.6 + 0.6, 21.2 + 1.2, Math.PI))
await sleep(1500)
await shot('4-gallery-easel')
await p.keyboard.press('KeyE')
await sleep(1200)
const g = await p.evaluate(() => ({ open: !!document.querySelector('.ui-gallery'), cap: document.querySelector('.ui-gallery figcaption')?.textContent ?? '', ok: (() => { const i = document.querySelector('.ui-gallery img'); return !!i && i.complete && i.naturalWidth > 0 })() }))
expect(g.open && g.cap.includes('TASK'), `easel opens gallery: "${g.cap}"`)
await sleep(800)
await shot('4-gallery-viewer')
await p.keyboard.press('ArrowRight')
await sleep(500)
expect((await p.evaluate(() => document.querySelector('.ui-gallery figcaption')?.textContent ?? '')).includes('Tickets'), 'gallery → next image')
await p.keyboard.press('Escape')
await sleep(600)
expect(!(await p.evaluate(() => !!document.querySelector('.ui-gallery'))), 'Esc closes the gallery')
await p.evaluate(() => window.__teleport(-25.5 + 2.5, 25 + 2.5, Math.PI * 0.75))
await sleep(1500)
await p.keyboard.press('KeyE')
await sleep(1800)
const ai = await panel()
expect(ai?.title === 'AI helps me explore. I make the design decisions.' && ai.text.toLowerCase().includes('05 — human judgment'), `AI area: "${ai?.title}"`)
await shot('4-gallery-ai')
await p.keyboard.press('Escape')
await sleep(800)

// ── Contact Café
await ask("let's connect")
await waitRoom('cafe')
await sleep(3500)
await p.evaluate(() => window.__teleport(320 + 3.4, 240 - 2.6 + 1.7, Math.PI))
await sleep(1500)
await p.keyboard.press('KeyE')
await sleep(6800)
await p.getByRole('button', { name: 'Skip' }).click()
await sleep(1200)
const c = await p.evaluate(() => ({
  h: document.querySelector('.ui-cafe h2')?.textContent,
  who: document.querySelector('.ui-cafe__who')?.textContent,
  links: [...document.querySelectorAll('.ui-cafe .ui-contact a')].map((a) => [a.querySelector('.ui-contact__label')?.textContent, a.getAttribute('href')]),
}))
expect(c.h === 'Let’s talk.', `café heading "${c.h}"`)
expect(c.who === 'Naveen Y · UI/UX Designer · Product Designer · Hyderabad, India', `café identity "${c.who}"`)
const RESUME = '/resume/Naveen_Yarramallugalla_UIUX_Designer_Resume.pdf'
expect(JSON.stringify(c.links) === JSON.stringify([['Email Me', 'mailto:naveenyarramallugalla@gmail.com'], ['Call', 'tel:+917036282178'], ['LinkedIn ↗', 'https://www.linkedin.com/in/naveen-yarramallugalla-782361238'], ['View Resume ↗', RESUME], ['Download Resume ↓', RESUME]]), `café buttons ${JSON.stringify(c.links)}`)
// the résumé: View opens the PDF in a new tab; Download saves the very same file under a clear name
{
  const [tab] = await Promise.all([p.context().waitForEvent('page', { timeout: 10000 }).catch(() => null), p.locator('.ui-cafe .ui-contact a', { hasText: 'View Resume' }).click()])
  const res = tab ? await p.request.get(tab.url()) : null
  const pdf = res ? await res.body() : null
  expect(!!tab && /Naveen_Yarramallugalla_UIUX_Designer_Resume\.pdf$/.test(tab.url()) && res.status() === 200 && pdf?.subarray(0, 5).toString() === '%PDF-', `View Resume → opens the PDF in a new tab (${res?.status()}, ${pdf ? Math.round(pdf.length / 1024) : 0} KB)`)
  if (tab) await tab.close()
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }).catch(() => null), p.locator('.ui-cafe .ui-contact a', { hasText: 'Download Resume' }).click()])
  const size = dl ? (await import('node:fs')).statSync(await dl.path()).size : 0
  expect(!!dl && dl.suggestedFilename() === 'Naveen_Yarramallugalla_UIUX_Designer_Resume.pdf' && size === pdf?.length, `Download Resume → saves "${dl?.suggestedFilename()}" (${Math.round(size / 1024)} KB)`)
}
await shot('5-cafe-connect')

// ── nothing banned anywhere we looked, nor in the menu
await p.getByRole('button', { name: 'Finish the journey' }).click()
await sleep(800)
await p.getByRole('button', { name: 'Stand up and keep exploring' }).click()
await sleep(1200)
const menu = await p.evaluate(() => document.querySelector('#site-menu')?.textContent ?? '')
const all = [...seenText, menu, await p.evaluate(() => document.body.innerText)].join('\n')
const hit = all.match(BANNED)
expect(!hit, `no placeholder / removed content visible${hit ? `: "${hit[0]}"` : ''}`)

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
console.log('errors:', errors.length ? errors : 'none')
await b.close()
