import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { getProject } from '@/data/projects'
import { inStudio } from '@/data/interiors'
import { FINAL_SPOT } from '@/data/locations'
import { type Place, useGameStore } from '@/stores/gameStore'
import { companion, say } from './companion'
import { enterInterior } from './interiors'
import { playerRuntime, SPAWN_YAW } from './runtime'
import { soundManager } from './sound/SoundManager'

/**
 * The visitor journey: how the landing hands over to the world, what counts
 * as a discovery, and when the companion speaks. The visitor is always in
 * control — guidance is event-driven (arriving somewhere, opening something)
 * plus a rare nudge after a long quiet spell. Nothing here blocks input.
 */

/** street-level points the companion can point toward */
export const PLACE_POINTS: Record<Place, Vector3> = {
  education: new Vector3(0, 5, -58),
  home: new Vector3(-13, 3, -25),
  office: new Vector3(18, 5, 17),
  park: new Vector3(-16, 2, 16),
  ai: new Vector3(-25.5, 2, 25),
  projects: new Vector3(18, 5, 17),
  final: new Vector3(FINAL_SPOT[0], 2.5, FINAL_SPOT[2]),
}

const ORDER: Place[] = ['education', 'home', 'office', 'park', 'projects', 'final']

const state = {
  started: false,
  lastDiscovery: 0,
  lastNudge: 0,
  studioSeen: false,
  finalHinted: false,
  unsub: null as null | (() => void),
}

export function beginJourney(kind: 'street' | 'work') {
  const g = useGameStore.getState()
  if (g.phase !== 'intro') return
  soundManager.unlock()
  soundManager.play('open', { volume: 0.8 })
  navigate('/street', true)
  playerRuntime.faceYaw = SPAWN_YAW
  if (kind === 'street') {
    g.setPhase('transition')
    return
  }
  // "View my work": straight to the Project Studio inside NFC Solutions
  // mark the journey as started first so the street welcome lines don't queue up
  state.started = true
  state.lastDiscovery = performance.now()
  say('Let’s head to the <b>office</b>.', { ms: 2600, emote: 'point', point: PLACE_POINTS.office, interrupt: true })
  g.setPhase('playing')
  window.setTimeout(() => enterInterior('office', 'nfc', { spot: 'studio', approachMs: 1900 }), 250)
}

/** Quick travel to the projects from anywhere (menu, street pavilions, CTAs). */
export function goToProjects() {
  const g = useGameStore.getState()
  if (g.interior === 'office') {
    g.closePanels()
    enterInterior('office', undefined, { spot: 'studio', approachMs: 0, within: true })
    return
  }
  g.closePanels()
  say('Let’s head to the <b>office</b> — the projects live there.', { ms: 3000, emote: 'point', point: PLACE_POINTS.office, interrupt: true })
  enterInterior('office', g.interior ? undefined : 'nfc', { spot: 'studio', approachMs: g.interior ? 0 : 900, from: g.interior ?? undefined })
}

function discover(place: Place) {
  const g = useGameStore.getState()
  if (g.discovered.includes(place)) return false
  g.discover(place)
  state.lastDiscovery = performance.now()
  soundManager.play('discover', { volume: 0.6 })
  return true
}

const ZONE_LINES: Record<string, { place: Place; text: string }> = {
  campus: { place: 'education', text: 'This is where the journey began — step inside.' },
  home: { place: 'home', text: 'Want to know the person behind the work?' },
  nfc: { place: 'office', text: 'This is where ideas become real products.' },
  park: { place: 'park', text: 'Want to see how Naveen approaches design? Follow the stones.' },
}

function onStore(s: ReturnType<typeof useGameStore.getState>, prev: ReturnType<typeof useGameStore.getState>) {
  // first moments on the street: two or three short, warm lines
  if (s.phase === 'playing' && prev.phase !== 'playing' && !state.started) {
    state.started = true
    state.lastDiscovery = performance.now()
    say('Welcome. Take your time — there’s a lot to explore here.', { ms: 4200, emote: 'wave' })
    say('Walk around, meet the people, and discover the projects inside <b>NFC Solutions</b>.', { ms: 5200, emote: 'explain' })
    say('Let’s start with where the journey began.', { ms: 3800, point: PLACE_POINTS.education })
  }
  // arriving somewhere for the first time
  if (s.visitedZones.length > prev.visitedZones.length) {
    const id = s.visitedZones[s.visitedZones.length - 1]
    const z = ZONE_LINES[id]
    if (z && discover(z.place)) say(z.text, { emote: 'excited' })
  }
  if (s.interior !== prev.interior && s.interior) {
    if (s.interior === 'office') {
      discover('office')
      if (!s.establishSpot) window.setTimeout(() => say('Welcome to the office.', { ms: 3000, emote: 'greet' }), 900)
    }
    if (s.interior === 'education') discover('education')
    if (s.interior === 'home') discover('home')
  }
  if (s.establishSpot === 'studio' && prev.establishSpot !== 'studio') {
    state.studioSeen = true
    discover('projects')
    window.setTimeout(() => say('This is the <b>Project Studio</b>. Each screen is a project — walk up to one.', { ms: 5000, emote: 'explain' }), 700)
  }
  // opening a project: a short introduction, straight away
  if (s.activeProjectId && s.activeProjectId !== prev.activeProjectId) {
    const p = getProject(s.activeProjectId)
    if (p) say(`This is <b>${p.title}</b>.`, { ms: 2600, emote: 'explain', interrupt: true })
    discover('projects')
  }
  if (s.activeLocationId === 'park-ai' && prev.activeLocationId !== 'park-ai') discover('ai')
  if (s.activeLocationId === 'final' && prev.activeLocationId !== 'final') discover('final')
}

/** per-frame checks (called by the companion's frame loop) */
export function tickJourney(now: number) {
  const g = useGameStore.getState()
  if (g.phase !== 'playing' || g.mode !== 'street') return
  const p = playerRuntime.position
  if (g.interior === 'office' && !state.studioSeen && inStudio(p.x, p.z)) {
    state.studioSeen = true
    discover('projects')
    say('Want to see what he has been building? Each screen is a project.', { emote: 'excited' })
  }
  if (!g.interior && !state.finalHinted) {
    const seen = ORDER.filter((pl) => pl !== 'final' && g.discovered.includes(pl)).length
    if (seen >= 4 && now - companion.lastSpokeAt > 8000) {
      state.finalHinted = true
      say('One last place — the <b>lookout</b> in the Design Park.', { point: PLACE_POINTS.final })
    }
  }
  // a rare nudge after a long quiet spell (never while reading something)
  if (g.activeLocationId || g.activeProjectId || g.interior) return
  if (now - state.lastDiscovery > 80000 && now - companion.lastSpokeAt > 60000 && now - state.lastNudge > 90000) {
    state.lastNudge = now
    const next = nearestUnvisited(g.discovered, p)
    if (next) say('There’s more to discover nearby.', { point: PLACE_POINTS[next] })
  }
}

function nearestUnvisited(done: Place[], p: Vector3) {
  let best: Place | null = null
  let bd = Infinity
  for (const pl of ORDER) {
    if (done.includes(pl) || pl === 'ai') continue
    const d = PLACE_POINTS[pl].distanceTo(p)
    if (d < bd) {
      bd = d
      best = pl
    }
  }
  return best
}

export function initJourney() {
  state.unsub?.()
  state.unsub = useGameStore.subscribe(onStore)
  return () => state.unsub?.()
}
