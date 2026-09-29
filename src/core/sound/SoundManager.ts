import { AUDIO_ASSETS, type AudioKey } from '@/data/assets'
import { probeAsset } from '@/utils/assetProbe'

/**
 * Sound architecture. Real audio files are optional: put them in
 * /public/audio (see AUDIO_ASSETS) and they are used automatically. Anything
 * missing is synthesised with WebAudio, so the app never breaks or goes silent
 * because of a missing file. The AudioContext is created on the first user
 * gesture (browser autoplay policy).
 */
type SfxKey = 'footstep' | 'jump' | 'land' | 'click' | 'interact' | 'open' | 'close' | 'hover' | 'bell' | 'companion' | 'discover' | 'screen'

export type Soundscape = 'street' | 'park' | 'office' | 'education' | 'home'
type Layer = 'street' | 'outdoor' | 'park' | 'office' | 'room'
const SCAPES: Record<Soundscape, Record<Layer, number>> = {
  street: { street: 1, outdoor: 1, park: 0.15, office: 0, room: 0 },
  park: { street: 0.4, outdoor: 1.3, park: 1, office: 0, room: 0 },
  office: { street: 0.05, outdoor: 0.04, park: 0, office: 1, room: 0.5 },
  education: { street: 0.05, outdoor: 0.08, park: 0, office: 0.22, room: 1 },
  home: { street: 0.04, outdoor: 0.1, park: 0, office: 0, room: 0.8 },
}

interface PlayOpts {
  volume?: number
  rate?: number
}

class SoundManager {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private ambience!: GainNode
  private musicBus!: GainNode
  private noise: AudioBuffer | null = null
  private buffers = new Map<AudioKey, AudioBuffer>()
  private loopsStarted = false
  private enabled = true
  private engineGain: GainNode | null = null
  private timers: number[] = []
  private lastPlay = new Map<string, number>()
  private layers: Partial<Record<Layer, GainNode>> = {}
  private scape: Soundscape = 'street'

  get unlocked() {
    return !!this.ctx && this.ctx.state === 'running'
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(on ? 1 : 0, t, 0.15)
    if (on) void this.ctx.resume()
    if (on && !this.loopsStarted) this.startLoops()
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.enabled ? 1 : 0
        this.master.connect(this.ctx.destination)
        this.sfx = this.bus(0.8)
        this.ambience = this.bus(0.5)
        this.musicBus = this.bus(0.32)
        this.noise = this.makeNoise()
        void this.loadFiles()
      }
      if (this.ctx.state !== 'running') void this.ctx.resume()
      if (this.enabled && !this.loopsStarted) this.startLoops()
    } catch (e) {
      console.warn('[sound] WebAudio unavailable', e)
    }
  }

  private bus(v: number) {
    const g = this.ctx!.createGain()
    g.gain.value = v
    g.connect(this.master)
    return g
  }

  private makeNoise() {
    const ctx = this.ctx!
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02 // brown-ish
      d[i] = last * 3.5 * 0.6 + white * 0.4
    }
    return buf
  }

  private async loadFiles() {
    const entries = Object.entries(AUDIO_ASSETS) as [AudioKey, string][]
    await Promise.all(
      entries.map(async ([key, url]) => {
        if (!(await probeAsset(url, 'audio'))) return
        try {
          const res = await fetch(url)
          const data = await res.arrayBuffer()
          const buf = await this.ctx!.decodeAudioData(data)
          this.buffers.set(key, buf)
          if (import.meta.env.DEV) console.info(`[sound] loaded ${url}`)
        } catch {
          console.warn(`[sound] could not decode ${url}; using synthesised fallback`)
        }
      }),
    )
    if (import.meta.env.DEV && this.buffers.size === 0) console.info('[sound] no audio files in /public/audio — using synthesised sounds')
    // swap to file-based loops if any arrived after synthesis started
    if (this.loopsStarted && (this.buffers.has('ambient') || this.buffers.has('music'))) {
      this.stopLoops()
      this.startLoops()
    }
  }

  play(key: SfxKey, opts: PlayOpts = {}) {
    const ctx = this.ctx
    if (!ctx || !this.enabled || ctx.state !== 'running') return
    // throttle identical sounds
    const now = ctx.currentTime
    const minGap = key === 'footstep' ? 0.07 : 0.04
    if (now - (this.lastPlay.get(key) ?? -1) < minGap) return
    this.lastPlay.set(key, now)
    const vol = opts.volume ?? 1
    const fileKey = (key === 'hover' ? 'click' : key === 'close' ? 'open' : key) as AudioKey
    const buf = this.buffers.get(fileKey)
    if (buf) {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = (opts.rate ?? 1) * (key === 'footstep' ? 0.9 + Math.random() * 0.2 : 1)
      const g = ctx.createGain()
      g.gain.value = vol
      src.connect(g).connect(this.sfx)
      src.start()
      return
    }
    this.synth(key, vol, opts.rate ?? 1)
  }

  // ── procedural fallbacks ──────────────────────────────────────────────
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  }

  private tone(freq: number, type: OscillatorType, t: number, a: number, peak: number, d: number, sweep?: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, t + a + d)
    const g = ctx.createGain()
    this.env(g, t, a, peak, d)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + a + d + 0.05)
  }

  private noiseBurst(t: number, freq: number, q: number, peak: number, d: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    this.env(g, t, 0.004, peak, d)
    src.connect(f).connect(g).connect(this.sfx)
    src.start(t, Math.random() * 1.5)
    src.stop(t + d + 0.05)
  }

  private synth(key: SfxKey, vol: number, rate: number) {
    const t = this.ctx!.currentTime + 0.005
    switch (key) {
      case 'footstep':
        this.noiseBurst(t, 900 + Math.random() * 700, 1.4, 0.22 * vol, 0.07)
        this.tone(110 + Math.random() * 30, 'sine', t, 0.003, 0.08 * vol, 0.05)
        break
      case 'jump':
        this.tone(320 * rate, 'triangle', t, 0.01, 0.12 * vol, 0.16, 640 * rate)
        this.noiseBurst(t, 2400, 0.8, 0.05 * vol, 0.12, 'highpass')
        break
      case 'land':
        this.tone(95, 'sine', t, 0.004, 0.3 * vol, 0.14, 55)
        this.noiseBurst(t, 500, 0.9, 0.2 * vol, 0.12, 'lowpass')
        break
      case 'click':
        this.tone(1250, 'triangle', t, 0.002, 0.08 * vol, 0.05, 900)
        break
      case 'hover':
        this.tone(1800, 'sine', t, 0.002, 0.025 * vol, 0.03)
        break
      case 'interact':
        this.tone(784, 'sine', t, 0.005, 0.1 * vol, 0.5)
        this.tone(1175, 'sine', t + 0.07, 0.005, 0.07 * vol, 0.6)
        break
      case 'open':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'sine', t + i * 0.06, 0.008, 0.08 * vol, 0.45))
        break
      case 'bell':
        ;[1318, 1976, 2637].forEach((f, i) => this.tone(f, 'sine', t + i * 0.004, 0.003, 0.12 * vol / (i + 1), 1.8))
        ;[1318, 1976].forEach((f) => this.tone(f, 'sine', t + 0.35, 0.003, 0.08 * vol, 1.4))
        break
      case 'close':
        ;[784, 587, 440].forEach((f, i) => this.tone(f, 'sine', t + i * 0.06, 0.008, 0.07 * vol, 0.35))
        break
      case 'companion':
        // the companion's signature: a soft, rising two-note "hm-hm"
        this.tone(660, 'sine', t, 0.012, 0.06 * vol, 0.16, 740)
        this.tone(990, 'sine', t + 0.11, 0.012, 0.05 * vol, 0.22, 1180)
        break
      case 'discover':
        ;[587, 880, 1175].forEach((f, i) => this.tone(f, 'sine', t + i * 0.09, 0.01, 0.06 * vol, 0.7))
        break
      case 'screen':
        // display waking up: a faint rising hum and a soft tick
        this.tone(180, 'sine', t, 0.05, 0.03 * vol, 0.5, 420)
        this.tone(2200, 'sine', t + 0.18, 0.002, 0.02 * vol, 0.08)
        break
    }
  }

  // ── ambience, birds, traffic hum and background music ───────────────────
  private startLoops() {
    const ctx = this.ctx
    if (!ctx || this.loopsStarted) return
    this.loopsStarted = true
    const layer = (name: Layer) => {
      const g = ctx.createGain()
      g.gain.value = SCAPES[this.scape][name]
      g.connect(this.ambience)
      this.layers[name] = g
      return g
    }
    const streetL = layer('street')
    const outdoorL = layer('outdoor')
    const parkL = layer('park')
    const officeL = layer('office')
    const roomL = layer('room')
    this.buildInteriorBeds(parkL, officeL, roomL)
    const amb = this.buffers.get('ambient')
    if (amb) this.loopBuffer(amb, streetL, 0.6)
    else {
      // city hum: filtered noise with a slow swell
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 420
      const g = ctx.createGain()
      g.gain.value = 0.16
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.07
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.06
      lfo.connect(lfoGain).connect(g.gain)
      src.connect(lp).connect(g).connect(streetL)
      src.start()
      lfo.start()
    }
    const birds = this.buffers.get('birds')
    if (birds) this.loopBuffer(birds, outdoorL, 0.35)
    else this.scheduleBirds(outdoorL)
    // vehicle engine hum, gain driven by the nearest car
    const engine = ctx.createOscillator()
    engine.type = 'sawtooth'
    engine.frequency.value = 58
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 190
    this.engineGain = ctx.createGain()
    this.engineGain.gain.value = 0
    engine.connect(lp).connect(this.engineGain).connect(streetL)
    engine.start()
    const music = this.buffers.get('music')
    if (music) this.loopBuffer(music, this.musicBus, 0.5)
    else this.generativeMusic()
  }

  private loops: AudioScheduledSourceNode[] = []
  private loopBuffer(buf: AudioBuffer, bus: GainNode, vol: number) {
    const src = this.ctx!.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = this.ctx!.createGain()
    g.gain.value = vol
    src.connect(g).connect(bus)
    src.start()
    this.loops.push(src)
  }

  private stopLoops() {
    this.loops.forEach((l) => {
      try {
        l.stop()
      } catch {
        /* already stopped */
      }
    })
    this.loops = []
    this.timers.forEach((t) => clearTimeout(t))
    this.timers = []
    // silence synthesised beds by detaching their layers
    Object.values(this.layers).forEach((g) => g?.disconnect())
    this.layers = {}
    this.loopsStarted = false
  }

  /** park water, office murmur + keyboard ticks, quiet room tone — all synthesised */
  private buildInteriorBeds(parkL: GainNode, officeL: GainNode, roomL: GainNode) {
    const ctx = this.ctx!
    const bed = (dest: GainNode, type: BiquadFilterType, freq: number, q: number, vol: number, lfoHz = 0, lfoDepth = 0) => {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      src.playbackRate.value = 0.7 + Math.random() * 0.2
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      const g = ctx.createGain()
      g.gain.value = vol
      if (lfoHz) {
        const lfo = ctx.createOscillator()
        lfo.frequency.value = lfoHz
        const lg = ctx.createGain()
        lg.gain.value = lfoDepth
        lfo.connect(lg).connect(g.gain)
        lfo.start()
      }
      src.connect(f).connect(g).connect(dest)
      src.start()
    }
    // park: a trickle of water that swells gently
    bed(parkL, 'bandpass', 1500, 0.6, 0.05, 0.23, 0.02)
    // office: soft voices far off (band-limited, slowly breathing) + a low air-handling hum
    bed(officeL, 'bandpass', 480, 0.9, 0.05, 0.31, 0.025)
    bed(officeL, 'bandpass', 760, 1.2, 0.025, 0.47, 0.015)
    // rooms: warm, quiet room tone
    bed(roomL, 'lowpass', 190, 0.7, 0.07)
    // keyboard ticks come in little typing runs while the office layer is up
    const type = () => {
      const g = this.layers.office
      if (ctx.state === 'running' && this.enabled && g && g.gain.value > 0.2) {
        const t = ctx.currentTime
        const n = 3 + Math.floor(Math.random() * 7)
        for (let i = 0; i < n; i++) {
          const st = t + i * (0.07 + Math.random() * 0.09)
          const src = ctx.createBufferSource()
          src.buffer = this.noise
          const f = ctx.createBiquadFilter()
          f.type = 'bandpass'
          f.frequency.value = 2600 + Math.random() * 1600
          f.Q.value = 3
          const e = ctx.createGain()
          this.env(e, st, 0.001, 0.012 + Math.random() * 0.008, 0.02)
          const pan = ctx.createStereoPanner()
          pan.pan.value = Math.random() * 1.4 - 0.7
          src.connect(f).connect(e).connect(pan).connect(g)
          src.start(st, Math.random())
          src.stop(st + 0.05)
        }
      }
      this.timers.push(window.setTimeout(type, 700 + Math.random() * 2600))
    }
    this.timers.push(window.setTimeout(type, 1200))
  }

  /** Crossfade the ambience to a place (street, park, office, education, home). */
  setSoundscape(kind: Soundscape) {
    if (kind === this.scape) return
    this.scape = kind
    if (!this.ctx) return
    const t = this.ctx.currentTime
    for (const [name, g] of Object.entries(this.layers) as [Layer, GainNode][]) g.gain.setTargetAtTime(SCAPES[kind][name], t, 0.9)
  }

  private scheduleBirds(dest: GainNode) {
    const chirp = () => {
      const ctx = this.ctx
      if (ctx && this.enabled && ctx.state === 'running') {
        const t = ctx.currentTime
        const base = 2400 + Math.random() * 1600
        const n = 2 + Math.floor(Math.random() * 4)
        for (let i = 0; i < n; i++) {
          const o = ctx.createOscillator()
          o.type = 'sine'
          const st = t + i * (0.09 + Math.random() * 0.05)
          o.frequency.setValueAtTime(base, st)
          o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), st + 0.06)
          const g = ctx.createGain()
          this.env(g, st, 0.01, 0.022, 0.07)
          const pan = ctx.createStereoPanner()
          pan.pan.value = Math.random() * 1.6 - 0.8
          o.connect(g).connect(pan).connect(dest)
          o.start(st)
          o.stop(st + 0.12)
        }
      }
      this.timers.push(window.setTimeout(chirp, 2500 + Math.random() * 6000))
    }
    this.timers.push(window.setTimeout(chirp, 1500))
  }

  private generativeMusic() {
    // soft pad chords (Fmaj7 → Am7 → Dm9 → Bbmaj7), slow attack, delay tail
    const chords = [
      [174.6, 220, 261.6, 329.6],
      [220, 261.6, 329.6, 392],
      [146.8, 220, 261.6, 349.2],
      [233.1, 293.7, 349.2, 440],
    ]
    const ctx = this.ctx!
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.42
    const fb = ctx.createGain()
    fb.gain.value = 0.35
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    delay.connect(fb).connect(delay)
    delay.connect(lp)
    lp.connect(this.musicBus)
    let i = 0
    const play = () => {
      if (this.ctx && this.ctx.state === 'running') {
        const t = this.ctx.currentTime
        for (const f of chords[i % chords.length]) {
          const o = this.ctx.createOscillator()
          o.type = 'triangle'
          o.frequency.value = f
          o.detune.value = Math.random() * 8 - 4
          const g = this.ctx.createGain()
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.018, t + 1.6)
          g.gain.linearRampToValueAtTime(0.0001, t + 6.2)
          o.connect(g)
          g.connect(lp)
          g.connect(delay)
          o.start(t)
          o.stop(t + 6.4)
        }
        // a gentle melodic pluck now and then
        if (Math.random() < 0.6) {
          const notes = chords[i % chords.length]
          const n = notes[Math.floor(Math.random() * notes.length)] * 2
          const o = this.ctx.createOscillator()
          o.type = 'sine'
          o.frequency.value = n
          const g = this.ctx.createGain()
          this.env(g, t + 1.2, 0.01, 0.025, 1.4)
          o.connect(g)
          g.connect(delay)
          g.connect(lp)
          o.start(t + 1.2)
          o.stop(t + 2.8)
        }
        i++
      }
      this.timers.push(window.setTimeout(play, 5200))
    }
    play()
  }

  /** 0 = far, 1 = right next to a vehicle. */
  setVehicleProximity(v: number) {
    if (!this.ctx || !this.engineGain) return
    this.engineGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.09, this.ctx.currentTime, 0.2)
  }
}

export const soundManager = new SoundManager()
