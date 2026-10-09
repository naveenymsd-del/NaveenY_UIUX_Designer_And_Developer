import { COLLEAGUES } from '@/data/colleagues'
import { STORY_STOPS } from '@/data/world'
import { cancelWalk } from './autoWalk'
import { type ActionIO, runAction } from './actions'
import { projectEverything } from './brain/local'
import { conversation, setProject } from './conversation'
import { PROJECT_TOUR_PROMPT, placePresentation, projectPresentation } from './presentations'
import { nextWalkQuestion } from './smalltalk'
import { CERTIFICATION, EDUCATION, EXPERIENCE, PROJECTS_K, joinList, type DestinationId } from './knowledge'
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
  /** go straight on to the next stop after this one (the Project Studio hands over to its first project) */
  autoNext?: boolean
  /** ask a light question on the way instead of narrating */
  question?: boolean
}

const STOP_ID: Record<string, DestinationId> = { home: 'home', education: 'education', nfcSolutions: 'office', projects: 'projects', gallery: 'gallery', contactCafe: 'contact' }
const P = (id: string) => PROJECTS_K.find((p) => p.id === id)!

function projectStop(id: string, i: number): Stop {
  const p = P(id)
  return {
    id: `project:${id}`,
    action: { type: 'navigateProject', projectId: id },
    depart: i === 0 ? '' : `Next up: ${p.title}.`,
    arrive: projectPresentation(p),
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
      depart: 'Alright — we’re heading to the Project Studio.',
      arrive: `Here we are — this is the Project Studio. I’ll walk you through the projects one by one: ${joinList(PROJECTS_K.map((p) => p.title))}. We’ll start with ${PROJECTS_K[0].title}. You can interrupt me any time and ask questions.`,
      autoNext: true,
      question: true,
    },
    gallery: {
      depart: 'Let’s step outside to the Design Journey in the park.',
      midway: 'This part of the world is about how Naveen approaches design.',
      arrive: placePresentation('gallery'),
    },
    contact: {
      depart: 'Last stop — the Contact Café.',
      arrive: placePresentation('contact'),
    },
  }
  return { id: dest, action: { type: 'navigate', destination: dest }, ...S[dest] }
}

function buildStops(kind: TourKind): Stop[] {
  const projects = PROJECTS_K.map((p, i) => projectStop(p.id, i))
  // the project tour starts by walking to the studio, which introduces itself and hands over to the first project
  if (kind === 'projects') return [placeStop('projects'), ...projects]
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
  return stop.id.startsWith('project:') ? ` ${PROJECT_TOUR_PROMPT}` : ' Ready for the next stop?'
}

async function go(i: number, io: ActionIO, chained = false) {
  if (i >= tour.stops.length) return finish(io)
  const token = ++tour.token
  tour.index = i
  tour.status = 'active'
  tour.waiting = false
  const stop = tour.stops[i]
  // straight on from the studio's introduction: no "next up" line over it
  if (stop.depart && !chained) io.respond(stop.depart)
  const q = stop.question && !stop.midway ? nextWalkQuestion() : null
  const r = await runAction(stop.action, io, {
    midway: q ? q.ask : stop.midway ?? null,
    questionId: q?.id,
    arrive: null,
    manual: 'Got it — you’re driving. Say “continue the tour” whenever you like.',
  })
  if (token !== tour.token) return
  if (r === 'arrived' || r === 'already') {
    const last = i === tour.stops.length - 1
    // what we're standing at is now what "this", "it" and "explain" mean
    if (stop.action.type === 'navigateProject') {
      setProject(stop.action.projectId)
      conversation.more = projectEverything(PROJECTS_K.find((p) => p.id === (stop.action as { projectId: string }).projectId)!)
    } else if (stop.action.type === 'navigate') {
      conversation.place = stop.action.destination
      conversation.entity = { kind: 'place', id: stop.action.destination }
    }
    const say = stop.arrive + (stop.autoNext ? '' : prompt(stop, last))
    if (io.narrate) await io.narrate(say)
    else io.respond(say)
    if (token !== tour.token) return
    if (stop.autoNext && !last) return go(i + 1, io, true)
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
