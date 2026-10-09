import { create } from 'zustand'
import type { VoiceTier } from './portfolioKnowledge'
import type { ChatMessage, SessionState, VoiceState } from './types'

/**
 * UI-facing state of the guide conversation. Separate from the game store
 * (world state), conversation memory (conversation.ts) and the tour
 * (tour.ts); nothing here is read inside the render loop.
 */
export type GuideMode = 'off' | 'voice' | 'text'
export type { VoiceTier }

interface VoiceStore {
  mode: GuideMode
  /** which engine is carrying the conversation: realtime speech-to-speech, the browser's speech, or text */
  tier: VoiceTier
  /** the voice session (connection) — separate from the conversational turn below */
  session: SessionState
  /** the conversational turn shown on the orb */
  state: VoiceState
  /** short status shown next to the orb (overrides the default label) */
  status: string | null
  messages: ChatMessage[]
  /** what is being heard (or said) right now, before it is final */
  interim: string
  /** a Figma link the browser didn't let us open by itself */
  link: { label: string; url: string } | null
  /** the browser blocked the guide's audio until the visitor taps */
  audioBlocked: boolean
  consentOpen: boolean
  /** this device can do realtime voice (WebRTC + microphone + a configured session endpoint) */
  canRealtime: boolean
  canListen: boolean
  canSpeak: boolean
  /** turns completed this session (first-run guidance fades after the first) */
  turns: number
  historyOpen: boolean
  /** phones: the compact conversation sheet is expanded (collapsed = just the orb) */
  sheet: boolean
  set: (patch: Partial<VoiceStore>) => void
  add: (role: ChatMessage['role'], text: string) => number
  /** update a message in place (realtime transcripts grow as they stream) */
  patch: (id: number, text: string) => void
}

let nextId = 1
export const useVoiceStore = create<VoiceStore>((set) => ({
  mode: 'off',
  tier: 'off',
  session: 'disconnected',
  state: 'disabled',
  status: null,
  messages: [],
  interim: '',
  link: null,
  audioBlocked: false,
  consentOpen: false,
  canRealtime: false,
  canListen: false,
  canSpeak: false,
  turns: 0,
  historyOpen: false,
  sheet: false,
  set: (patch) => set(patch),
  add: (role, text) => {
    const id = nextId++
    set((s) => ({ messages: [...s.messages.slice(-39), { id, role, text }] }))
    return id
  },
  patch: (id, text) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, text } : m)) })),
}))
