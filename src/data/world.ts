import type { InteriorId } from './interiors'
import type { Place } from '@/stores/gameStore'

/**
 * THE journey, in one place. Every system reads its locations from here:
 * the minimap (markers, route line, active highlight), the AI guide (quick
 * links, typed commands), navigateToLocation (arrival point, room, camera),
 * the "Next stop" chip, the menu and the companion's lines.
 *
 * Order = the recommended story path. Visitors can still go anywhere.
 * To add a stop: add an entry (and, if it has a room, an INTERIORS entry).
 */
export type StopId = 'start' | 'home' | 'education' | 'nfcSolutions' | 'projects' | 'designJourney' | 'contactCafe'
export type StopIcon = 'start' | 'home' | 'education' | 'office' | 'projects' | 'design' | 'cafe'

export interface WorldStop {
  id: StopId
  /** short uppercase label (minimap, guide) */
  label: string
  /** display name */
  name: string
  /** the question this chapter answers */
  line: string
  icon: StopIcon
  /** journey milestone this stop completes (null = not a milestone) */
  place: Place | null
  /** minimap marker position (world x, z) — tuned so labels never overlap */
  mapAt: [number, number]
  /** street arrival point for navigation + facing yaw */
  arrive: [number, number]
  yaw: number
  /** enter this room on arrival (via this street interaction's approach shot) */
  room?: { id: InteriorId; location: string; spot?: string }
  /** where the companion points when suggesting this stop */
  point: [number, number, number]
  /** companion lines: on arrival, and when suggesting it as the next stop */
  hello: string
  suggest: string
  /** words the guide understands for this stop (lowercase regex source) */
  words: string
}

export const WORLD_STOPS: WorldStop[] = [
  {
    id: 'start', label: 'START', name: 'Start', line: 'Welcome to my world', icon: 'start', place: null,
    mapAt: [5, 72], arrive: [0, 70.5], yaw: Math.PI, point: [0, 2, 72],
    hello: 'Welcome to <b>Naveen’s world</b>.', suggest: 'Back to where it all began.',
    words: '\\b(start|beginning|entrance|spawn)\\b',
  },
  {
    id: 'home', label: 'HOME', name: 'Home', line: 'Who am I?', icon: 'home', place: 'home',
    mapAt: [-15, -25], arrive: [-8.2, -25], yaw: -Math.PI / 2, room: { id: 'home', location: 'home' }, point: [-13, 3, -25],
    hello: 'This is me — my <b>tools & skills</b> are on the wall to the left.', suggest: 'Let’s start at <b>home</b> — come and meet me.',
    words: '\\b(home|take me home|about|me|profile|who|naveen|skills?|tools?)\\b',
  },
  {
    id: 'education', label: 'EDUCATION', name: 'Education', line: 'Where did I start?', icon: 'education', place: 'education',
    mapAt: [0, -60], arrive: [0, -51.5], yaw: Math.PI, room: { id: 'education', location: 'education' }, point: [0, 5, -58],
    hello: 'This is where the journey <b>began</b>.', suggest: 'Want to know where the journey <b>started</b>?',
    words: '\\b(education|college|study|studies|school|universit(y|ies)|learn(ing)?|degree|class(room)?|career|journey|timeline)\\b',
  },
  {
    id: 'nfcSolutions', label: 'NFC SOLUTIONS', name: 'NFC Solutions', line: 'Where did I become a professional?', icon: 'office', place: 'office',
    mapAt: [21, 11], arrive: [10.8, 17], yaw: Math.PI / 2, room: { id: 'office', location: 'nfc' }, point: [18, 5, 17],
    hello: 'Welcome to my <b>professional world</b>.', suggest: 'Let’s see where those skills became <b>real</b>.',
    words: '\\b(office|company|nfc|work ?place|colleagues?|team|job)\\b',
  },
  {
    id: 'projects', label: 'PROJECTS', name: 'Projects', line: 'What have I designed?', icon: 'projects', place: 'projects',
    mapAt: [23, 24], arrive: [10.8, 17], yaw: Math.PI / 2, room: { id: 'office', location: 'nfc', spot: 'studio' }, point: [18, 5, 17],
    hello: 'These are some of the <b>products</b> I’ve worked on.', suggest: 'Want to see what I’ve <b>designed</b>?',
    words: '\\b(projects?|show projects|work|case ?stud(y|ies)|portfolio|intellistaff|calmscient|ebounti|task|wastebeminerals)\\b',
  },
  {
    id: 'designJourney', label: 'DESIGN JOURNEY', name: 'Design Journey', line: 'How do I think and work?', icon: 'design', place: 'park',
    mapAt: [-26, 29], arrive: [-21.6, 25.6], yaw: Math.PI, point: [-21, 2, 20],
    hello: 'Want to see how I <b>think</b>? Each stone is a step of my process.', suggest: 'Want to see how I <b>think and work</b>?',
    words: '\\b(design|design journey|how do you design|process|park|ux|ui|research|prototyp\\w*|ai|workflow|claude|chatgpt)\\b',
  },
  {
    id: 'contactCafe', label: 'CONTACT CAFÉ', name: 'Contact Café', line: 'Let’s talk.', icon: 'cafe', place: 'cafe',
    mapAt: [-21, 58], arrive: [-14, 53.6], yaw: 0, room: { id: 'cafe', location: 'cafe' }, point: [-14, 3, 60],
    hello: 'Let’s take a <b>break and talk</b>.', suggest: 'Let’s finish with a <b>coffee</b> at the café.',
    words: '\\b(contact|contact me|let\'?s connect|connect|cafe|café|coffee|email|mail|phone|resume|cv|linkedin|hire|reach|feedback|talk|thanks?)\\b',
  },
]

export const getStop = (id: StopId) => WORLD_STOPS.find((s) => s.id === id)!
/** the stops on the story path (START is where you begin, not a destination) */
export const STORY_STOPS = WORLD_STOPS.filter((s) => s.place)

/** Local command matching for the guide: most specific stops are tested first. */
const MATCH_ORDER: StopId[] = ['projects', 'contactCafe', 'nfcSolutions', 'education', 'designJourney', 'home', 'start']
export function matchStop(text: string): StopId | null {
  const t = text.toLowerCase().trim()
  if (!t) return null
  for (const id of MATCH_ORDER) if (new RegExp(getStop(id).words).test(t)) return id
  return null
}
