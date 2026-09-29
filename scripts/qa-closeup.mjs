// Studio close-ups of the avatar and the companion (debug camera override).
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage()
await p.goto('http://localhost:5173/street?debug&desktop')
await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
await p.keyboard.press('Escape')
await sleep(2500)
const S = [0, 0.16, 72.5]
const shots = [
  ['front', [S[0] + 0.5, 1.45, S[2] + 2.3], [S[0], 1.05, S[2]]],
  ['face', [S[0] + 0.25, 1.72, S[2] + 0.75], [S[0], 1.64, S[2]]],
  ['side', [S[0] + 2.4, 1.3, S[2] + 0.5], [S[0], 1.0, S[2]]],
  ['back', [S[0] - 0.4, 1.4, S[2] - 2.3], [S[0], 1.0, S[2]]],
  ['ai', [S[0] + 0.9, 1.95, S[2] + 0.55], [S[0] + 0.82, 1.9, S[2] - 0.3]],
]
for (const [name, pos, tgt] of shots) {
  await p.evaluate(([a, t]) => window.__shot(a, t), [pos, tgt])
  await sleep(1900)
  await p.screenshot({ path: `qa-screens/99-close-${name}.png` })
}
await b.close()
