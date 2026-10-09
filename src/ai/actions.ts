import { companion } from '@/core/companion'
import { PROJECTS } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'
import { CONTACT } from '@/data/portfolioContent'
import { asset } from '@/utils/basePath'
import { cancelWalk, journey, walker } from './autoWalk'
import { conversation } from './conversation'
import { emitGuideEvent } from './events'
import { DESTINATIONS, PLACE_NAMES, type DestinationId } from './knowledge'
import type { GuideAction } from './types'
import { useVoiceStore } from './voiceStore'
import { currentLocation } from './worldState'
import { projectArrival } from './brain/local'
import { arrivalLine, nextPrompt, placePresentation } from './presentations'
import { nextWalkQuestion } from './smalltalk'
import { runTour } from './tour'

/**
 * The action router: the only way the guide changes the world. Every action
 * is validated against a closed set (known places, known project ids); URLs
 * are never taken from the AI — a prototype opens only from the project's
 * own verified `prototypeUrl`.
 */
const PROJECT_IDS = new Set(PROJECTS.map((p) => p.id))

export function validateActions(raw: unknown): GuideAction[] {
  if (!Array.isArray(raw)) return []
  const out: GuideAction[] = []
  for (const a of raw.slice(0, 3)) {
    if (!a || typeof a !== 'object') continue
    const x = a as Record<string, unknown>
    if (x.type === 'navigate' && DESTINATIONS.includes(x.destination as DestinationId)) out.push({ type: 'navigate', destination: x.destination as DestinationId, explain: x.explain === true })
    else if (x.type === 'present' && DESTINATIONS.includes(x.destination as DestinationId)) out.push({ type: 'present', destination: x.destination as DestinationId })
    else if (x.type === 'navigateProject' && PROJECT_IDS.has(x.projectId as string)) out.push({ type: 'navigateProject', projectId: x.projectId as string })
    else if (x.type === 'openPrototype' && PROJECT_IDS.has(x.projectId as string)) out.push({ type: 'openPrototype', projectId: x.projectId as string, kind: x.kind === 'caseStudy' ? 'caseStudy' : 'prototype' })
    else if (x.type === 'showSection' && (x.section === 'overview' || x.section === 'challenges')) out.push({ type: 'showSection', section: x.section })
    else if (x.type === 'stop' || x.type === 'goBack' || x.type === 'help' || x.type === 'resume' || x.type === 'linkedin') out.push({ type: x.type })
    else if (x.type === 'tour' && ['start', 'next', 'prev', 'stop', 'continue'].includes(x.op as string)) {
      out.push({ type: 'tour', op: x.op as 'start', kind: x.kind === 'projects' ? 'projects' : x.kind === 'full' ? 'full' : undefined })
    }
  }
  return out
}

export interface ActionIO {
  /** say a line (bubble + transcript + voice) — replies to the visitor, at once */
  respond: (text: string) => void
  /** narration the guide starts itself (arrivals, tour stops): waits for the current line to finish first */
  narrate?: (text: string) => Promise<void>
}
const narrate = (io: ActionIO, text: string) => (io.narrate ? io.narrate(text) : Promise.resolve(io.respond(text)))

/** a line or two of narration per destination — said once, about halfway */
const MIDWAY: Partial<Record<DestinationId, string>> = {
  home: 'Home is where you’ll find more about Naveen — his skills, tools and how he uses AI.',
  education: 'The campus is at the north end of the avenue.',
  office: 'This is the professional side of the portfolio.',
  projects: 'The Project Studio is inside the NFC Solutions office. That’s where Naveen’s case studies live.',
  gallery: 'The Gallery is in the park — real screens from his projects, and the AI corner.',
  contact: 'The café is down at the end of the avenue.',
}

/**
 * Arriving is never silent: a short welcome, then the next step — the full
 * story of the place (now, if they asked for it; otherwise one "yes" away),
 * the projects one by one, or where to go next. The Contact Café always
 * presents itself and offers the rest of the world, or finishing here.
 */
async function arriveAt(dest: DestinationId, explain: boolean, io: ActionIO) {
  conversation.place = dest
  conversation.entity = { kind: 'place', id: dest }
  if (dest === 'contact') {
    await narrate(io, `${placePresentation('contact')} Would you like me to take you somewhere else — Home, Education, NFC Solutions, the Project Studio or the Design Journey — or would you like to finish the journey here?`)
    conversation.choosing = true
    conversation.offer = null
    return
  }
  if (explain) {
    await narrate(io, `${placePresentation(dest)} ${nextPrompt(dest)}`)
    conversation.choosing = true
    conversation.offer = null
    return
  }
  if (dest === 'projects') {
    await narrate(io, `${arrivalLine('projects')} Shall I walk you through them one by one, starting with TASK? You can stop me any time.`)
    conversation.offer = { type: 'tour', op: 'start', kind: 'projects' }
    return
  }
  await narrate(io, `${arrivalLine(dest)} Want the full story here, or shall we go somewhere else?`)
  conversation.offer = { type: 'present', destination: dest }
  conversation.choosing = true
}

/** on a longer walk, now and then: one light question instead of narration */
let walks = 0
function midwayLine(dest: DestinationId): { text: string; question?: string } {
  walks++
  if (walks % 2 === 1) {
    const q = nextWalkQuestion()
    return { text: q.ask, question: q.id }
  }
  return { text: MIDWAY[dest] ?? '' }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const asDestination = (loc: string): DestinationId | null =>
  loc.startsWith('project:') ? 'projects' : (DESTINATIONS as readonly string[]).includes(loc) ? (loc as DestinationId) : null

function navStatus(label: string | null) {
  const v = useVoiceStore.getState()
  v.set({ status: label, state: label ? 'navigating' : v.mode === 'voice' ? 'listening' : v.mode === 'text' ? 'idle' : 'disabled' })
  companion.voice = label ? 'navigating' : companion.voice === 'navigating' ? 'idle' : companion.voice
}

/** how an action ended — tours use it to decide what happens next */
export type ActionResult = 'arrived' | 'already' | 'manual' | 'stuck' | 'cancelled' | 'done'

/** narration overrides for a walk (tours tell their own story); null = stay quiet */
export interface WalkLines {
  midway?: string | null
  /** the midway line is this walk question: a reply to it gets an answer */
  questionId?: string
  arrive?: string | null
  manual?: string
}

async function handleEnd(result: string, io: ActionIO, lines: WalkLines, arrived: () => void) {
  // a newer journey may have replaced this one — leave its status alone
  if (!walker.active) navStatus(null)
  if (result === 'arrived') arrived()
  else if (result === 'manual') io.respond(lines.manual ?? 'Got it — you’re driving.')
  else if (result === 'stuck') io.respond('I can’t find a clear way from here. Try stepping back onto the street, then ask me again.')
}

export async function runAction(a: GuideAction, io: ActionIO, lines: WalkLines = {}): Promise<ActionResult> {
  const g = useGameStore.getState()
  switch (a.type) {
    case 'navigate': {
      const from = asDestination(currentLocation())
      if (from === a.destination || (a.destination === 'projects' && from === 'projects' && !g.activeProjectId)) return 'already'
      if (from) conversation.trail.push(from)
      navStatus(`Taking you to ${PLACE_NAMES[a.destination].replace(/^the /, '')}…`)
      const r = await journey(a.destination, null, {
        onMidway: () => {
          if (lines.midway !== undefined) {
            if (lines.midway) io.respond(lines.midway)
            if (lines.questionId) conversation.question = { id: lines.questionId, at: Date.now() }
            return
          }
          const m = midwayLine(a.destination)
          if (!m.text) return
          io.respond(m.text)
          if (m.question) conversation.question = { id: m.question, at: Date.now() }
        },
      })
      await handleEnd(r, io, lines, () => {})
      if (r === 'arrived') {
        if (lines.arrive === undefined) await arriveAt(a.destination, !!a.explain, io)
        else if (lines.arrive) await narrate(io, lines.arrive)
      }
      return r
    }
    case 'navigateProject': {
      const p = PROJECTS.find((x) => x.id === a.projectId)
      if (!p) return 'done'
      if (g.activeProjectId === p.id) return 'already'
      const from = asDestination(currentLocation())
      if (from && from !== 'projects') conversation.trail.push(from)
      navStatus(`Taking you to ${p.title}…`)
      const far = currentLocation() !== 'projects' && !currentLocation().startsWith('project:')
      const mid = lines.midway === undefined ? MIDWAY.projects : lines.midway
      const r = await journey('projects', p.id, { onMidway: () => { if (mid) io.respond(mid) } })
      await handleEnd(r, io, lines, () => {
        useGameStore.getState().openProject(p.id)
        const say = lines.arrive === undefined ? (far ? projectArrival(p.id) : null) : lines.arrive
        if (say) io.respond(say)
      })
      return r
    }
    case 'showSection': {
      // the case study resets to Overview as it opens; switch once it's on screen
      for (let t = 0; t < 4000 && !useGameStore.getState().activeProjectId; t += 100) await wait(100)
      await wait(900)
      emitGuideEvent('showSection', a.section)
      return 'done'
    }
    case 'openPrototype': {
      const p = PROJECTS.find((x) => x.id === a.projectId)
      if (!p) return 'done'
      // the UI prototype, or the case-study presentation (also the fallback when there's no UI prototype)
      const url = a.kind === 'caseStudy' ? p.caseStudyUrl : p.prototypeUrl ?? p.caseStudyUrl
      if (!/^https:\/\/www\.figma\.com\/proto\//.test(url)) return 'done'
      const tab = window.open(url, '_blank')
      if (tab) tab.opener = null
      // browsers block tabs that weren't opened by a tap (a voice command isn't one):
      // point at the panel's own button when it's on screen, otherwise offer a one-tap link
      else if (useGameStore.getState().activeProjectId === p.id) {
        io.respond(`Your browser needs a tap for that — use “${url === p.caseStudyUrl ? 'Case study' : 'View prototype'}” at the top of the ${p.title} panel.`)
      } else useVoiceStore.getState().set({ link: { label: `Open the ${p.title} ${url === p.caseStudyUrl ? 'case study' : 'prototype'}`, url } })
      return 'done'
    }
    case 'stop':
      cancelWalk()
      navStatus(null)
      return 'done'
    case 'goBack': {
      if (g.activeProjectId) {
        g.closePanels()
        return 'done'
      }
      const here = asDestination(currentLocation())
      let back = conversation.trail.pop()
      while (back && back === here) back = conversation.trail.pop()
      if (!back) {
        io.respond('There’s nowhere to go back to yet. Where would you like to go?')
        return 'done'
      }
      navStatus(`Taking you back to ${PLACE_NAMES[back].replace(/^the /, '')}…`)
      const r = await journey(back, null)
      await handleEnd(r, io, {}, () => {})
      if (r === 'arrived') await arriveAt(back, false, io)
      return r
    }
    case 'present':
      conversation.place = a.destination
      conversation.entity = { kind: 'place', id: a.destination }
      io.respond(`${placePresentation(a.destination)} ${a.destination === 'projects' ? 'Shall I walk you through them one by one?' : nextPrompt(a.destination)}`)
      if (a.destination === 'projects') conversation.offer = { type: 'tour', op: 'start', kind: 'projects' }
      else conversation.choosing = true
      return 'done'
    case 'resume': {
      const url = CONTACT.resume ? asset(CONTACT.resume) : ''
      if (!url) return 'done'
      const tab = window.open(url, '_blank')
      if (tab) tab.opener = null
      // a voice command isn't a tap: if the browser blocks the tab, offer a one-tap link
      else useVoiceStore.getState().set({ link: { label: 'Open Naveen’s résumé (PDF)', url } })
      return 'done'
    }
    case 'linkedin': {
      if (!CONTACT.linkedin.startsWith('https://www.linkedin.com/')) return 'done'
      const tab = window.open(CONTACT.linkedin, '_blank')
      if (tab) tab.opener = null
      else useVoiceStore.getState().set({ link: { label: 'Open Naveen’s LinkedIn', url: CONTACT.linkedin } })
      return 'done'
    }
    case 'help':
      useVoiceStore.getState().set({ turns: 0 })
      return 'done'
    case 'tour':
      await runTour(a, io)
      return 'done'
  }
}

export async function runActions(actions: GuideAction[], io: ActionIO) {
  for (const a of actions) await runAction(a, io)
}
