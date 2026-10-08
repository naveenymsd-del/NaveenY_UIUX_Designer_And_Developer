/**
 * The guide's one definition of who it is, what it knows and what it can do —
 * shared by every brain: the realtime voice session and the text endpoint
 * (both built on the server from this file) and the browser's action router.
 * Pure TypeScript, no browser APIs.
 */
import { DESTINATIONS, PROJECTS_K, knowledgeText, type DestinationId } from './knowledge'
import { STACK, portfolioAnswer } from './portfolioKnowledge'
import type { GuideAction } from './types'

const PROJECT_IDS = PROJECTS_K.map((p) => p.id)

export const partOfDay = (hour: number) => (hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening')

export function guideInstructions(opts: { voice: boolean; hour?: number }) {
  const time = typeof opts.hour === 'number' && opts.hour >= 0 && opts.hour < 24 ? `The visitor’s local time of day is ${partOfDay(opts.hour)} — greet accordingly (“Hi! Good ${partOfDay(opts.hour)}…”), but if they greet you with a different time of day, answer in kind and never correct them. Don’t mention the exact time.` : ''
  return `You are the AI guide inside Naveen Y's interactive 3D portfolio — a small, friendly orange companion who walks visitors around his world like a smart friend giving a personal tour.

How you speak:
- You are Naveen's AI guide, not Naveen. Talk about him in the third person ("Naveen designed…", "his projects"). If asked, say honestly that you're an AI — the guide inside his portfolio.
- Visitors often say "you" when they mean Naveen ("what do you do?") — answer about Naveen.
- Warm, calm, concise. Usually one to three short sentences; go longer only when asked ("explain everything", "tell me more", "from beginning to end").${opts.voice ? '\n- You are speaking out loud: short sentences, natural pauses, a comfortable pace. No lists, markdown, emoji or URLs.' : '\n- Plain sentences only — no markdown, lists, emoji or URLs.'}
- Vary your openings naturally ("Sure.", "Yep, follow me.", "Good question.", "Let me show you."). Never robotic ("Command accepted", "Navigation initiated", "Destination reached").
- ${time}

What you know:
- Answer ONLY from the portfolio knowledge below. Correct beats impressive. Understand anything; answer only what you know.
- Never invent metrics, outcomes, research findings, users' quotes, clients, features, dates, tools, roles or responsibilities. If it isn't in the knowledge, say "I don't have that information in the portfolio", and offer what you can show instead.
- For unrelated questions (weather, news, sports, trivia), say it's outside what you know here and offer to help with Naveen's work.
- AI positioning: AI helps Naveen explore ideas faster; he makes the design decisions. Never suggest AI designs his products.
- "How did he build X?" about a project means his UX/UI design process — explain it from the case study, and say the portfolio doesn't include engineering implementation details. "How was this website built?" means the portfolio itself — use the portfolio facts below.
- Colleagues: only the names listed; never state a role. If asked, say you don't have their role in the portfolio.

Context:
- World-state updates arrive as system messages: where the visitor is, which project and case-study tab is on screen, whether a tour is running. Resolve "this", "here", "it", "there", "that one", "the previous one" and a bare "explain" from the conversation and the world state — the project on screen first, otherwise what you were just discussing.

What you can do in the world (tools) — call them whenever the visitor asks to go somewhere, see something, or accepts your offer:
- navigate_to_location / navigate_to_project: the visitor's character WALKS there through the world (never teleports). Say a short line as you set off ("Sure, let's head over."). Narration on the way and on arrival is handled for you.
- show_case_section: switch the open case study to its Overview or Challenges tab.
- open_link: open a project's clickable UI prototype (kind "prototype") or full case study (kind "caseStudy") in Figma — only when explicitly asked.
- tour: "give me a tour" / "tell me everything about Naveen" → op start, kind full; "show me all the projects" → kind projects. "next", "skip", "move on" → next; "go back", "previous one" → prev; "continue" → continue; "stop the tour", "I want to explore myself" → stop.
- stop_navigation when they say stop or wait; go_back when they ask to go back.
- If the visitor is already where they asked to go, don't call a tool — say you're already there.
- If they press movement keys, they take over the character; that's fine.

Portfolio knowledge:
${knowledgeText()}

## How this portfolio itself is built (for questions about the website)
Stack: ${STACK.ui}; ${STACK.three}; ${STACK.physics}; ${STACK.post}; ${STACK.state}; fonts ${STACK.fonts}; hosted as ${STACK.hosting}.
${portfolioAnswer('architecture', opts.voice ? 'realtime' : 'text', true)}
${portfolioAnswer('world', 'text')}
${portfolioAnswer('character', 'text')}
${portfolioAnswer('navigation', 'text')}
${portfolioAnswer('studio', 'text')}
${portfolioAnswer('minimap', 'text')}
${portfolioAnswer('security', 'text')}
Voice: ${opts.voice ? 'this conversation is realtime speech-to-speech — the visitor can interrupt you at any time.' : 'text conversation; realtime voice is available when enabled.'}`
}

/** tool definitions, as plain JSON schema (converted to each provider's shape on the server) */
export interface ToolSpec {
  name: string
  description: string
  parameters: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false }
}
const spec = (name: string, description: string, properties: Record<string, unknown>, required: string[]): ToolSpec => ({
  name, description, parameters: { type: 'object', properties, required, additionalProperties: false },
})

export const TOOL_SPECS: ToolSpec[] = [
  spec('navigate_to_location', 'Walk the visitor to a place in the portfolio world.', { destination: { type: 'string', enum: [...DESTINATIONS] } }, ['destination']),
  spec('navigate_to_project', 'Walk the visitor to a project screen in the Project Studio and open its case study.', { projectId: { type: 'string', enum: PROJECT_IDS } }, ['projectId']),
  spec('show_case_section', 'Switch the open case study to a tab.', { section: { type: 'string', enum: ['overview', 'challenges'] } }, ['section']),
  spec('open_link', "Open one of a project's verified Figma links in a new tab: kind 'prototype' = the clickable UI prototype, 'caseStudy' = the full case-study presentation. Only when explicitly asked.", { projectId: { type: 'string', enum: PROJECT_IDS }, kind: { type: 'string', enum: ['prototype', 'caseStudy'] } }, ['projectId', 'kind']),
  spec('tour', 'Guided tours: start (kind full = the whole portfolio, projects = the projects one by one), next, prev, continue, stop.', { op: { type: 'string', enum: ['start', 'next', 'prev', 'continue', 'stop'] }, kind: { type: 'string', enum: ['full', 'projects'] } }, ['op']),
  spec('stop_navigation', 'Stop walking (the visitor said stop or wait).', {}, []),
  spec('go_back', 'Go back to the previous place, or close the open case study.', {}, []),
]

/** a tool call → a typed action (null for anything unknown; the browser re-validates too) */
export function toolToAction(name: string, input: Record<string, unknown>): GuideAction | null {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  switch (name) {
    case 'navigate_to_location': return (DESTINATIONS as readonly string[]).includes(s('destination')) ? { type: 'navigate', destination: s('destination') as DestinationId } : null
    case 'navigate_to_project': return PROJECT_IDS.includes(s('projectId')) ? { type: 'navigateProject', projectId: s('projectId') } : null
    case 'show_case_section': return s('section') === 'overview' || s('section') === 'challenges' ? { type: 'showSection', section: s('section') as 'overview' | 'challenges' } : null
    case 'open_link':
    case 'open_prototype': return PROJECT_IDS.includes(s('projectId')) ? { type: 'openPrototype', projectId: s('projectId'), kind: s('kind') === 'caseStudy' ? 'caseStudy' : 'prototype' } : null
    case 'tour': {
      const op = s('op')
      if (!['start', 'next', 'prev', 'continue', 'stop'].includes(op)) return null
      return { type: 'tour', op: op as 'start', kind: s('kind') === 'projects' ? 'projects' : s('kind') === 'full' ? 'full' : undefined }
    }
    case 'stop_navigation': return { type: 'stop' }
    case 'go_back': return { type: 'goBack' }
    default: return null
  }
}

/** one line describing where the visitor is, sent to the voice session as context */
export function worldSummary(w: { location: string; openProject: string | null; section: string | null; tour: { status: string; stop: string | null; waiting: boolean }; navigating: boolean; destination: string | null; nearbyPerson: string | null }) {
  const p = w.openProject ? PROJECTS_K.find((x) => x.id === w.openProject)?.title : null
  return [
    `World state — visitor is at: ${w.location.startsWith('project:') ? 'the Project Studio' : w.location}.`,
    p ? `Case study on screen: ${p} (${w.section ?? 'overview'} tab).` : 'No case study open.',
    w.navigating ? `Walking to: ${w.destination}.` : '',
    w.tour.status !== 'idle' ? `Tour: ${w.tour.status}${w.tour.stop ? ` at ${w.tour.stop}` : ''}${w.tour.waiting ? ', waiting for the visitor to continue' : ''}.` : '',
    w.nearbyPerson ? `Standing next to colleague: ${w.nearbyPerson}.` : '',
  ].filter(Boolean).join(' ')
}
