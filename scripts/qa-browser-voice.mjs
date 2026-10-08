// Browser voice — the default, free voice mode — end to end in the browser,
// with no voice or guide endpoint configured (no API key anywhere).
//
// Headless Chrome has no speech engine, so this replaces the two browser
// APIs at their edges: a scripted SpeechRecognition (the test "says" a
// sentence → the browser's transcript) and a speechSynthesis that records
// what would be spoken and takes time to say it. Everything between them is
// the real portfolio: consent, the guide's brain, the action router, guided
// walking, tours, barge-in, the microphone controls and the fallbacks.
// No AI service is involved or imitated — the answers come from the guide's
// built-in brain, exactly as on the live site.
//
// Usage: node scripts/qa-browser-voice.mjs [baseUrl]   (dev server without VITE_* endpoints)
import { chromium } from 'playwright-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const base = process.argv[2] ?? 'http://localhost:5173'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const until = async (fn, ms) => { for (let t = 0; t < ms; t += 150) { if (await fn()) return true; await sleep(150) } return false }

/** the two speech APIs, scripted (installed before the app loads) */
function speechStubs({ recognition = true, synthesis = true } = {}) {
  return ({ recognition, synthesis }) => {
    window.__recLog = []
    window.__spoken = []
    window.__cancels = 0
    if (recognition) {
      class FakeRecognition {
        constructor() { window.__rec = this; this.running = false }
        start() { if (this.running) throw new Error('InvalidStateError'); this.running = true; window.__recLog.push('start') }
        stop() { this.abort() }
        abort() { if (!this.running) return; this.running = false; window.__recLog.push('abort'); setTimeout(() => this.onend?.(), 10) }
      }
      window.SpeechRecognition = FakeRecognition
      window.webkitSpeechRecognition = FakeRecognition
      /** the visitor says something: what the browser's recogniser would report */
      window.__hear = (text, final = true) => {
        const r = window.__rec
        if (!r || !r.running) return false
        const alt = [{ transcript: text }]
        alt.isFinal = final
        r.onresult?.({ resultIndex: 0, results: [alt] })
        return true
      }
    } else {
      window.SpeechRecognition = undefined
      window.webkitSpeechRecognition = undefined
    }
    if (synthesis) {
      const synth = {
        speaking: false, pending: false, queue: [],
        getVoices: () => [], addEventListener() {},
        cancel() {
          const q = this.queue
          this.queue = []
          this.speaking = false
          if (q.length) window.__cancels++
          for (const u of q) u.onerror?.({ error: 'canceled' })
        },
        speak(u) {
          if (u.text.trim()) window.__spoken.push(u.text)
          this.queue.push(u)
          if (this.queue.length === 1) this.next()
        },
        next() {
          const u = this.queue[0]
          if (!u) { this.speaking = false; return }
          this.speaking = true
          setTimeout(() => {
            if (this.queue[0] !== u) return
            u.onstart?.()
            setTimeout(() => {
              if (this.queue[0] !== u) return
              this.queue.shift()
              u.onend?.()
              this.next()
            }, Math.max(250, u.text.length * 35))
          }, 20)
        },
      }
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    } else {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
    }
  }
}

async function open(opts, ctxOpts = { viewport: { width: 1440, height: 900 } }) {
  const ctx = await b.newContext(ctxOpts)
  const p = await ctx.newPage()
  const errors = []
  const external = []
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  // nothing may call an AI or voice service: no endpoint is configured
  p.on('request', (r) => {
    const u = r.url()
    // (the app's own source files load from the dev server — e.g. src/ai/voice/realtime.ts — and don't count)
    if ((!u.startsWith(base) && /openai|anthropic|workers\.dev|cloudflare|deepgram|elevenlabs/i.test(u)) || /__voice-session|\/realtime\/session|\/chat\b/.test(u)) external.push(u)
  })
  await p.addInitScript(speechStubs(opts), opts)
  await p.goto(`${base}/street?debug${ctxOpts.isMobile ? '' : '&desktop'}&mode=day`)
  await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
  await p.getByRole('button', { name: 'Skip intro' }).click()
  await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
  await sleep(1000)
  await p.getByRole('button', { name: 'Start exploring' }).click()
  await sleep(3500)
  if (ctxOpts.isMobile) {
    await p.getByRole('button', { name: 'Close tips' }).click().catch(() => {})
    await sleep(800)
  }
  return { p, ctx, errors, external }
}
const helpers = (p) => ({
  guide: () => p.evaluate(() => [...document.querySelectorAll('.ui-voice__log li.is-guide')].map((l) => l.textContent.replace(/^Guide: /, ''))),
  last: () => p.evaluate(() => [...document.querySelectorAll('.ui-voice__log li.is-guide')].pop()?.textContent?.replace(/^Guide: /, '') ?? ''),
  users: () => p.evaluate(() => document.querySelectorAll('.ui-voice__log li.is-user:not(.is-interim)').length),
  hear: (t, final = true) => p.evaluate(([t, f]) => window.__hear(t, f), [t, final]),
  spoken: () => p.evaluate(() => window.__spoken.join(' ')),
  speaking: () => p.evaluate(() => window.speechSynthesis?.speaking ?? false),
  recRunning: () => p.evaluate(() => !!window.__rec?.running),
  pos: () => p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 })),
  power: () => p.evaluate(() => document.querySelector('.ui-voice__power')?.textContent ?? ''),
})

// ── 1. desktop Chrome / Edge: recognition + synthesis ──────────────────────
{
  const { p, ctx, errors, external } = await open({ recognition: true, synthesis: true })
  const h = helpers(p)
  // show every line, not only the latest exchange
  await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
  await sleep(300)
  const consent = await p.evaluate(() => document.querySelector('.ui-voice__consent')?.textContent ?? '')
  expect(/uses your microphone so I can hear you/.test(consent) && /doesn’t store your voice recordings/.test(consent), 'consent: required microphone copy')
  expect(/Browser voice/.test(consent) && /not live speech-to-speech/.test(consent), 'consent: says plainly this is browser voice, not live speech-to-speech')
  expect(!(await h.recRunning()), 'microphone not started before consent')
  await p.getByRole('button', { name: 'Turn on voice' }).click()
  await sleep(1500)
  expect(await h.recRunning(), 'after "Turn on voice": browser recognition listening')
  expect((await h.power()).includes('Browser voice'), `mode shown as "${await h.power()}" (never "live")`)
  expect(/Just talk to me naturally/.test(await h.spoken()), 'greeting read aloud by browser speech synthesis')
  await until(async () => !(await h.speaking()), 8000)

  // a spoken question → the built-in brain → shown and spoken
  await p.evaluate(() => { window.__spoken.length = 0 })
  await h.hear('What does Naveen do?')
  await sleep(900)
  const a1 = await h.last()
  expect(/UI\/UX and Product Designer/.test(a1), `spoken question answered: "${a1.slice(0, 60)}…"`)
  expect((await h.spoken()).includes('Product Designer'), 'answer read aloud (same words)')
  await until(async () => !(await h.speaking()), 15000)

  // follow-up with a pronoun
  await h.hear('Where does he work?')
  await sleep(900)
  expect(/NFC Solutions/.test(await h.last()), `pronoun "he" → Naveen: "${(await h.last()).slice(0, 60)}…"`)
  await until(async () => !(await h.speaking()), 15000)

  // barge-in: talk over a long answer
  await h.hear('Explain everything about TASK')
  await until(() => h.speaking(), 4000)
  const cancels0 = await p.evaluate(() => window.__cancels)
  await sleep(600)
  await h.hear('wait')
  await sleep(600)
  expect((await p.evaluate(() => window.__cancels)) > cancels0 && /^Yep\?/.test(await h.last()), `barge-in: "wait" cuts the speech off → "${await h.last()}"`)
  await until(async () => !(await h.speaking()), 6000)

  // its own voice coming back through the speakers is not taken as the visitor
  await h.hear('What is KidPool?')
  await until(() => h.speaking(), 4000)
  const said = (await h.last()).split(' ').slice(0, 6).join(' ')
  const before = await h.users()
  await h.hear(said, false)
  await sleep(300)
  expect((await h.users()) === before && (await h.speaking()), `echo of its own words ignored ("${said}")`)
  await until(async () => !(await h.speaking()), 15000)

  // "actually …" — answer what follows
  await h.hear('actually, what tools does he use?')
  await sleep(900)
  expect(/Figma/.test(await h.last()), '"actually, …" answers the corrected question')
  await until(async () => !(await h.speaking()), 15000)

  // stop listening by voice, then a tap on the orb to talk again
  await h.hear('stop listening')
  await sleep(700)
  expect(!(await h.recRunning()) && /stopped listening/.test(await h.last()), `"stop listening": microphone paused, told so (rec ${await h.recRunning()}, "${await h.last()}")`)
  expect(!(await h.hear('hello')), 'nothing is heard while paused')
  await until(async () => !(await h.speaking()), 8000)
  await p.getByRole('button', { name: 'Start listening' }).click()
  await sleep(600)
  expect(await h.recRunning(), 'tap the orb: listening again')

  // guided tour by voice: walks (no teleport), pause, continue, explain, takeover
  await h.hear('Give me a tour')
  await sleep(2500)
  const t0 = await h.pos()
  await sleep(1500)
  const t1 = await h.pos()
  expect(Math.hypot(t1.x - t0.x, t1.z - t0.z) > 0.8, 'tour: character walking')
  await h.hear('pause')
  await sleep(1200)
  const q0 = await h.pos()
  await sleep(1500)
  const q1 = await h.pos()
  expect(Math.hypot(q1.x - q0.x, q1.z - q0.z) < 0.4 && /Paused/.test(await h.last()), `"pause": stops and says "${await h.last()}"`)
  await until(async () => !(await h.speaking()), 8000)
  await h.hear('continue')
  let prev = await h.pos()
  let maxStep = 0
  const home = await until(async () => {
    const q = await h.pos()
    if ((q.x > 300) === (prev.x > 300)) maxStep = Math.max(maxStep, Math.hypot(q.x - prev.x, q.z - prev.z))
    prev = q
    return /Ready for the next stop/.test(await h.last())
  }, 90000)
  expect(home && maxStep < 2, `"continue": walked on to Home and introduced it (largest step ${maxStep.toFixed(2)} m — no teleport)`)
  await until(async () => !(await h.speaking()), 15000)
  await h.hear('explain')
  await sleep(900)
  expect(/home|Home/.test(await h.last()) && /Want to continue the tour\?$/.test(await h.last()), `"explain" at Home explains Home, then offers to continue: "${(await h.last()).slice(0, 50)}…"`)
  await until(async () => !(await h.speaking()), 20000)
  await h.hear('yes')
  await sleep(4000)
  await p.keyboard.down('KeyW')
  await sleep(600)
  await p.keyboard.up('KeyW')
  await sleep(900)
  expect(/you’re driving/.test(await h.last()), `keyboard takes over at once: "${await h.last()}"`)
  await until(async () => !(await h.speaking()), 10000)

  // voice off: recognition released, nothing listening
  await p.getByRole('button', { name: 'Turn voice off' }).click()
  await sleep(500)
  const log = await p.evaluate(() => window.__recLog)
  expect(!(await h.recRunning()) && log[log.length - 1] === 'abort', 'voice off: recognition stopped')
  expect(!(await p.evaluate(() => document.querySelector('.ui-voice')?.className.includes('is-on'))), 'voice off: dock back to "Talk to me"')
  expect(external.length === 0, `no request to any AI or voice service (${external.join(", ") || "none"})`)
  expect(errors.length === 0, `no console errors (${errors.join(' | ').slice(0, 120)})`)
  await p.screenshot({ path: 'qa-screens/620-browser-voice.png' })
  await ctx.close()
}

// ── 2. Firefox-like: no speech recognition, synthesis available ───────────
{
  const { p, ctx, errors } = await open({ recognition: false, synthesis: true })
  const h = helpers(p)
  await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
  await sleep(300)
  const consent = await p.evaluate(() => document.querySelector('.ui-voice__consent')?.textContent ?? '')
  expect(/can’t listen/.test(consent) && /read my answers aloud/.test(consent), `no recognition: consent offers typing, answers still spoken`)
  expect(!(await p.getByRole('button', { name: 'Turn on voice' }).isVisible().catch(() => false)), 'no recognition: no "Turn on voice" button')
  await p.getByRole('button', { name: 'Type instead' }).click()
  await sleep(500)
  await p.getByLabel('Message the AI guide').fill('What is TASK?')
  await p.getByLabel('Message the AI guide').press('Enter')
  await sleep(1000)
  expect(/TASK/.test(await h.last()) && (await h.spoken()).includes('TASK'), 'typed question answered and read aloud')
  expect(errors.length === 0, `no console errors (${errors.join(' | ').slice(0, 120)})`)
  await ctx.close()
}

// ── 3. no speech at all: text only ─────────────────────────────────────────
{
  const { p, ctx, errors } = await open({ recognition: false, synthesis: false })
  const h = helpers(p)
  await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
  await sleep(300)
  await p.getByRole('button', { name: 'Type instead' }).click()
  await sleep(500)
  await p.getByLabel('Message the AI guide').fill('How did Naveen build this portfolio?')
  await p.getByLabel('Message the AI guide').press('Enter')
  await sleep(1000)
  expect((await h.last()).length > 40, `no speech APIs: answer shown as text ("${(await h.last()).slice(0, 60)}…")`)
  expect(errors.length === 0, `no console errors (${errors.join(' | ').slice(0, 120)})`)
  await ctx.close()
}

// ── 4. phone: listens and speaks in turns, dock fits ──────────────────────
{
  const { p, ctx, errors } = await open({ recognition: true, synthesis: true }, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const h = helpers(p)
  await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
  await sleep(400)
  await p.getByRole('button', { name: 'Turn on voice' }).click()
  await sleep(300)
  // the mic pauses while the guide talks (its speaker is right next to the mic) …
  const heldWhileSpeaking = await until(async () => (await h.speaking()) && !(await h.recRunning()), 5000)
  expect(heldWhileSpeaking, 'phone: microphone paused while the guide speaks')
  // … and listens again as soon as it stops
  await until(async () => !(await h.speaking()), 10000)
  expect(await until(() => h.recRunning(), 2000), 'phone: listening again after the guide finishes')
  await h.hear('Show me the projects')
  await sleep(1500)
  expect(/Project Studio|projects/i.test(await h.last()), `phone: spoken request understood ("${(await h.last()).slice(0, 50)}…")`)
  // a tap on the orb interrupts
  await until(() => h.speaking(), 3000)
  await p.locator('.ui-voice__orb').tap()
  await sleep(400)
  expect(!(await h.speaking()), 'phone: tap interrupts')
  const box = await p.evaluate(() => { const r = document.querySelector('.ui-voice')?.getBoundingClientRect(); return r ? { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top) } : null })
  const power = await p.evaluate(() => { const r = document.querySelector('.ui-voice__power')?.getBoundingClientRect(); return r ? { r: Math.round(r.right) } : null })
  expect(!!box && box.l >= 0 && box.r <= 390 && (!power || power.r <= 390), `phone: dock and "Browser voice" control fit the screen (${JSON.stringify(box)})`)
  await p.screenshot({ path: 'qa-screens/621-browser-voice-phone.png' })
  expect(errors.length === 0, `no console errors (${errors.join(' | ').slice(0, 120)})`)
  await ctx.close()
}

// ── 5. recognition exists but its online service doesn't answer (Brave, offline) ──
{
  const { p, ctx, errors } = await open({ recognition: true, synthesis: true })
  const h = helpers(p)
  await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
  await sleep(300)
  await p.getByRole('button', { name: 'Turn on voice' }).click()
  await sleep(800)
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => { const r = window.__rec; r.onerror?.({ error: 'network' }); r.running = false; r.onend?.() })
    await sleep(500)
  }
  await sleep(500)
  const cls = await p.evaluate(() => document.querySelector('.ui-voice')?.className ?? '')
  expect(/can’t reach your browser’s speech service/.test(await h.last()) && !(await h.recRunning()), `speech service unreachable: says why and switches to typing ("${(await h.last()).slice(0, 50)}…")`)
  expect(await p.getByLabel('Message the AI guide').isVisible().catch(() => false), 'speech service unreachable: text box ready')
  expect(/is-on/.test(cls), 'guide stays open in text mode')
  expect(errors.length === 0, `no console errors (${errors.join(' | ').slice(0, 120)})`)
  await ctx.close()
}

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
await b.close()
