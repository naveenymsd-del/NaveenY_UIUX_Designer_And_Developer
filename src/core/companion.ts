import { Vector3 } from 'three'
import { soundManager } from './sound/SoundManager'

/**
 * Shared state for the AI companion. Gameplay/UI code talks to it through
 * say() / emote() / pointAt(); the 3D model (effects/AICompanion) reads it
 * every frame. Messages are queued and paced so the companion never chatters.
 */
export type Emote = 'idle' | 'greet' | 'wave' | 'point' | 'think' | 'excited' | 'explain' | 'celebrate'

interface Line {
  text: string
  ms: number
  emote?: Emote
  point?: Vector3 | null
}

export const companion = {
  message: '',
  showUntil: 0,
  emote: 'idle' as Emote,
  emoteSince: 0,
  emoteUntil: 0,
  /** world point the companion points at / looks toward */
  point: null as Vector3 | null,
  pointUntil: 0,
  queue: [] as Line[],
  /** earliest time the next queued line may start (breathing room between lines) */
  nextAt: 0,
  lastSpokeAt: 0,
  /** the voice guide's state (src/ai) — drives a subtle listening / thinking / speaking pulse */
  voice: 'idle' as 'idle' | 'listening' | 'thinking' | 'speaking' | 'navigating',
}

/**
 * Queue a line. `interrupt` replaces whatever is showing (used for direct
 * reactions such as opening a project); otherwise lines wait their turn.
 */
export function say(text: string, opts: { ms?: number; emote?: Emote; point?: Vector3 | null; interrupt?: boolean } = {}) {
  const line: Line = { text, ms: opts.ms ?? Math.min(7000, 2200 + text.replace(/<[^>]+>/g, '').length * 55), emote: opts.emote, point: opts.point }
  if (opts.interrupt) {
    companion.queue.length = 0
    companion.nextAt = 0
    companion.showUntil = 0
  }
  companion.queue.push(line)
}

export function emote(kind: Emote, ms = 1800) {
  const now = performance.now()
  companion.emote = kind
  companion.emoteSince = now
  companion.emoteUntil = now + ms
}

export function pointAt(p: Vector3 | null, ms = 2600) {
  companion.point = p ? p.clone() : null
  companion.pointUntil = performance.now() + ms
  if (p) emote('point', ms)
}

export function clearCompanion() {
  companion.queue.length = 0
  companion.showUntil = 0
}

/** called once per frame by the 3D companion; returns the visible message or null */
export function tickCompanion(now: number): string | null {
  if (now >= companion.showUntil && companion.queue.length && now >= companion.nextAt) {
    const l = companion.queue.shift()!
    companion.message = l.text
    companion.showUntil = now + l.ms
    companion.nextAt = companion.showUntil + 650
    companion.lastSpokeAt = now
    if (l.emote) emote(l.emote, Math.min(l.ms, 2600))
    if (l.point) pointAt(l.point)
    soundManager.play('companion', { volume: 0.5 })
  }
  if (now >= companion.emoteUntil && companion.emote !== 'idle') companion.emote = 'idle'
  if (now >= companion.pointUntil) companion.point = null
  return now < companion.showUntil ? companion.message : null
}

/**
 * Show a line that is still being spoken (a streaming realtime transcript):
 * replaces what's on screen at once and grows as more arrives.
 */
export function sayLive(text: string, ms = 4000) {
  const now = performance.now()
  if (companion.message !== text) companion.message = text
  companion.queue.length = 0
  companion.showUntil = now + ms
  companion.nextAt = companion.showUntil + 300
  companion.lastSpokeAt = now
}
