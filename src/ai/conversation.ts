import type { DestinationId } from './knowledge'
import type { BrainReply, GuideAction } from './types'

/**
 * Short-term conversation memory: what we're talking about, what the guide
 * just offered, and the last few turns. Session-only — kept in memory, never
 * stored or sent anywhere except (optionally) the guide's own server endpoint.
 */
export type Entity =
  | { kind: 'project'; id: string }
  | { kind: 'place'; id: DestinationId }
  | { kind: 'portfolio' }
  | { kind: 'naveen' }
  | { kind: 'person'; id: string }

export interface ConversationState {
  /** the project being discussed (follow-ups like "what did he do there?") */
  project: string | null
  /** the project discussed before that ("the previous one") */
  prevProject: string | null
  place: DestinationId | null
  /** whatever was explained last — what a bare "explain" or "tell me more" is about */
  entity: Entity | null
  /** the last list of projects the guide named, for "the first one" / "the last one" */
  lastList: string[] | null
  offer: GuideAction | null
  more: string | null
  history: { role: 'user' | 'assistant'; text: string }[]
  /** places visited through the guide, for "go back" */
  trail: DestinationId[]
  lastIntent: string | null
  /** the guide just asked where to go next: "projects", "the café" or "finish here" answer it */
  choosing: boolean
  /** a light question the guide asked on a walk ("simplicity or visual impact?"), and when */
  question: { id: string; at: number } | null
}

export const conversation: ConversationState = {
  project: null, prevProject: null, place: null, entity: null, lastList: null, offer: null, more: null, history: [], trail: [], lastIntent: null, choosing: false, question: null,
}

const MAX_TURNS = 12

export function rememberUser(text: string) {
  conversation.history.push({ role: 'user', text })
  conversation.history.splice(0, Math.max(0, conversation.history.length - MAX_TURNS))
}

/** remember a guide turn that the brain produced (or that the realtime voice said) */
export function rememberAssistant(text: string) {
  conversation.history.push({ role: 'assistant', text })
  conversation.history.splice(0, Math.max(0, conversation.history.length - MAX_TURNS))
}

export function setProject(id: string) {
  if (conversation.project && conversation.project !== id) conversation.prevProject = conversation.project
  conversation.project = id
  conversation.entity = { kind: 'project', id }
}

export function rememberReply(r: BrainReply) {
  rememberAssistant(r.text)
  if (r.project) setProject(r.project)
  if (r.place) {
    conversation.place = r.place
    if (!r.project) conversation.entity = { kind: 'place', id: r.place }
  }
  if (r.entity) conversation.entity = r.entity
  if (r.list) conversation.lastList = r.list
  conversation.offer = r.offer ?? null
  conversation.more = r.more ?? null
  conversation.choosing = !!r.choosing
  conversation.question = null
}

export function resetConversation() {
  Object.assign(conversation, { project: null, prevProject: null, place: null, entity: null, lastList: null, offer: null, more: null, history: [], trail: [], lastIntent: null, choosing: false, question: null })
}
