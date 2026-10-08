import type { VoiceErrorCode, VoiceHandlers, VoiceProvider } from './types'

/**
 * Realtime speech-to-speech over WebRTC (OpenAI Realtime API).
 *
 *   1. The guide's server endpoint (server/guide.ts, /realtime/session) mints
 *      a short-lived key with the guide's instructions, knowledge and tools.
 *      The permanent API key never reaches the browser.
 *   2. The browser opens a WebRTC connection straight to the voice service:
 *      the microphone track goes up (with echo cancellation, noise
 *      suppression and auto gain), the guide's voice comes down as audio,
 *      and JSON events flow over the "oai-events" data channel.
 *   3. Server-side voice activity detection handles turn-taking and barge-in:
 *      when the visitor starts talking, the guide's audio is cut and it listens.
 *
 * Tool calls arrive as events; the guide runs them through its own action
 * router (validated, closed set) and returns a short result.
 */
const SESSION_ENDPOINT = (import.meta.env.VITE_VOICE_SESSION_ENDPOINT as string | undefined)?.trim() || ''
const CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

/** is realtime voice possible here? (configured, and a browser with WebRTC + microphone access) */
export function realtimeSupported() {
  const configured = /^https:\/\//.test(SESSION_ENDPOINT) || (import.meta.env.DEV && /^http:\/\/localhost/.test(SESSION_ENDPOINT))
  return configured && typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

type ServerEvent = { type: string; [k: string]: unknown }

export class RealtimeVoice implements VoiceProvider {
  readonly name = 'realtime' as const
  readonly conversational = true
  readonly canListen = true
  readonly canSpeak = true
  listening = false
  speaking = false
  private h: Partial<VoiceHandlers> = {}
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private mic: MediaStream | null = null
  private audio: HTMLAudioElement | null = null
  private connected = false
  /** a response is being generated (only one at a time) */
  private responding = false
  private sayQueue: string[] = []
  /** streaming transcripts, per response / per user item */
  private assistantText = new Map<string, string>()
  private userText = new Map<string, string>()
  private worldProvider: (() => unknown) | null = null

  constructor(world?: () => unknown) {
    this.worldProvider = world ?? null
  }

  on(handlers: Partial<VoiceHandlers>) {
    this.h = { ...this.h, ...handlers }
  }

  isConnected() {
    return this.connected
  }

  async connect() {
    if (this.pc) return
    // 1. the microphone — only now, after the visitor chose voice
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (err) {
      const name = (err as { name?: string })?.name
      throw this.fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'no-mic')
    }

    // 2. a short-lived session from the guide's server
    let key: string
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 10000)
      const res = await fetch(SESSION_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ world: this.worldProvider?.() ?? null }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) throw new Error(String(res.status))
      key = ((await res.json()) as { key?: string }).key ?? ''
      if (!key) throw new Error('no key')
    } catch {
      this.release()
      throw this.fail('unavailable')
    }

    // 3. WebRTC: mic up, voice down, events on a data channel
    const pc = new RTCPeerConnection()
    this.pc = pc
    const audio = document.createElement('audio')
    audio.autoplay = true
    audio.setAttribute('playsinline', '')
    this.audio = audio
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0]
      audio.play().catch(() => this.h.audioBlocked?.())
    }
    for (const track of this.mic.getAudioTracks()) pc.addTrack(track, this.mic)
    const dc = pc.createDataChannel('oai-events')
    this.dc = dc
    dc.onmessage = (e) => {
      try {
        this.handle(JSON.parse(e.data) as ServerEvent)
      } catch { /* ignore malformed events */ }
    }
    const opened = new Promise<void>((resolve, reject) => {
      dc.onopen = () => resolve()
      setTimeout(() => reject(new Error('timeout')), 12000)
    })
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (this.connected) {
          this.release()
          this.h.disconnected?.('network')
        }
      }
    }
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const sdp = await fetch(CALLS_URL, {
        method: 'POST',
        body: offer.sdp,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/sdp' },
      })
      if (!sdp.ok) throw new Error(String(sdp.status))
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() })
      await opened
    } catch {
      this.release()
      throw this.fail('network')
    }
    this.connected = true
    this.listening = true
  }

  private fail(code: VoiceErrorCode) {
    return Object.assign(new Error(code), { code })
  }

  /** stop the mic, close the connection, silence the speaker */
  private release() {
    this.connected = false
    this.listening = false
    this.speaking = false
    this.responding = false
    this.sayQueue = []
    for (const t of this.mic?.getTracks() ?? []) t.stop()
    this.mic = null
    try { this.dc?.close() } catch { /* closed */ }
    try { this.pc?.close() } catch { /* closed */ }
    this.dc = null
    this.pc = null
    if (this.audio) {
      this.audio.pause()
      this.audio.srcObject = null
      this.audio = null
    }
  }

  async disconnect() {
    const was = this.connected
    this.release()
    if (was) this.h.disconnected?.('closed')
  }

  async startListening() {
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = true
    this.listening = !!this.mic
  }

  async stopListening() {
    // a muted track: the session stays open, nothing is heard
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = false
    this.listening = false
  }

  /** the audio element after a blocked autoplay (call from a tap) */
  resumeAudio() {
    return this.audio?.play().catch(() => undefined)
  }

  private send(event: Record<string, unknown>) {
    if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(event))
  }

  interrupt() {
    if (!this.connected) return
    if (this.responding) this.send({ type: 'response.cancel' })
    // WebRTC: drop audio already buffered for playback
    this.send({ type: 'output_audio_buffer.clear' })
    this.sayQueue = []
  }

  async sendText(text: string) {
    if (!this.connected) return
    if (this.responding) this.interrupt()
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })
    this.send({ type: 'response.create' })
  }

  /** a guide line (narration, tour stop) spoken in the same voice — queued behind any reply in progress */
  async say(text: string) {
    if (!this.connected) return
    this.sayQueue.push(text)
    this.flushSay()
  }

  private flushSay() {
    if (this.responding || !this.sayQueue.length) return
    const text = this.sayQueue.shift()!
    this.responding = true
    this.send({
      type: 'response.create',
      response: { instructions: `Say this to the visitor, naturally and without adding anything: "${text.replace(/"/g, '\'')}"` },
    })
  }

  updateContext(summary: string) {
    if (!this.connected) return
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: summary }] } })
  }

  // ── server events ─────────────────────────────────────────────────────
  private handle(ev: ServerEvent) {
    const s = (k: string) => (typeof ev[k] === 'string' ? (ev[k] as string) : '')
    switch (ev.type) {
      case 'input_audio_buffer.speech_started':
        // barge-in: the service cuts its own audio; we tell the guide
        if (this.speaking) this.h.interrupted?.()
        this.h.userSpeechStart?.()
        return
      case 'input_audio_buffer.speech_stopped':
        this.h.userSpeechEnd?.()
        return
      case 'conversation.item.input_audio_transcription.delta': {
        const id = s('item_id')
        const text = (this.userText.get(id) ?? '') + s('delta')
        this.userText.set(id, text)
        this.h.userTranscript?.(text, false, id)
        return
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const id = s('item_id')
        this.userText.delete(id)
        this.h.userTranscript?.(s('transcript').trim(), true, id)
        return
      }
      case 'response.created':
        this.responding = true
        return
      case 'response.output_audio_transcript.delta':
      case 'response.output_text.delta': {
        const id = s('response_id')
        const text = (this.assistantText.get(id) ?? '') + s('delta')
        this.assistantText.set(id, text)
        this.h.assistantTranscript?.(text, false, id)
        return
      }
      case 'response.output_audio_transcript.done':
      case 'response.output_text.done': {
        const id = s('response_id')
        const text = s('transcript') || s('text') || this.assistantText.get(id) || ''
        this.assistantText.delete(id)
        if (text.trim()) this.h.assistantTranscript?.(text.trim(), true, id)
        return
      }
      case 'output_audio_buffer.started':
        this.speaking = true
        this.h.assistantSpeechStart?.()
        return
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        if (this.speaking) {
          this.speaking = false
          this.h.assistantSpeechEnd?.()
        }
        return
      case 'response.done':
        this.responding = false
        void this.afterResponse((ev.response ?? {}) as { id?: string; output?: Record<string, unknown>[] })
        return
      case 'error': {
        const code = ((ev.error ?? {}) as { code?: string }).code ?? ''
        // harmless races (cancelling a finished response, etc.)
        if (/cancel|not_active|already_has_active_response/.test(code)) return
        if (import.meta.env.DEV) console.warn('[voice] realtime error', ev.error)
        return
      }
    }
  }

  /** tool calls requested in a finished response: run them, report back, let the guide continue */
  private async afterResponse(r: { id?: string; output?: Record<string, unknown>[] }) {
    const calls = (r.output ?? []).filter((o) => o.type === 'function_call')
    const spoke = (r.output ?? []).some((o) => o.type === 'message')
    for (const c of calls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(String(c.arguments ?? '{}')) } catch { /* empty */ }
      const result = (await this.h.toolCall?.(String(c.name ?? ''), args)) ?? '{"ok":false}'
      this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: c.call_id, output: result } })
    }
    // the model called a tool without saying anything: let it say a short line now
    if (calls.length && !spoke && !this.sayQueue.length) {
      this.responding = true
      this.send({ type: 'response.create' })
      return
    }
    this.flushSay()
  }
}
