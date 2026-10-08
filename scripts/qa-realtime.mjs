// Realtime voice, integration-tested against a simulated voice service.
//
// The page talks to a fake RTCPeerConnection whose "oai-events" data channel
// we drive by hand with the provider's documented server events, so this
// checks everything on the portfolio's side: engine selection, consent, the
// session request (no secret in the browser), transcript streaming, tool calls
// running real guided walks, barge-in, "stop", typed text joining the voice
// session, the visitor taking over, and the microphone being released.
// It does not exercise the live voice service itself.
//
// By default it starts its own dev server on port 5174 with a test session
// endpoint (the site itself ships with none). Or pass a base URL of a server
// started with VITE_VOICE_SESSION_ENDPOINT=<base>/__voice-session.
// Usage: node scripts/qa-realtime.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { createServer } from 'node:net'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let server = null
let base = process.argv[2]
if (!base) {
  // a free port, so another dev server can't be mistaken for this one
  const port = await new Promise((res) => { const srv = createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => res(port)) }) })
  base = `http://localhost:${port}`
  server = spawn(`npx vite --port ${port} --strictPort`, { shell: true, env: { ...process.env, VITE_VOICE_SESSION_ENDPOINT: `${base}/__voice-session` }, stdio: 'ignore' })
  let ready = false
  for (let i = 0; i < 120 && !ready; i++) {
    // ready, and really built with the test endpoint
    try { ready = (await (await fetch(`${base}/src/ai/voice/realtime.ts`)).text()).includes('__voice-session') } catch { /* starting */ }
    if (!ready) await sleep(500)
  }
  if (!ready) { console.error('could not start a dev server with the test session endpoint'); process.exit(1) }
}
const stopServer = () => { if (server) try { execSync(process.platform === 'win32' ? `taskkill /pid ${server.pid} /T /F` : `kill ${server.pid}`, { stdio: 'ignore' }) } catch { /* gone */ } }
process.on('exit', stopServer)
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const errors = []
const problems = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const until = async (fn, ms) => { for (let t = 0; t < ms; t += 150) { if (await fn()) return true; await sleep(150) } return false }

// the session endpoint: answers like server/guide.ts — an ephemeral key, nothing else
let sessionBody = null
await p.route('**/__voice-session', async (route) => {
  sessionBody = JSON.parse(route.request().postData() || '{}')
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ provider: 'openai-realtime', key: 'ek_test_ephemeral', expiresAt: 0, model: 'gpt-realtime-2.1' }) })
})
let sdpAuth = ''
await p.route('https://api.openai.com/v1/realtime/calls', async (route) => {
  sdpAuth = route.request().headers().authorization ?? ''
  await route.fulfill({ status: 201, contentType: 'application/sdp', body: 'v=0\r\n' })
})

// a fake WebRTC stack + microphone the test can drive
await p.addInitScript(() => {
  const rt = { sent: [], channel: null, tracks: [] }
  window.__rt = rt
  window.__rtEmit = (ev) => rt.channel?.onmessage?.({ data: JSON.stringify(ev) })
  navigator.mediaDevices.getUserMedia = async () => {
    const ac = new AudioContext()
    const dest = ac.createMediaStreamDestination()
    rt.tracks = dest.stream.getAudioTracks()
    return dest.stream
  }
  class FakeChannel {
    constructor() { this.readyState = 'connecting'; rt.channel = this; setTimeout(() => { this.readyState = 'open'; this.onopen?.() }, 50) }
    send(msg) { rt.sent.push(JSON.parse(msg)) }
    close() { this.readyState = 'closed'; rt.closed = true }
  }
  window.RTCPeerConnection = class {
    constructor() { this.connectionState = 'connected' }
    addTrack() {}
    createDataChannel() { return new FakeChannel() }
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\n' } }
    async setLocalDescription() {}
    async setRemoteDescription() {}
    close() { rt.pcClosed = true }
  }
})

const emit = (ev) => p.evaluate((e) => window.__rtEmit(e), ev)
const sent = () => p.evaluate(() => window.__rt.sent)
const state = () => p.evaluate(() => document.querySelector('.ui-voice')?.className ?? '')
const lastGuide = () => p.evaluate(() => [...document.querySelectorAll('.ui-voice__log li.is-guide')].pop()?.textContent?.replace(/^Guide: /, '') ?? '')
const lastUser = () => p.evaluate(() => [...document.querySelectorAll('.ui-voice__log li.is-user')].pop()?.textContent?.replace(/^You said: /, '') ?? '')
const pos = () => p.evaluate(() => ({ x: window.__mindscape?.x ?? 0, z: window.__mindscape?.z ?? 0 }))

await p.goto(`${base}/street?debug&desktop&mode=night`)
await p.waitForSelector('.ui-intro__skip', { timeout: 90000 })
await p.getByRole('button', { name: 'Skip intro' }).click()
await p.waitForSelector('.ui-intro.is-hero', { timeout: 20000 })
await sleep(1000)
await p.getByRole('button', { name: 'Start exploring' }).click()
await sleep(3000)

// consent → realtime session
await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
await sleep(300)
const consent = await p.evaluate(() => document.querySelector('.ui-voice__consent')?.textContent ?? '')
expect(/doesn’t store your voice recordings/.test(consent) && /processed live by the voice service/.test(consent), 'consent: microphone, no recordings stored, live processing disclosed')
await p.screenshot({ path: 'qa-screens/600-night-consent.png' })
await p.getByRole('button', { name: 'Turn on voice' }).click()
await until(async () => /is-listening/.test(await state()), 6000)
expect(/is-on/.test(await state()) && /is-listening/.test(await state()), `realtime session connected and listening (${(await state()).replace('ui-voice ', '')})`)
expect(sessionBody && 'world' in sessionBody && !JSON.stringify(sessionBody).includes('sk-'), 'session request carries world context only — no secret from the browser')
expect(sdpAuth === 'Bearer ek_test_ephemeral', 'WebRTC offer authorised with the short-lived key')
let s = await sent()
expect(s.some((e) => e.type === 'conversation.item.create' && e.item?.role === 'system' && /World state/.test(e.item.content?.[0]?.text)), 'world context shared with the session')
expect(s.some((e) => e.type === 'response.create' && /I’m listening/.test(e.response?.instructions ?? '')), 'greeting spoken in the session’s own voice')
await emit({ type: 'response.created' })
await emit({ type: 'response.output_audio_transcript.delta', response_id: 'r0', delta: 'Great — I’m listening.' })
await emit({ type: 'response.output_audio_transcript.done', response_id: 'r0', transcript: 'Great — I’m listening. Talk to me naturally.' })
await emit({ type: 'response.done', response: { id: 'r0', output: [{ type: 'message' }] } })

// a spoken turn: visitor speaks, transcript appears, the guide's answer streams into one message
await emit({ type: 'input_audio_buffer.speech_started' })
await sleep(150)
expect(/is-user_speaking/.test(await state()), 'visitor speaking shown on the orb')
await emit({ type: 'input_audio_buffer.speech_stopped' })
await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'Take me to TASK.' })
await sleep(200)
expect((await lastUser()) === 'Take me to TASK.', `visitor transcript shown: "${await lastUser()}"`)
await emit({ type: 'response.created' })
await emit({ type: 'output_audio_buffer.started', response_id: 'r1' })
await emit({ type: 'response.output_audio_transcript.delta', response_id: 'r1', delta: 'Sure, ' })
await sleep(100)
await emit({ type: 'response.output_audio_transcript.delta', response_id: 'r1', delta: 'let’s head over.' })
await sleep(150)
const streaming = await lastGuide()
expect(streaming === 'Sure, let’s head over.', `assistant transcript streams into one message: "${streaming}"`)
const bubble = await p.evaluate(() => document.querySelector('.ui-bubble.is-visible')?.textContent ?? '')
expect(bubble === 'Sure, let’s head over.', 'companion bubble shows the same words as the voice')
await emit({ type: 'response.output_audio_transcript.done', response_id: 'r1', transcript: 'Sure, let’s head over.' })
await emit({ type: 'output_audio_buffer.stopped', response_id: 'r1' })
// …and the tool call: the walk is real
const start = await pos()
await emit({ type: 'response.done', response: { id: 'r1', output: [{ type: 'message' }, { type: 'function_call', name: 'navigate_to_project', call_id: 'c1', arguments: '{"projectId":"task"}' }] } })
await sleep(600)
s = await sent()
const out = s.find((e) => e.type === 'conversation.item.create' && e.item?.type === 'function_call_output' && e.item.call_id === 'c1')
expect(!!out && /"ok":true/.test(out.item.output), `tool result returned to the session: ${out?.item?.output}`)
const walking = await until(async () => { const q = await pos(); return Math.hypot(q.x - start.x, q.z - start.z) > 3 }, 8000)
expect(walking, 'the tool call started a real guided walk (no teleport)')
expect(/is-navigating/.test(await state()), 'orb shows walking')

// a disallowed tool is refused
await emit({ type: 'response.done', response: { id: 'rx', output: [{ type: 'function_call', name: 'run_javascript', call_id: 'cx', arguments: '{"code":"alert(1)"}' }] } })
await sleep(300)
s = await sent()
const bad = s.find((e) => e.item?.call_id === 'cx')
expect(!!bad && /not an allowed action/.test(bad.item.output), 'unknown tools are refused')

// barge-in while the guide speaks
await emit({ type: 'response.created' })
await emit({ type: 'output_audio_buffer.started', response_id: 'r2' })
await sleep(100)
await emit({ type: 'input_audio_buffer.speech_started' })
await sleep(150)
expect(/is-interrupted|is-user_speaking/.test(await state()), `barge-in: guide stops, visitor talks (${(await state()).replace('ui-voice ', '')})`)
await emit({ type: 'output_audio_buffer.cleared', response_id: 'r2' })

// "stop" said out loud stops the walk at once (before the model even answers)
await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u2', transcript: 'Stop.' })
await sleep(900)
const a = await pos()
await sleep(1200)
const bpos = await pos()
expect(Math.hypot(bpos.x - a.x, bpos.z - a.z) < 0.4, '"stop" (spoken) stops walking immediately')
await emit({ type: 'response.done', response: { id: 'r2', output: [] } })

// typed text joins the same voice conversation
await p.getByRole('button', { name: 'Type a message instead' }).click()
await p.getByLabel('Message the AI guide').fill('What is KidPool?')
await p.getByLabel('Message the AI guide').press('Enter')
await sleep(300)
s = await sent()
const typed = s.filter((e) => e.type === 'conversation.item.create' && e.item?.role === 'user').pop()
expect(typed?.item?.content?.[0]?.text === 'What is KidPool?' && s[s.length - 1].type === 'response.create', 'typed text sent into the realtime session (same brain as voice)')
await p.screenshot({ path: 'qa-screens/601-night-realtime.png' })

// voice off: session closed, microphone released
await p.getByRole('button', { name: 'Turn voice off' }).click()
await sleep(500)
const off = await p.evaluate(() => ({ closed: !!window.__rt.closed && !!window.__rt.pcClosed, ended: window.__rt.tracks.every((t) => t.readyState === 'ended') }))
expect(off.closed && off.ended, `voice off: connection closed and microphone tracks stopped (${JSON.stringify(off)})`)
expect(!/is-on/.test(await state()), 'dock back to "Talk to me"')

// a failing session endpoint falls back gracefully (browser voice, or text)
await p.unroute('**/__voice-session')
await p.route('**/__voice-session', (route) => route.fulfill({ status: 502, body: '{}' }))
await p.getByRole('button', { name: 'Talk to the AI guide' }).click()
await sleep(300)
await p.getByRole('button', { name: 'Turn on voice' }).click()
await sleep(2500)
const fb = await lastGuide()
expect(/browser’s voice|let’s type/.test(fb), `realtime unavailable → falls back: "${fb.slice(0, 70)}…"`)

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
console.log('errors:', errors.length ? errors : 'none')
await b.close()
