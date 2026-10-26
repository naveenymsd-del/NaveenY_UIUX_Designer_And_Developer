// The front door: the plain address opens the classic portfolio (/mindspace); its
// "Explore the 3D Portfolio" button opens the city; /street still opens the city directly.
// Usage: node scripts/qa-front-door.mjs [baseUrl]   (baseUrl ends without a slash)
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })).newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  await p.goto(`${base}/`)
  await p.waitForSelector('.ms', { timeout: 60000 })
  expect(/\/mindspace$/.test(new URL(p.url()).pathname), `${tag}: the plain address opens the classic portfolio (${new URL(p.url()).pathname})`)
  expect(await p.evaluate(() => !document.querySelector('.ui-layer')), `${tag}: the 3D city is not loaded behind it`)
  // the headset intro plays first; skip it like a visitor would
  await p.getByRole('button', { name: /Skip intro/i }).click({ timeout: 20000 }).catch(() => {})
  await sleep(3000)
  const btn = p.getByRole('link', { name: /Explore the 3D Portfolio/ }).first()
  await btn.waitFor({ timeout: 30000 })
  await sleep(1500)
  expect(await btn.isVisible(), `${tag}: "Explore the 3D Portfolio" is visible`)
  await p.screenshot({ path: `qa-screens/front-door-${w}.png` })
  await btn.click()
  const city = await p.waitForSelector('.ui-layer', { timeout: 60000 }).then(() => true, () => false)
  expect(city && /\/street$/.test(new URL(p.url()).pathname), `${tag}: the button opens the 3D city (${new URL(p.url()).pathname})`)
  // a direct link to the city still opens the city
  await p.goto(`${base}/street`)
  const direct = await p.waitForSelector('.ui-layer', { timeout: 60000 }).then(() => true, () => false)
  expect(direct, `${tag}: /street opens the 3D city directly`)
  expect(errors.length === 0, `${tag}: no page errors ${errors.join(' | ')}`)
  await p.context().close()
}
await b.close()
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall front-door checks passed')
process.exit(problems.length ? 1 : 0)
