import { COLLEAGUES } from '@/data/colleagues'
import { STORY_STOPS } from '@/data/world'
import { cancelWalk } from './autoWalk'
import { type ActionIO, runAction } from './actions'
import { conversation, setProject } from './conversation'
import { CERTIFICATION, CONTACT, EDUCATION, EXPERIENCE, INTERESTS, PROJECTS_K, joinList, type DestinationId } from './knowledge'
import type { GuideAction, TourKind, TourStatus } from './types'

/**
 * Guided tours. The full tour follows the world's own story order
 * (data/world.ts: Home → Education → NFC Solutions → Project Studio → the
 * projects → Gallery → Contact Café); the project tour visits the studio's
 * screens in their order. Every stop is walked, never teleported; the guide
 * introduces the place briefly, then waits for "continue" — no monologues.
 * Tour state is separate from conversation and navigation state.
 */
interface Stop {
  id: string
  action: GuideAction
  /** said as we set off */
  depart: string
  /** said about halfway (long walks only) */
  midway?: string
  /** said on arrival — short */
  arrive: string
}

const STOP_ID: Record<string, DestinationId> = { home: 'home', education: 'education', nfcSolutions: 'office', projects: 'projects', gallery: 'gallery', contactCafe: 'contact' }
const P = (id: string) => PROJECTS_K.find((p) => p.id === id)!
const firstSentence = (s: string) => `${s.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, '')}.`

function projectStop(id: string, i: number): Stop {
  const p = P(id)
  return {
    id: `project:${id}`,
    action: { type: 'navigateProject', projectId: id },
    depart: i === 0 ? `Let’s start with ${p.title}.` : `Next up: ${p.title}.`,
    arrive: `This is ${p.title}. ${firstSentence(p.overview[0])} The main challenge — ${p.challenge.headline} Naveen was the ${p.role}.`,
  }
}

function placeStop(dest: DestinationId): Stop {
  const [m, b] = EDUCATION
  const names = joinList(COLLEAGUES.slice(0, 3).map((c) => c.name))
  const S: Record<DestinationId, Omit<Stop, 'id' | 'action'>> = {
    start: { depart: 'Let’s head back to the start.', arrive: 'Here we are — back at the start.' },
    home: {
      depart: 'Let’s start with the personal side.',
      arrive: 'This is Naveen’s home — where you get a feel for him beyond the project screens: his skills and tools, and how he uses AI.',
    },
    education: {
      depart: 'Next, I’ll take you to where his academic journey began.',
      midway: 'Naveen studied Computer Science before moving into UI/UX and product design.',
      arrive: `This is Education. He did a B.Sc. in Computer Science from ${b.years.replace('–', ' to ')}, then an M.Sc. from ${m.years.replace('–', ' to ')}, both in ${m.place} — and he’s a ${CERTIFICATION.title} from ${CERTIFICATION.issuer}, ${CERTIFICATION.year}.`,
    },
    office: {
      depart: 'Now let’s head to the professional side.',
      midway: 'This is where Naveen’s professional product-design work comes together.',
      arrive: `This is NFC Solutions, where Naveen has been a ${EXPERIENCE.title} since May 2022. The people working here are his colleagues — like ${names}. I don’t have their roles, so I won’t guess.`,
    },
    projects: {
      depart: 'Now I’ll show you the product work.',
      arrive: `This is the Project Studio — the main products Naveen has worked on: ${joinList(PROJECTS_K.map((p) => p.title))}.`,
    },
    gallery: {
      depart: 'Let’s step outside to the Gallery in the park.',
      midway: 'The Gallery has real screens from his case studies, set out on easels.',
      arrive: `This is the Gallery — screens from his case studies on the easels, the AI-assisted design corner in the gazebo, and his interests: ${joinList(INTERESTS.map((x) => x.toLowerCase()))}.`,
    },
    contact: {
      depart: 'Last stop — the Contact Café.',
      arrive: `This is the Contact Café. You can email Naveen at ${CONTACT.email} or call ${CONTACT.phone}.`,
    },
  }
  return { id: dest, action: { type: 'navigate', destination: dest }, ...S[dest] }
}

function buildStops(kind: TourKind): Stop[] {
  const projects = PROJECTS_K.map((p, i) => projectStop(p.id, i))
  if (kind === 'projects') return projects
  const out: Stop[] = []
  for (const st of STORY_STOPS) {
    const dest = STOP_ID[st.id]
    if (!dest) continue
    out.push(placeStop(dest))
    if (dest === 'projects') out.push(...projects)
  }
  return out
}

export const tour = {
  status: 'idle' as TourStatus,
  kind: null as TourKind | null,
  stops: [] as Stop[],
  index: -1,
  /** arrived at a stop and waiting for "continue" */
  waiting: false,
  token: 0,
}

export const tourActive = () => tour.status === 'active' || tour.status === 'paused'
export const currentStopId = () => (tour.index >= 0 ? tour.stops[tour.index]?.id ?? null : null)
const NEXT: GuideAction = { type: 'tour', op: 'next' }

/** what to ask after arriving: places → the next stop; projects → more detail or move on */
function prompt(stop: Stop, last: boolean) {
  if (last) {
    return tour.kind === 'projects'
      ? ' That’s all of the projects. Want to see one again, or head to the Contact Café?'
      : ' That’s the tour — thanks for coming along. Ask me anything else, or explore on your own.'
  }
  return stop.id.startsWith('project:') ? ' Want more on this one, or shall we move on?' : ' Ready for the next stop?'
}

async function go(i: number, io: ActionIO) {
  if (i >= tour.stops.length) return finish(io)
  const token = ++tour.token
  tour.index = i
  tour.status = 'active'
  tour.waiting = false
  const stop = tour.stops[i]
  io.respond(stop.depart)
  const r = await runAction(stop.action, io, {
    midway: stop.midway ?? null,
    arrive: null,
    manual: 'Got it — you’re driving. Say “continue the tour” whenever you like.',
  })
  if (token !== tour.token) return
  if (r === 'arrived' || r === 'already') {
    const last = i === tour.stops.length - 1
    // what we're standing at is now what "this", "it" and "explain" mean
    if (stop.action.type === 'navigateProject') setProject(stop.action.projectId)
    else if (stop.action.type === 'navigate') {
      conversation.place = stop.action.destination
      conversation.entity = { kind: 'place', id: stop.action.destination }
    }
    io.respond(stop.arrive + prompt(stop, last))
    if (last) {
      tour.status = 'completed'
      tour.waiting = false
      return
    }
    tour.waiting = true
    conversation.offer = NEXT
  } else if (r === 'manual' || r === 'stuck') {
    tour.status = 'paused'
  }
}

function finish(io: ActionIO) {
  tour.status = 'completed'
  tour.waiting = false
  io.respond(tour.kind === 'projects' ? 'That was the last project. Anything you’d like to look at again?' : 'That’s the end of the tour. Ask me anything else, or explore on your own.')
}

/** the `tour` action: start, next, prev, continue, stop */
export async function runTour(a: Extract<GuideAction, { type: 'tour' }>, io: ActionIO) {
  switch (a.op) {
    case 'start': {
      const kind = a.kind ?? 'full'
      cancelWalk()
      tour.kind = kind
      tour.stops = buildStops(kind)
      return go(0, io)
    }
    case 'next':
    case 'continue': {
      if (!tourActive()) {
        io.respond('There’s no tour running right now. Want me to give you one?')
        conversation.offer = { type: 'tour', op: 'start', kind: 'full' }
        return
      }
      cancelWalk()
      // paused mid-walk (visitor took over): pick the same stop up again; otherwise move on
      const resumeHere = a.op === 'continue' && tour.status === 'paused' && !tour.waiting
      return go(resumeHere ? tour.index : tour.index + 1, io)
    }
    case 'prev': {
      if (!tourActive()) return
      if (tour.index <= 0) {
        io.respond('This is the first stop of the tour.')
        return
      }
      cancelWalk()
      return go(tour.index - 1, io)
    }
    case 'stop': {
      tour.token++
      cancelWalk()
      tour.status = 'stopped'
      tour.waiting = false
      return
    }
  }
}

/** the visitor took the controls or asked to go elsewhere: the tour waits */
export function pauseTour() {
  if (tour.status === 'active') {
    tour.token++
    tour.status = 'paused'
  }
}

/** the visitor asked to go somewhere else: the tour ends quietly (the new walk carries on) */
export function leaveTour() {
  if (tourActive()) {
    tour.token++
    tour.status = 'stopped'
    tour.waiting = false
  }
}
