import type { DestinationId, LocationKey } from './knowledge'
import type { VoiceTier } from './portfolioKnowledge'
import type { Entity } from './conversation'

/**
 * The only things the guide can make happen. The AI never touches the 3D
 * scene, the camera or arbitrary URLs: it returns these typed actions and
 * the action router (actions.ts) validates and runs them.
 */
export type GuideAction =
  | { type: 'navigate'; destination: DestinationId }
  | { type: 'navigateProject'; projectId: string }
  | { type: 'showSection'; section: 'overview' | 'challenges' }
  /** open a project's Figma link: the clickable UI prototype, or the case-study presentation */
  | { type: 'openPrototype'; projectId: string; kind: 'prototype' | 'caseStudy' }
  | { type: 'stop' }
  | { type: 'goBack' }
  | { type: 'help' }
  /** guided tours: the whole portfolio, or the projects one by one */
  | { type: 'tour'; op: 'start' | 'next' | 'prev' | 'stop' | 'continue'; kind?: TourKind }

export type TourKind = 'full' | 'projects'
export type TourStatus = 'idle' | 'active' | 'paused' | 'stopped' | 'completed'

export interface BrainReply {
  /** plain text — shown in the bubble and transcript and spoken */
  text: string
  actions: GuideAction[]
  /** project the conversation is now about */
  project?: string | null
  /** an action the guide offered ("Want me to take you there?") — a "yes" runs it */
  offer?: GuideAction | null
  /** place the conversation is now about */
  place?: DestinationId | null
  /** a longer answer for "tell me more" */
  more?: string | null
  /** what this answer was about, when it isn't a project or place (the portfolio, Naveen, a colleague) */
  entity?: Entity | null
  /** projects named in this answer, in order ("the first one") */
  list?: string[] | null
  /** the built-in brain had no grounded answer: an optional server brain may try */
  unknown?: boolean
}

/** what the guide knows about the world right now */
export interface WorldContext {
  location: LocationKey
  /** project whose case study is open, if any */
  openProject: string | null
  navigating: boolean
  destination: string | null
  /** case-study tab on screen */
  section: 'overview' | 'challenges' | null
  /** guided tour: status, which kind, the stop it's at, and whether it's waiting for "continue" */
  tour: { status: TourStatus; kind: TourKind | null; stop: string | null; waiting: boolean }
  /** a named colleague the visitor is standing next to (office) */
  nearbyPerson: string | null
  /** how the visitor is talking to the guide */
  voice: VoiceTier
  /** the visitor's local hour (0–23), for greetings only */
  hour: number
}

/** the conversation turn, as shown on the orb */
export type VoiceState =
  | 'disabled' | 'idle' | 'connecting' | 'listening' | 'user_speaking' | 'thinking' | 'speaking' | 'navigating' | 'interrupted' | 'error'

/** the voice session itself (realtime connection, or the browser recogniser) */
export type SessionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error'

export interface ChatMessage {
  id: number
  role: 'user' | 'guide'
  text: string
}
