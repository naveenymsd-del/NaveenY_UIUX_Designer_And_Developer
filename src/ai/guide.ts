import { companion, emote, say, sayLive } from '@/core/companion'
import { soundManager } from '@/core/sound/SoundManager'
import { runActions, validateActions } from './actions'
import { cancelWalk, walker } from './autoWalk'
import { localReply } from './brain/local'
import { remoteAvailable, remoteReply } from './brain/remote'
import { conversation, rememberAssistant, rememberReply, rememberUser } from './conversation'
import { toolToAction, worldSummary } from './guidePrompt'
import { leaveTour, pauseTour, tour, tourActive } from './tour'
import type { BrainReply, GuideAction } from './types'
import { BrowserVoice } from './voice/browser'
import { RealtimeVoice, realtimeSupported } from './voice/realtime'
import type { VoiceErrorCode, VoiceProvider } from './voice/types'
import { useVoiceStore } from './voiceStore'
import { worldContext } from './worldState'

/**
 * The conversational guide. One conversation, three engines:
 *
 *   1. realtime speech-to-speech (voice/realtime.ts) — optional, only when a
 *      session endpoint is configured (VITE_VOICE_SESSION_ENDPOINT). The voice
 *      service listens, understands, answers aloud and calls world actions
 *      itself; typed text goes into the same session.
 *   2. browser voice (voice/browser.ts) — the default, free: the browser's own
 *      speech recognition and synthesis, turn by turn, with the guide's own
 *      brain (brain/local.ts; the optional server brain only for questions it
 *      can't answer). Not realtime speech-to-speech, and never called that.
 *   3. text only — the same brain.
 *
 * Every engine goes through the same action router, world context, tour and
 * conversation memory. Nothing here runs in the render loop.
 */
const browserVoice = new BrowserVoice()
const realtimeVoice = new RealtimeVoice(() => worldContext())
/** the engine carrying voice right now (null = text only) */
let provider: VoiceProvider | null = null
const store = () => useVoiceStore.getState()
const live = () => provider?.conversational && provider.isConnected()

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
/** what a speech engine reads: symbols said as words */
const spoken = (s: string) =>
  s.replace(/\s·\s/g, ', ').replace(/\s?→\s?/g, ' then ').replace(/&/g, ' and ').replace(/\s—\s/g, ', ').replace(/UI\/UX/g, 'UI UX').replace(/\//g, ' ').replace(/\s+/g, ' ')

/** the mic is on (browser voice counts as on while it pauses for the guide's own speech on phones) */
const micOn = () => !!provider && (provider.listening || (provider === browserVoice && browserVoice.isConnected()))

function baseState() {
  const m = store().mode
  if (walker.active) return 'navigating' as const
  if (m === 'voice') return micOn() ? ('listening' as const) : ('idle' as const)
  return m === 'text' ? ('idle' as const) : ('disabled' as const)
}
function settle() {
  const s = baseState()
  store().set({ state: s })
  companion.voice = s === 'listening' ? 'listening' : s === 'navigating' ? 'navigating' : 'idle'
}

/**
 * The guide says a line. On realtime voice it's spoken in the session's own
 * voice (its transcript then fills the bubble and the conversation); otherwise
 * it appears in the bubble and transcript, and the browser reads it aloud.
 */
export function respond(text: string) {
  if (!text.trim()) return
  if (live()) {
    void provider!.say(text)
    return
  }
  store().add('guide', text)
  say(escapeHtml(text), { ms: Math.min(18000, Math.max(3200, 2600 + text.length * 60)), emote: 'explain', interrupt: true })
  if (store().mode !== 'off' && browserVoice.canSpeak && soundManager.isEnabled) void browserVoice.say(spoken(text))
}

// ── tours and other actions, shared by every engine ─────────────────────
function startActions(actions: GuideAction[]) {
  const nav = actions.some((a) => a.type === 'navigate' || a.type === 'navigateProject' || a.type === 'goBack')
  // going somewhere else ends a tour; stopping just pauses it
  if (nav && tourActive()) leaveTour()
  if (actions.some((a) => a.type === 'stop')) {
    cancelWalk()
    if (tourActive()) pauseTour()
  }
  void runActions(actions, { respond }).finally(settle)
}

/** while a tour waits at a stop, a question gets its answer — then the tour offers to move on */
function withTourPrompt(r: BrainReply): BrainReply {
  // (continuing the tour takes priority over any side-offer the answer made)
  if (tour.status === 'active' && tour.waiting && !r.actions.length && r.text) {
    return { ...r, text: `${r.text} Want to continue the tour?`, offer: { type: 'tour', op: 'next' } }
  }
  return r
}

/** instant local handling for control words, whatever engine is carrying the conversation */
function controlAction(text: string): GuideAction[] {
  const r = localReply(text, worldContext(), conversation)
  return r.actions.filter((a) => a.type === 'stop' || (a.type === 'tour' && a.op === 'stop'))
}

/** "stop listening", "mute", "start listening": the microphone itself, not the world */
function micCommand(text: string) {
  const t = text.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const off = /^(please )?((stop|pause) listening|mute|mute yourself|(turn|switch) off (the )?(mic|microphone)|stop the (mic|microphone))( please)?$/.test(t)
  const on = /^(please )?((start|resume) listening|unmute|(turn|switch) on (the )?(mic|microphone))( please)?$/.test(t)
  if (!off && !on) return false
  if (store().mode !== 'voice' || !provider) {
    respond(on ? 'Tap me and choose “Turn on voice” — I’ll ask before using your microphone.' : 'I’m not listening right now — we’re typing.')
    return true
  }
  if (off) {
    void provider.stopListening()
    respond('Okay — I’ve stopped listening. Tap me whenever you want to talk again.')
  } else {
    void provider.startListening()
    respond('I’m listening.')
  }
  setTimeout(settle, 60)
  return true
}

let seq = 0
/** one typed turn */
export async function submit(raw: string) {
  const text = raw.trim().slice(0, 400)
  if (!text) return
  const s = store()
  s.set({ interim: '', link: null, turns: s.turns + 1, mode: s.mode === 'off' ? 'text' : s.mode })

  // realtime voice is on: typed text joins the same spoken conversation
  if (live()) {
    s.add('user', text)
    rememberUser(text)
    const ctl = controlAction(text)
    if (ctl.length) startActions(ctl)
    provider!.updateContext(worldSummary(worldContext()))
    await provider!.sendText(text)
    return
  }

  s.add('user', text)
  browserVoice.interrupt()
  rememberUser(text)
  if (micCommand(text)) return
  const world = worldContext()
  let reply = localReply(text, world, conversation)
  // the built-in brain answers everything it can (instant, grounded, tours and context included);
  // only a question it has no answer for goes to the optional server brain
  if (remoteAvailable && reply.unknown) {
    const mine = ++seq
    store().set({ state: 'thinking' })
    companion.voice = 'thinking'
    emote('think', 1600)
    const r = await remoteReply(conversation.history, world)
    if (mine !== seq) return
    // a server answer replaces "I don't want to guess" — its actions are validated like any other
    if (r) reply = r
    settle()
  }
  reply = withTourPrompt(reply)
  rememberReply(reply)
  respond(reply.text)
  settle()
  startActions(reply.actions)
}

// ── engine events ───────────────────────────────────────────────────────
let lastContext = ''
function shareContext() {
  if (!live()) return
  const c = worldSummary(worldContext())
  if (c === lastContext) return
  lastContext = c
  provider!.updateContext(c)
}

/** realtime transcripts stream into one message per turn */
const turnMessage = new Map<string, number>()

function wireRealtime() {
  realtimeVoice.on({
    userSpeechStart: () => {
      shareContext()
      store().set({ state: 'user_speaking' })
      companion.voice = 'listening'
    },
    userSpeechEnd: () => {
      store().set({ state: 'thinking' })
      companion.voice = 'thinking'
    },
    userTranscript: (text, final) => {
      if (!final) return store().set({ interim: text })
      store().set({ interim: '', turns: store().turns + 1 })
      if (!text) return
      store().add('user', text)
      rememberUser(text)
      // "stop" / "wait" act at once, before the model's reply
      const ctl = controlAction(text)
      if (ctl.length) startActions(ctl)
    },
    assistantTranscript: (text, final, turn) => {
      const id = turnMessage.get(turn)
      if (id === undefined) turnMessage.set(turn, store().add('guide', text))
      else store().patch(id, text)
      sayLive(escapeHtml(text), final ? Math.min(14000, 2200 + text.length * 45) : 6000)
      if (final) {
        turnMessage.delete(turn)
        rememberAssistant(text)
      }
    },
    assistantSpeechStart: () => {
      store().set({ state: walker.active ? 'navigating' : 'speaking' })
      companion.voice = 'speaking'
      emote('explain', 1600)
    },
    assistantSpeechEnd: settle,
    interrupted: () => {
      store().set({ state: 'interrupted' })
      companion.voice = 'listening'
    },
    audioBlocked: () => store().set({ audioBlocked: true }),
    toolCall: async (name, args) => {
      const actions = validateActions([toolToAction(name, args)].filter(Boolean))
      if (!actions.length) return JSON.stringify({ ok: false, error: 'not an allowed action' })
      const before = worldContext().location
      startActions(actions)
      const a = actions[0]
      const walking = a.type === 'navigate' || a.type === 'navigateProject' || (a.type === 'tour' && a.op !== 'stop')
      return JSON.stringify({ ok: true, from: before, status: walking ? 'walking — narration on arrival is automatic' : 'done' })
    },
    disconnected: (reason) => {
      if (reason === 'closed') return
      // the voice connection dropped: keep the conversation going on the next engine down
      provider = null
      store().set({ session: 'error' })
      void fallBack('network')
    },
  })
}

/** recognition failures in a row: the browser's speech service is off or unreachable (Brave, offline) */
let netErrors = 0

function wireBrowser() {
  browserVoice.on({
    userTranscript: (text, final) => {
      netErrors = 0
      if (final) void submit(text)
      else store().set({ interim: text })
    },
    userSpeechStart: () => { if (store().state === 'listening') companion.voice = 'listening' },
    interrupted: () => {
      store().set({ state: 'interrupted' })
      companion.voice = 'listening'
    },
    assistantSpeechStart: () => {
      store().set({ state: walker.active ? 'navigating' : 'speaking' })
      companion.voice = 'speaking'
    },
    assistantSpeechEnd: settle,
    error: (code) => {
      if (code === 'tts') return // the text is already on screen
      if (code === 'network' && ++netErrors >= 3) {
        // it will keep failing: stop asking for the mic and say why, rather than loop
        netErrors = 0
        void browserVoice.disconnect()
        if (provider === browserVoice) provider = null
        store().set({ mode: 'text', tier: 'text', session: 'disconnected', state: 'idle', status: null, interim: '' })
        companion.voice = 'idle'
        respond(`I can’t reach your browser’s speech service right now — some browsers switch it off, or you may be offline — so let’s type.${browserVoice.canSpeak ? ' I’ll still read my answers aloud.' : ''}`)
        return
      }
      if (code === 'network') {
        store().set({ state: 'error', status: 'I couldn’t hear that. Try again.' })
        setTimeout(() => { store().set({ status: null }); settle() }, 3000)
        return
      }
      void fallBack(code)
    },
  })
}

// ── turning voice on and off ────────────────────────────────────────────
let greeted = false

export function initGuide() {
  store().set({ canRealtime: realtimeSupported(), canListen: browserVoice.canListen || realtimeSupported(), canSpeak: browserVoice.canSpeak || realtimeSupported() })
  wireRealtime()
  wireBrowser()
  // a hidden tab doesn't keep the microphone: voice pauses until the visitor turns it back on
  const onHide = () => {
    if (document.visibilityState === 'hidden' && store().mode === 'voice') {
      void provider?.disconnect()
      provider = null
      store().set({ mode: 'text', tier: 'text', session: 'disconnected', status: null, state: 'idle', interim: '' })
      companion.voice = 'idle'
    }
  }
  document.addEventListener('visibilitychange', onHide)
  const onUnload = () => { void provider?.disconnect() }
  window.addEventListener('pagehide', onUnload)
  return () => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onUnload)
  }
}

/** an engine couldn't start or dropped: tell the visitor plainly, and use the next one down */
async function fallBack(code: VoiceErrorCode) {
  if (code === 'denied' || code === 'no-mic') {
    await provider?.disconnect()
    provider = null
    store().set({ mode: 'text', tier: 'text', session: 'disconnected', state: 'idle', status: null })
    companion.voice = 'idle'
    respond(code === 'denied'
      ? 'I couldn’t access your microphone. You can type instead, or continue exploring normally.'
      : 'I can’t find a microphone. You can type instead, or continue exploring normally.')
    return
  }
  // realtime unavailable or dropped → the browser's own voice, if it has one
  if (browserVoice.canListen) {
    provider = browserVoice
    store().set({ mode: 'voice', tier: 'browser', session: 'connected', state: 'listening', status: null })
    companion.voice = 'listening'
    await browserVoice.connect()
    respond(code === 'network'
      ? 'I lost the live voice connection, so I’ve switched to your browser’s voice. Keep talking.'
      : 'Live voice isn’t available right now, so I’m using your browser’s voice instead. Go ahead.')
    return
  }
  provider = null
  store().set({ mode: 'text', tier: 'text', session: 'disconnected', state: 'idle', status: null })
  companion.voice = 'idle'
  respond('Voice isn’t available in this browser right now, so let’s type. Ask me anything about Naveen, or tell me where to go.')
}

export async function enableVoice() {
  const s = store()
  s.set({ consentOpen: false, audioBlocked: false })
  soundManager.unlock()
  // still inside the visitor's tap: let the browser speak the first answer (Safari, iOS)
  browserVoice.unlockSpeech()
  // 1. realtime speech-to-speech
  if (realtimeSupported()) {
    s.set({ mode: 'voice', tier: 'realtime', session: 'connecting', state: 'connecting', status: 'Connecting…' })
    companion.voice = 'thinking'
    try {
      await realtimeVoice.connect()
      provider = realtimeVoice
      lastContext = ''
      store().set({ session: 'connected', state: 'listening', status: null })
      companion.voice = 'listening'
      shareContext()
      if (!greeted) {
        greeted = true
        respond('Great — I’m listening. Talk to me naturally: ask about Naveen or a project, or tell me where you’d like to go.')
      }
      return
    } catch (err) {
      store().set({ status: null })
      return fallBack(((err as { code?: VoiceErrorCode }).code ?? 'unavailable') as VoiceErrorCode)
    }
  }
  // 2. the browser's speech recognition
  if (browserVoice.canListen) {
    provider = browserVoice
    s.set({ mode: 'voice', tier: 'browser', session: 'connected', state: 'listening', status: null })
    companion.voice = 'listening'
    await browserVoice.connect()
    if (!greeted) {
      greeted = true
      respond('Great. Just talk to me naturally — ask me about Naveen, ask about a project, or tell me where you’d like to go.')
    }
    return
  }
  // 3. text
  enableText()
  respond('Voice input isn’t supported in this browser, so let’s type. Ask me anything about Naveen, or tell me where to go.')
}

export function enableText() {
  browserVoice.unlockSpeech()
  store().set({ consentOpen: false, mode: 'text', tier: 'text', state: 'idle' })
  if (!greeted) {
    greeted = true
    respond('Sure — type to me any time. Ask about Naveen or a project, or tell me where you’d like to go.')
  }
}

/** pause / resume listening without leaving voice mode (tap the orb) */
export function toggleListening() {
  if (store().mode !== 'voice' || !provider) return
  if (micOn()) void provider.stopListening()
  else void provider.startListening()
  setTimeout(settle, 60)
}

/** the orb was tapped while the guide was talking or walking: stop, and listen */
export function interruptGuide() {
  provider?.interrupt()
  browserVoice.interrupt()
  if (walker.active) cancelWalk()
  if (tourActive()) pauseTour()
  store().set({ status: null })
  settle()
}

/** the browser blocked the guide's voice: a tap lets it play */
export function resumeAudio() {
  void realtimeVoice.resumeAudio()
  store().set({ audioBlocked: false })
}

/** voice off: microphone released, session closed, nothing listening */
export async function disableGuide() {
  const p = provider
  provider = null
  store().set({ session: 'disconnecting' })
  await p?.disconnect()
  browserVoice.interrupt()
  store().set({ mode: 'off', tier: 'off', session: 'disconnected', state: 'disabled', interim: '', status: null, consentOpen: false, audioBlocked: false })
  companion.voice = 'idle'
}
