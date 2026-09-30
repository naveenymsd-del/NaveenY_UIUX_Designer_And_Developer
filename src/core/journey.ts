import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { getProject } from '@/data/projects'
import { inStudio } from '@/data/interiors'
import { STORY_STOPS, getStop, type StopId } from '@/data/world'
import { type Place, useGameStore } from '@/stores/gameStore'
import { companion, say } from './companion'
import { enterInterior } from './interiors'
import { playerRuntime, SPAWN_YAW } from './runtime'
import { soundManager } from './sound/SoundManager'
import { useDayNight } from './dayNight'
import { useUIStore } from '@/stores/uiStore'

/**
 * The visitor journey: how the landing hands over to the world, what counts
 * as a discovery, and when the companion speaks. The visitor is always in
 * control — guidance is event-driven (arriving somewhere, opening something)
 * plus a rare nudge after a long quiet spell. Nothing here blocks input.
 */

/** where the companion points for each milestone — from the one location config */
const pt = (id: StopId) => new Vector3(...getStop(id).point)
export const PLACE_POINTS: Record<Place, Vector3> = {
  home: pt('home'),
  education: pt('education'),
  career: new Vector3(6, 2, -40),
  office: pt('nfcSolutions'),
  projects: pt('projects'),
  park: pt('designJourney'),
  ai: pt('designJourney'),
  cafe: pt('contactCafe'),
}

const ORDER: Place[] = STORY_STOPS.map((st) => st.place!)
const stopFor = (place: Place) => STORY_STOPS.find((st) => st.place === place)
/** the next story stop not yet discovered */
export function nextStop(discovered: Place[]) {
  return STORY_STOPS.find((st) => !discovered.includes(st.place!)) ?? null
}

const state = {
  started: false,
  lastDiscovery: 0,
  lastNudge: 0,
  studioSeen: false,
  /** time-of-day lines (each said at most once) */
  dayAtStart: null as boolean | null,
  saidChanging: false,
  saidKeepGoing: false,
  saidParkNight: false,
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

/** first arrival at a story stop: its line, then (after a beat) a nudge toward the next one */
function arrive(place: Place, delay = 900) {
  if (!discover(place)) return
  const st = stopFor(place)
  if (!st) return
  window.setTimeout(() => say(st.hello, { ms: 4000, emote: 'excited' }), delay)
}

function suggestNext(delay = 900) {
  const n = nextStop(useGameStore.getState().discovered)
  if (!n) return
  window.setTimeout(() => say(n.suggest, { ms: 4000, point: new Vector3(...n.point) }), delay)
}

/** approaching a building from the street (before entering) */
const ZONE_LINES: Record<string, string> = {
  home: 'Step inside my <b>home</b> — this is who I am.',
  campus: 'That’s where the story <b>started</b>.',
  growth: 'Walk this path — it’s how I <b>grew</b>, one step at a time.',
  nfc: 'Ready to see where the journey became <b>real</b>?',
  cafe: 'The <b>Contact Café</b> — the last stop. Come in.',
}

function onStore(s: ReturnType<typeof useGameStore.getState>, prev: ReturnType<typeof useGameStore.getState>) {
  // the START: two short, warm lines, then the first suggestion
  if (s.phase === 'playing' && prev.phase !== 'playing' && !state.started) {
    state.started = true
    state.lastDiscovery = performance.now()
    say('Hey! Welcome to <b>Naveen’s world</b>. I’m your AI guide.', { ms: 3600, emote: 'wave' })
    say('Take your time — there’s a lot to explore.', { ms: 3000, emote: 'explain' })
    say('I can take you to his profile, education, workplace, projects, design process or the <b>Contact Café</b>.', { ms: 4600, emote: 'explain' })
    say('Where would you like to go?', { ms: 3000, emote: 'think' })
    // …and offer the shortcuts once (it's non-blocking; walking closes nothing)
    window.setTimeout(() => {
      const g = useGameStore.getState()
      if (g.phase === 'playing' && !g.interior && !g.activeLocationId) useUIStore.getState().setGuideOpen(true)
    }, 15500)
  }
  // approaching somewhere for the first time
  if (s.visitedZones.length > prev.visitedZones.length) {
    const id = s.visitedZones[s.visitedZones.length - 1]
    if (id === 'growth') discover('career')
    const line = ZONE_LINES[id]
    if (line) say(line, { ms: 3400, emote: 'point' })
  }
  // leaving a room: hand the visitor on to the next chapter
  if (s.interior !== prev.interior && !s.interior && prev.interior) suggestNext()
  // entering a room = arriving at its chapter
  if (s.interior !== prev.interior && s.interior) {
    if (s.interior === 'office') {
      if (s.establishSpot === 'studio') discover('office')
      else arrive('office')
    }
    if (s.interior === 'education') arrive('education')
    if (s.interior === 'home') arrive('home')
    if (s.interior === 'cafe') arrive('cafe')
  }
  if (s.establishSpot === 'studio' && prev.establishSpot !== 'studio') {
    state.studioSeen = true
    arrive('projects', 700)
  }
  // opening a project: a short introduction, straight away
  if (s.activeProjectId && s.activeProjectId !== prev.activeProjectId) {
    const p = getProject(s.activeProjectId)
    if (p) say(`This is <b>${p.title}</b>.`, { ms: 2600, emote: 'explain', interrupt: true })
    discover('projects')
  }
  if (s.activeLocationId === 'park-ai' && prev.activeLocationId !== 'park-ai') discover('ai')
}

/** per-frame checks (called by the companion's frame loop) */
export function tickJourney(now: number) {
  const g = useGameStore.getState()
  if (g.phase !== 'playing' || g.mode !== 'street') return
  const p = playerRuntime.position
  // the evening arriving during a visit: two quiet remarks, never a running commentary
  const dn = useDayNight.getState()
  if (state.dayAtStart === null) state.dayAtStart = dn.phase === 'day'
  if (state.dayAtStart && !state.saidChanging && (dn.phase === 'golden' || dn.phase === 'sunset')) {
    state.saidChanging = true
    say('The city is changing.', { ms: 3000, emote: 'think' })
  }
  if (state.saidChanging && !state.saidKeepGoing && dn.phase === 'night') {
    state.saidKeepGoing = true
    say('Let’s keep exploring.', { ms: 2800, emote: 'excited' })
  }
  if (dn.night && !state.saidParkNight && !g.interior && p.x > -43 && p.x < -8 && p.z > 7 && p.z < 43) {
    state.saidParkNight = true
    say('Even the ideas look different at night.', { ms: 3600, emote: 'think' })
  }
  // anywhere in the Design Park counts as having found it
  if (!g.interior && !g.discovered.includes('park') && p.x > -43 && p.x < -8 && p.z > 7 && p.z < 43) {
    arrive('park', 0)
    suggestNext(9000)
  }
  if (g.interior === 'office' && !state.studioSeen && inStudio(p.x, p.z)) {
    state.studioSeen = true
    arrive('projects', 0)
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
