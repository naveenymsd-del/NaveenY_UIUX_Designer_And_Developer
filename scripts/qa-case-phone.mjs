// Phone check of the case-study header: opens TASK and photographs the top of the panel.
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
for (const [w, h] of [[390, 844], [360, 740]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })).newPage()
  await p.goto('http://localhost:5173/street?debug')
  await p.waitForFunction(() => window.__intro && window.__intro.running, null, { timeout: 90000 })
  await p.keyboard.press('Escape')
  await sleep(2400)
  await p.evaluate(() => window.__viewWork()) // (the hero's "View my work" shortcut was removed; the same journey)
  await p.waitForFunction(() => (window.__mindscape?.x ?? 0) > 300, null, { timeout: 60000 })
  await sleep(3000)
  await p.evaluate(() => window.__teleport(341.6, -6.2, Math.PI / 2))
  await sleep(1500)
  await p.keyboard.press('KeyE')
  await sleep(2500)
  const r = await p.evaluate(() => {
    const q = (s) => document.querySelector(s)?.getBoundingClientRect()
    const btns = [...document.querySelectorAll('.ui-case__actions .ui-pc-btn')].map((e) => Math.round(e.getBoundingClientRect().height))
    return { close: q('.ui-case__close'), btnHeights: btns, overflowX: document.querySelector('.ui-case__scroll').scrollWidth > document.querySelector('.ui-case__scroll').clientWidth }
  })
  console.log(w, JSON.stringify(r))
  await p.screenshot({ path: `qa-screens/pc-phone-${w}.png` })
  await p.context().close()
}
await b.close()
