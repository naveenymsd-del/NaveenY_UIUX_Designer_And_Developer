import { VOCABULARY } from '../knowledge'
import type { VoiceHandlers, VoiceProvider } from './types'

/**
 * Tier-1 voice: the browser's own speech recognition (where supported —
 * Chrome, Edge, Safari) and speech synthesis. No audio is recorded or stored
 * by this site; note that some browsers send audio to their own speech
 * service to transcribe it (Chrome uses Google's).
 *
 * This is turn-by-turn voice, not realtime speech-to-speech: the browser
 * transcribes a sentence, the guide's brain answers, the browser reads it out.
 *
 * Barge-in: on desktops recognition keeps running while the guide speaks, and
 * anything heard that isn't the guide's own voice echoing back stops the
 * speech at once. Phones play the guide through a speaker right next to the
 * microphone, so there the microphone pauses while the guide talks (a tap on
 * the orb interrupts) and listens again as soon as it stops.
 */
type Rec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  phrases?: unknown
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
}
type RecCtor = new () => Rec

const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {}
const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as RecCtor | undefined
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
const LANG = 'en-US'
/** phones and tablets: the speaker is next to the mic, so listen and speak in turns */
const HALF_DUPLEX = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent))

/** a calm, natural English voice from whatever this device offers */
let chosen: SpeechSynthesisVoice | null = null
function pickVoice() {
  if (!synth) return null
  if (chosen) return chosen
  const voices = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang))
  if (!voices.length) return null
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 8 : 0) +
    (/google us english|samantha|aria|jenny|ava|allison|serena|daniel|libby|sonia/i.test(v.name) ? 5 : 0) +
    (/en[-_]us/i.test(v.lang) ? 3 : /en[-_](gb|in|au)/i.test(v.lang) ? 2 : 0) +
    (v.localService ? 0 : 1) -
    (/compact|novelty|whisper|bells|zarvox|albert|bad news|bahh|bubbles|cellos|trinoids|superstar|boing|jester|organ|wobble|fred|junior|ralph|kathy/i.test(v.name) ? 20 : 0)
  chosen = [...voices].sort((a, b) => score(b) - score(a))[0] ?? null
  return chosen
}
synth?.addEventListener?.('voiceschanged', () => { chosen = null })

const toWords = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((x) => x.length > 1)

export class BrowserVoice implements VoiceProvider {
  readonly name = 'browser' as const
  /** recognition only: the guide's own brain does the understanding */
  readonly conversational = false
  readonly canListen = !!SR
  readonly canSpeak = !!synth
  listening = false
  speaking = false
  private rec: Rec | null = null
  private wanted = false
  private h: Partial<VoiceHandlers> = {}
  private spoken = new Set<string>()
  private speakToken = 0
  private restartTimer = 0
  /** the mic is paused only while the guide talks (phones) */
  private heldForSpeech = false
  readonly halfDuplex = HALF_DUPLEX

  on(handlers: Partial<VoiceHandlers>) {
    this.h = { ...this.h, ...handlers }
  }

  async connect() {
    return this.startListening()
  }

  async disconnect() {
    this.stopListening()
    this.interrupt()
  }

  isConnected() {
    return this.wanted
  }

  /** text is understood by the guide itself on this engine */
  async sendText() {}
  updateContext() {}

  async say(text: string) {
    return this.speak(text)
  }

  async startListening() {
    if (!SR) {
      this.h.error?.('unsupported')
      return
    }
    this.wanted = true
    if (!this.rec) this.rec = this.create()
    try {
      this.rec.start()
      this.listening = true
    } catch {
      /* already started */
    }
  }

  /**
   * Call inside the visitor's tap: Safari (and iOS) only let a page speak after
   * a gesture, and the first answer arrives a moment later.
   */
  unlockSpeech() {
    if (!synth) return
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      synth.speak(u)
    } catch { /* not allowed yet */ }
  }

  async stopListening() {
    this.wanted = false
    this.heldForSpeech = false
    this.listening = false
    clearTimeout(this.restartTimer)
    try { this.rec?.abort() } catch { /* not running */ }
  }

  private create() {
    const rec = new SR!()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = LANG
    rec.maxAlternatives = 1
    // contextual biasing where the browser supports it (portfolio names are easy to mishear)
    try {
      const Phrase = w.SpeechRecognitionPhrase as (new (p: string, boost: number) => unknown) | undefined
      if (Phrase && 'phrases' in rec) rec.phrases = VOCABULARY.map((p) => new Phrase(p, 3))
    } catch { /* not supported */ }

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const text = (r[0]?.transcript ?? '').trim()
        if (!text) continue
        if (this.speaking) {
          // the guide hearing itself through the speakers — ignore
          if (this.isEcho(text)) continue
          const ws = toWords(text)
          const control = /\b(stop|wait|hold on|hang on|pause|cancel)\b/i.test(text)
          if (!control && ws.length < 2 && !r.isFinal) continue
          this.interrupt()
          this.h.interrupted?.()
        }
        this.h.userTranscript?.(text, r.isFinal, String(i))
      }
    }
    rec.onspeechstart = () => this.h.userSpeechStart?.()
    rec.onspeechend = () => this.h.userSpeechEnd?.()
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.wanted = false
        this.h.error?.('denied')
      } else if (e.error === 'audio-capture') {
        this.wanted = false
        this.h.error?.('no-mic')
      } else if (e.error === 'network') this.h.error?.('network')
    }
    // recognisers stop on silence; keep listening for as long as voice mode is on
    rec.onend = () => {
      this.listening = false
      if (!this.wanted || this.heldForSpeech) return
      this.restartTimer = window.setTimeout(() => {
        if (!this.wanted) return
        try {
          rec.start()
          this.listening = true
        } catch { /* already running */ }
      }, 250)
    }
    return rec
  }

  private isEcho(heard: string) {
    const ws = toWords(heard)
    if (!ws.length) return true
    const hit = ws.filter((x) => this.spoken.has(x)).length
    return hit / ws.length >= 0.6
  }

  speak(text: string) {
    return new Promise<void>((resolve) => {
      if (!synth) return resolve()
      const token = ++this.speakToken
      synth.cancel()
      // short sentence-sized utterances: natural pauses, and no long-utterance cut-offs
      const parts = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text]
      this.spoken = new Set(toWords(text))
      let left = parts.length
      const finish = () => {
        if (token !== this.speakToken) return
        this.speaking = false
        this.resumeAfterSpeech()
        this.h.assistantSpeechEnd?.()
        resolve()
      }
      this.holdForSpeech()
      for (const [i, part] of parts.entries()) {
        const u = new SpeechSynthesisUtterance(part)
        const v = pickVoice()
        if (v) u.voice = v
        u.lang = v?.lang ?? LANG
        u.rate = 1.0
        u.pitch = 1.0
        if (i === 0) u.onstart = () => {
          if (token !== this.speakToken) return
          this.speaking = true
          this.h.assistantSpeechStart?.()
        }
        u.onend = () => { if (--left === 0) finish() }
        u.onerror = (ev) => {
          if (ev.error !== 'interrupted' && ev.error !== 'canceled') this.h.error?.('tts')
          if (--left === 0) finish()
        }
        synth.speak(u)
      }
      // safety net: some engines never fire onend
      setTimeout(() => { if (token === this.speakToken && left > 0) finish() }, 4000 + text.length * 110)
    })
  }

  interrupt() {
    this.speakToken++
    if (synth && (synth.speaking || synth.pending)) synth.cancel()
    this.resumeAfterSpeech()
    if (this.speaking) {
      this.speaking = false
      this.h.assistantSpeechEnd?.()
    }
  }

  /** phones: pause the mic so the guide doesn't hear itself */
  private holdForSpeech() {
    if (!this.halfDuplex || !this.wanted || !this.rec || this.heldForSpeech) return
    this.heldForSpeech = true
    clearTimeout(this.restartTimer)
    try { this.rec.abort() } catch { /* not running */ }
    this.listening = false
  }

  private resumeAfterSpeech() {
    if (!this.heldForSpeech) return
    this.heldForSpeech = false
    if (!this.wanted || !this.rec) return
    const rec = this.rec
    this.restartTimer = window.setTimeout(() => {
      if (!this.wanted || this.heldForSpeech) return
      try {
        rec.start()
        this.listening = true
      } catch { /* already running */ }
    }, 300)
  }
}
