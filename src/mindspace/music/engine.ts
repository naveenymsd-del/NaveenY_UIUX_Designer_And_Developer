import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { asset } from '@/utils/basePath'
import { albumOf, SCALES, TRACKS, trackById, type GenSource, type Style, type Track } from './library'

/**
 * The one music player for all of Mindspace. A single AudioContext and a
 * single <audio> element (for hosted files) — every UI piece (the Music Lounge,
 * the mini-player, the games' sound effects) talks to this module, so playback
 * never doubles up and survives opening and closing windows.
 * Nothing starts until the visitor presses play (browsers require that too).
 */
export type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'error'
interface PlayerState {
  status: Status
  trackId: string | null
  queue: string[]
  volume: number
  muted: boolean
  error: string | null
  /** the visitor has pressed play at least once this visit */
  started: boolean
}

const PREF = 'mindspace:music'
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
function loadPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(PREF) ?? '{}')
    return { volume: typeof v.volume === 'number' ? clamp01(v.volume) : 0.75, muted: !!v.muted, lastTrack: trackById(v.lastTrack)?.id ?? null }
  } catch {
    return { volume: 0.75, muted: false, lastTrack: null }
  }
}
function savePrefs() {
  try {
    const s = usePlayer.getState()
    localStorage.setItem(PREF, JSON.stringify({ volume: s.volume, muted: s.muted, lastTrack: s.trackId }))
  } catch {
    /* storage blocked: preferences just aren't remembered */
  }
}
const prefs = loadPrefs()
export const usePlayer = create<PlayerState>(() => ({ status: 'idle', trackId: prefs.lastTrack ?? TRACKS[0].id, queue: TRACKS.map((t) => t.id), volume: prefs.volume, muted: prefs.muted, error: null, started: false }))
const set = (p: Partial<PlayerState>) => usePlayer.setState(p)

// ── audio graph ─────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null
let master: GainNode, musicOut: GainNode, sfxOut: GainNode, verbIn: GainNode
let noise: AudioBuffer
let duck = 1
function graph() {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const c = new AC()
  ctx = c
  master = c.createGain()
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 3
  master.connect(comp)
  comp.connect(c.destination)
  musicOut = c.createGain()
  musicOut.connect(master)
  sfxOut = c.createGain()
  sfxOut.gain.value = 0.6
  sfxOut.connect(master)
  // a soft room: a generated impulse response (no files)
  const verb = c.createConvolver()
  const len = Math.floor(c.sampleRate * 2.6)
  const ir = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  }
  verb.buffer = ir
  verbIn = c.createGain()
  verbIn.gain.value = 0.32
  verbIn.connect(verb)
  verb.connect(musicOut)
  noise = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  applyVolume()
  return c
}
function applyVolume() {
  if (!ctx) return
  const s = usePlayer.getState()
  master.gain.setTargetAtTime(s.muted ? 0 : 1, ctx.currentTime, 0.02)
  musicOut.gain.setTargetAtTime(s.volume * s.volume * duck, ctx.currentTime, 0.12)
  if (audioEl) audioEl.muted = false
}

// ── generative performance ─────────────────────────────────────────────────
interface Session { track: Track; spec: GenSource; bus: GainNode; t0: number; next: number; stepDur: number; steps: number; timer: number }
let session: Session | null = null
let audioEl: HTMLAudioElement | null = null
let fileNode: MediaElementAudioSourceNode | null = null
let pausedAt = 0

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)
const hash = (a: number, b: number) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x) }
function deg(root: number, scale: readonly number[], d: number) {
  const n = scale.length
  const o = Math.floor(d / n)
  return root + scale[((d % n) + n) % n] + 12 * o
}
const STYLES: Record<Style, { pad: OscillatorType; cut: number; bass: number[]; arp: number; arpType: OscillatorType; drums: 'none' | 'soft' | 'full' | 'lofi' | 'pulse'; swing: number; mel: number; seventh: boolean }> = {
  warm: { pad: 'triangle', cut: 1700, bass: [0, 8], arp: 2, arpType: 'triangle', drums: 'soft', swing: 0, mel: 0.42, seventh: false },
  bouncy: { pad: 'triangle', cut: 2300, bass: [0, 6, 8, 14], arp: 2, arpType: 'triangle', drums: 'full', swing: 0, mel: 0.5, seventh: false },
  airy: { pad: 'sine', cut: 1500, bass: [0], arp: 4, arpType: 'sine', drums: 'none', swing: 0, mel: 0.3, seventh: true },
  lofi: { pad: 'sawtooth', cut: 850, bass: [0, 10], arp: 4, arpType: 'triangle', drums: 'lofi', swing: 0.33, mel: 0.34, seventh: true },
  pulse: { pad: 'sawtooth', cut: 1100, bass: [0, 4, 8, 12], arp: 1, arpType: 'sine', drums: 'pulse', swing: 0, mel: 0.28, seventh: false },
}

function tone(bus: AudioNode, midi: number, t: number, dur: number, o: { type?: OscillatorType; gain?: number; attack?: number; release?: number; cut?: number; detune?: number }) {
  const c = ctx!
  const osc = c.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.value = mtof(midi)
  osc.detune.value = o.detune ?? 0
  const g = c.createGain()
  const a = o.attack ?? 0.01, r = o.release ?? 0.3
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(o.gain ?? 0.05, t + a)
  g.gain.setTargetAtTime(0, t + Math.max(a, dur), r / 3)
  let node: AudioNode = osc
  if (o.cut) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.cut
    osc.connect(f)
    node = f
  }
  node.connect(g)
  g.connect(bus)
  osc.start(t)
  osc.stop(t + Math.max(a, dur) + r * 1.6 + 0.05)
}
function hit(bus: AudioNode, t: number, o: { gain: number; dur: number; type: BiquadFilterType; freq: number }) {
  const c = ctx!
  const src = c.createBufferSource()
  src.buffer = noise
  const f = c.createBiquadFilter()
  f.type = o.type
  f.frequency.value = o.freq
  const g = c.createGain()
  g.gain.setValueAtTime(o.gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  src.connect(f).connect(g).connect(bus)
  src.start(t, Math.random() * 0.5)
  src.stop(t + o.dur + 0.02)
}
function kick(bus: AudioNode, t: number, gain: number) {
  const c = ctx!
  const o = c.createOscillator()
  o.frequency.setValueAtTime(130, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
  o.connect(g).connect(bus)
  o.start(t)
  o.stop(t + 0.32)
}

function scheduleStep(s: Session, step: number, t: number) {
  const { spec } = s
  const st = STYLES[spec.style]
  const scale = SCALES[spec.mode]
  const bar = Math.floor(step / 16), p = step % 16
  const bars = Math.floor(s.steps / 16)
  const frac = bar / bars
  const section = bar < 2 ? 0 : frac < 0.32 ? 1 : frac < 0.86 ? 2 : 3
  // fade in over the first bar, out over the last four
  const v = Math.min(1, (step + 1) / 16 + 0.35, (s.steps - step) / 64)
  if (v <= 0) return
  const c = spec.progression[bar % spec.progression.length]
  const chord = st.seventh ? [c, c + 2, c + 4, c + 6] : [c, c + 2, c + 4]
  const at = st.swing && p % 4 === 2 ? t + s.stepDur * st.swing : t
  const barDur = s.stepDur * 16
  // pad: the bar's chord, voiced around middle C
  if (p === 0) {
    for (const d of chord) {
      let m = deg(spec.root, scale, d)
      while (m > 72) m -= 12
      while (m < 55) m += 12
      for (const det of [-7, 7]) tone(s.bus, m, t, barDur, { type: st.pad, gain: 0.032 * v, attack: 0.4, release: 1.2, cut: st.cut, detune: det })
    }
  }
  // bass
  if (section >= 1 && st.bass.includes(p)) {
    const m = deg(spec.root, scale, c) - 24 + (spec.style === 'bouncy' && p === 6 ? 12 : 0)
    tone(s.bus, m, at, s.stepDur * (spec.style === 'airy' ? 12 : 3), { type: 'triangle', gain: 0.13 * v, attack: 0.01, release: 0.25, cut: 600 })
  }
  // arpeggio
  if ((section >= 1 || spec.style === 'airy') && p % st.arp === 0) {
    const tones = [...chord, c + 7]
    const i = (p / st.arp) % (tones.length * 2 - 2)
    const idx = i < tones.length ? i : tones.length * 2 - 2 - i
    const m = deg(spec.root, scale, tones[idx]) + 12
    tone(s.bus, m, at, s.stepDur * (st.arp === 1 ? 0.8 : 1.5), { type: st.arpType, gain: (st.arp === 1 ? 0.018 : 0.03) * v, attack: 0.005, release: spec.style === 'airy' ? 0.9 : 0.22 })
  }
  // melody (the middle of the piece)
  if (section === 2 && p % 2 === 0 && !(bar % 2 === 1 && p >= 12) && hash(spec.seed, step) < st.mel) {
    const d = c + [0, 2, 4, 1, 3, 5, 4, 2][Math.floor(hash(spec.seed + 7, step) * 8)]
    let m = deg(spec.root, scale, d) + 12
    while (m < 67) m += 12
    tone(s.bus, m, at, s.stepDur * 2, { type: 'sine', gain: 0.05 * v, attack: 0.005, release: 0.7 })
    tone(s.bus, m + 12, at, s.stepDur, { type: 'sine', gain: 0.012 * v, attack: 0.005, release: 0.4 })
  }
  // drums
  const drumsOn = st.drums !== 'none' && (st.drums === 'soft' ? section === 2 : section >= 1 && section < 3)
  if (drumsOn) {
    const b = s.bus
    if (st.drums === 'full') {
      if (p === 0 || p === 8) kick(b, t, 0.55 * v)
      if (p === 4 || p === 12) hit(b, t, { gain: 0.12 * v, dur: 0.16, type: 'bandpass', freq: 1500 })
      if (p % 2 === 0) hit(b, t, { gain: (p === 14 ? 0.04 : 0.025) * v, dur: p === 14 ? 0.16 : 0.04, type: 'highpass', freq: 7000 })
    } else if (st.drums === 'pulse') {
      if (p % 4 === 0) kick(b, t, 0.42 * v)
      if (p === 12) hit(b, t, { gain: 0.06 * v, dur: 0.14, type: 'bandpass', freq: 1800 })
      hit(b, t, { gain: (p % 2 ? 0.01 : 0.018) * v, dur: 0.03, type: 'highpass', freq: 8000 })
    } else if (st.drums === 'lofi') {
      if (p === 0 || p === 10) kick(b, at, 0.45 * v)
      if (p === 4 || p === 12) hit(b, at, { gain: 0.07 * v, dur: 0.2, type: 'bandpass', freq: 1200 })
      if (p % 2 === 0) hit(b, at, { gain: 0.018 * v, dur: 0.05, type: 'highpass', freq: 6000 })
    } else {
      if (p === 0) kick(b, t, 0.3 * v)
      if (p % 2 === 0) hit(b, at, { gain: 0.014 * v, dur: 0.06, type: 'highpass', freq: 5000 })
    }
  }
}

function startGenerative(t: Track, from: number) {
  const c = ctx!
  const spec = t.source as GenSource
  const stepDur = 60 / spec.bpm / 4
  const bus = c.createGain()
  bus.connect(musicOut)
  bus.connect(verbIn)
  const s: Session = { track: t, spec, bus, t0: c.currentTime + 0.08 - from, next: Math.ceil(from / stepDur), stepDur, steps: Math.floor(t.duration / stepDur), timer: 0 }
  const tick = () => {
    if (session !== s || !ctx) return
    const now = ctx.currentTime
    while (s.next < s.steps && s.t0 + s.next * stepDur < now + 0.2) {
      scheduleStep(s, s.next, s.t0 + s.next * stepDur)
      s.next++
    }
    if (now - s.t0 >= t.duration) void next(true)
  }
  session = s
  s.timer = window.setInterval(tick, 25)
  tick()
}

function stopSound() {
  if (session) {
    const s = session
    session = null
    clearInterval(s.timer)
    if (ctx) s.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.04)
    setTimeout(() => s.bus.disconnect(), 500)
  }
  if (audioEl && !audioEl.paused) audioEl.pause()
}

async function startTrack(id: string, from = 0) {
  const t = trackById(id)
  if (!t) return
  stopSound()
  const c = graph()
  if (c.state === 'suspended') await c.resume().catch(() => undefined)
  pausedAt = from
  set({ trackId: id, status: 'loading', error: null, started: true })
  savePrefs()
  mediaSession(t)
  if (t.source.kind === 'generative') {
    startGenerative(t, from)
    set({ status: 'playing' })
    return
  }
  // a hosted file: one <audio> element, routed through the same volume and mute
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.crossOrigin = 'anonymous'
    audioEl.preload = 'auto'
    audioEl.addEventListener('ended', () => void next(true))
    fileNode = c.createMediaElementSource(audioEl)
    fileNode.connect(musicOut)
  }
  audioEl.src = asset(t.source.url)
  audioEl.currentTime = from
  try {
    await audioEl.play()
    if (usePlayer.getState().trackId === id) set({ status: 'playing' })
  } catch {
    set({ status: 'error', error: `“${t.title}” couldn’t be loaded. Try another track.` })
  }
}

export function position() {
  const t = trackById(usePlayer.getState().trackId)
  if (!t) return 0
  if (session && ctx) return Math.min(t.duration, Math.max(0, ctx.currentTime - session.t0))
  if (audioEl && t.source.kind === 'file' && !audioEl.paused) return audioEl.currentTime
  return pausedAt
}

export async function play(id?: string, queue?: string[]) {
  if (queue?.length) set({ queue })
  const target = id ?? usePlayer.getState().trackId ?? TRACKS[0].id
  await startTrack(target, 0)
}
export function pause() {
  const s = usePlayer.getState()
  if (s.status !== 'playing' && s.status !== 'loading') return
  pausedAt = position()
  stopSound()
  set({ status: 'paused' })
}
export async function resume() {
  const s = usePlayer.getState()
  if (!s.trackId) return play()
  await startTrack(s.trackId, s.status === 'paused' ? pausedAt : 0)
}
export function toggle() {
  const s = usePlayer.getState()
  if (s.status === 'playing' || s.status === 'loading') pause()
  else void resume()
}
export async function next(auto = false) {
  const s = usePlayer.getState()
  const i = s.queue.indexOf(s.trackId ?? '')
  const id = s.queue[(i + 1) % s.queue.length]
  if (auto && i === s.queue.length - 1 && s.queue.length > 1) return startTrack(id, 0)
  return startTrack(id, 0)
}
export async function prev() {
  const s = usePlayer.getState()
  if (position() > 3) return seek(0)
  const i = s.queue.indexOf(s.trackId ?? '')
  return startTrack(s.queue[(i - 1 + s.queue.length) % s.queue.length], 0)
}
export function seek(sec: number) {
  const s = usePlayer.getState()
  const t = trackById(s.trackId)
  if (!t) return
  const to = Math.min(t.duration - 1, Math.max(0, sec))
  if (s.status === 'playing') void startTrack(t.id, to)
  else pausedAt = to
}
export function setVolume(v: number) {
  set({ volume: clamp01(v), ...(v > 0 ? { muted: false } : {}) })
  applyVolume()
  savePrefs()
}
export function toggleMute() {
  set({ muted: !usePlayer.getState().muted })
  applyVolume()
  savePrefs()
}
/** while a game is on screen the music steps back so its sounds come through */
export function setDuck(f: number) {
  duck = f
  applyVolume()
}

function mediaSession(t: Track) {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: albumOf(t).artist, album: albumOf(t).title })
    navigator.mediaSession.setActionHandler('play', () => void resume())
    navigator.mediaSession.setActionHandler('pause', () => pause())
    navigator.mediaSession.setActionHandler('nexttrack', () => void next())
    navigator.mediaSession.setActionHandler('previoustrack', () => void prev())
  } catch {
    /* not supported here */
  }
}

// development only: lets the automated checks see that sound is really being scheduled
if (import.meta.env.DEV) (window as unknown as { __music: unknown }).__music = { position, ctx: () => ctx?.state ?? 'none', steps: () => session?.next ?? -1 }

/** the playback position for the UI (a few updates a second, only while mounted) */
export function usePosition() {
  const [p, setP] = useState(position)
  useEffect(() => {
    const id = window.setInterval(() => setP(position()), 250)
    return () => clearInterval(id)
  }, [])
  return p
}

// ── game sound effects (same context, same master mute) ──────────────────────
export type Sfx = 'catch' | 'bad' | 'combo' | 'pop' | 'bonus' | 'drop' | 'land' | 'perfect' | 'fall' | 'start' | 'end' | 'tick'
export function sfx(kind: Sfx) {
  try {
    const c = graph()
    if (c.state === 'suspended') void c.resume()
    if (usePlayer.getState().muted) return
    const t = c.currentTime + 0.005
    const o = sfxOut
    const blip = (m: number, d: number, type: OscillatorType = 'sine', gain = 0.12, at = 0) => tone(o, m, t + at, d, { type, gain, attack: 0.004, release: 0.12 })
    switch (kind) {
      case 'catch': blip(76, 0.05, 'triangle'); blip(83, 0.06, 'triangle', 0.1, 0.05); break
      case 'combo': [72, 76, 79, 84].forEach((m, i) => blip(m, 0.06, 'triangle', 0.1, i * 0.05)); break
      case 'bad': blip(48, 0.18, 'sawtooth', 0.08); blip(45, 0.22, 'sawtooth', 0.06, 0.08); break
      case 'pop': blip(84 + Math.floor(Math.random() * 6), 0.03, 'sine', 0.14); hit(o, t, { gain: 0.08, dur: 0.05, type: 'highpass', freq: 3000 }); break
      case 'bonus': [79, 83, 86, 91].forEach((m, i) => blip(m, 0.07, 'sine', 0.1, i * 0.045)); break
      case 'drop': blip(67, 0.06, 'triangle', 0.06); break
      case 'land': kick(o, t, 0.5); blip(60, 0.05, 'triangle', 0.06); break
      case 'perfect': [72, 79, 84].forEach((m, i) => blip(m, 0.08, 'triangle', 0.1, i * 0.06)); break
      case 'fall': [64, 60, 55, 48].forEach((m, i) => blip(m, 0.12, 'square', 0.05, i * 0.1)); break
      case 'start': blip(72, 0.06, 'triangle', 0.1); blip(79, 0.1, 'triangle', 0.1, 0.07); break
      case 'end': [79, 76, 72].forEach((m, i) => blip(m, 0.12, 'triangle', 0.1, i * 0.1)); break
      case 'tick': blip(88, 0.02, 'sine', 0.05); break
    }
  } catch {
    /* audio unavailable: the game simply runs silently */
  }
}
