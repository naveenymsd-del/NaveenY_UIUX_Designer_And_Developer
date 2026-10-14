// Screenshots of the welcome screen (city preview) at a few sizes: ready state, a destination
// chosen, and a question asked. Usage: node scripts/qa-welcome-shots.mjs [baseUrl]
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
for (const [w, h, touch] of [[1440, 900, false], [1366, 768, false], [820, 1180, true], [390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })).newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  await p.goto(`${base}/street?mode=day${touch ? '' : '&desktop'}`)
  await p.waitForSelector('.wl.is-ready', { timeout: 120000 })
  await sleep(2500)
  await p.screenshot({ path: `qa-screens/wl-${w}-ready.png` })
  await p.locator('.wl-dests button', { hasText: 'Projects' }).click()
  await sleep(900)
  await p.locator('.wl-ai__compose input').fill('What design tools does he use?')
  await p.keyboard.press('Enter')
  await sleep(1500)
  await p.screenshot({ path: `qa-screens/wl-${w}-projects.png` })
  console.log(w, 'errors:', errors.length ? errors.join(' | ') : 'none')
  await p.context().close()
}
await b.close()
