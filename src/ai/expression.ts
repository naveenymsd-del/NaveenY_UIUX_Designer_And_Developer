import { create } from 'zustand'
import { useEffect, useState } from 'react'
import { companion, type Emote } from '@/core/companion'
import { useVoiceStore } from './voiceStore'

/**
 * The AI companion's face — one controller for every place the robot appears
 * (the 3D character in the city, the launcher, the panel, the phone orb), so
 * chat, voice and navigation never fight over its expression.
 *
 * What the guide is doing decides the face (listening, thinking, speaking,
 * walking you somewhere). On top of that, short reactions are set from real
 * events only: the panel opening (welcome), an answer (explaining), a
 * confirmed arrival (success), a question it can't answer (confused), a
 * failure (error). Each reaction ends on its own and the face settles back.
 */
export type Expression = 'idle' | 'welcome' | 'listening' | 'thinking' | 'explaining' | 'speaking' | 'navigating' | 'success' | 'confused' | 'error'

/** reactions that an ordinary answer must not cut short */
const STRONG = new Set<Expression>(['success', 'confused', 'error', 'welcome'])

interface ReactionState {
  kind: Expression | null
  until: number
}
export const useReaction = create<ReactionState>(() => ({ kind: null, until: 0 }))

/** a short reaction to something that actually happened */
export function react(kind: Expression, ms: number, opts: { force?: boolean } = {}) {
  const now = performance.now()
  const cur = useReaction.getState()
  // an answer arriving right after a confirmed arrival / a clarification keeps that face a moment longer
  if (!opts.force && kind === 'explaining' && cur.kind && STRONG.has(cur.kind) && now < cur.until) return
  useReaction.setState({ kind, until: now + ms })
}

/** what the guide is doing right now (the conversation's turn) */
function fromTurn(): Expression | null {
  const s = useVoiceStore.getState().state
  if (s === 'listening' || s === 'user_speaking') return 'listening'
  if (s === 'thinking' || s === 'connecting') return 'thinking'
  if (s === 'speaking') return 'speaking'
  if (s === 'navigating') return 'navigating'
  if (s === 'error') return 'error'
  return null
}

/** the companion's own gestures in the city (pointing, waving) when nothing else is going on */
const FROM_EMOTE: Partial<Record<Emote, Expression>> = { greet: 'welcome', wave: 'welcome', think: 'thinking', explain: 'explaining', excited: 'success', celebrate: 'success', point: 'navigating' }

/** the face to show at `now` — reactions first, then the turn, then the companion's gesture */
export function expressionAt(now = performance.now()): Expression {
  const r = useReaction.getState()
  const turn = fromTurn()
  if (r.kind && now < r.until) {
    // speaking over an explanation: the mouth moves (the reaction's eyes stay)
    if (turn === 'listening' && r.kind !== 'success' && r.kind !== 'error') return 'listening'
    return r.kind
  }
  if (turn) return turn
  if (now < companion.emoteUntil) return FROM_EMOTE[companion.emote] ?? 'idle'
  return 'idle'
}

/** React: the current expression, re-evaluated when the turn or a reaction changes (and when a reaction ends) */
export function useExpression(): Expression {
  const turn = useVoiceStore((s) => s.state)
  const reaction = useReaction()
  const [, tick] = useState(0)
  useEffect(() => {
    const left = reaction.until - performance.now()
    if (!reaction.kind || left <= 0) return
    const t = window.setTimeout(() => tick((n) => n + 1), left + 30)
    return () => window.clearTimeout(t)
  }, [reaction.kind, reaction.until])
  void turn
  return expressionAt()
}

/** a short line describing the current expression, for the panel's status */
export const STATUS: Record<Expression, string> = {
  idle: 'Here to help',
  welcome: 'Hi there!',
  listening: 'Listening…',
  thinking: 'Thinking…',
  explaining: 'Here to help',
  speaking: 'Speaking…',
  navigating: 'On our way…',
  success: 'We’re here!',
  confused: 'Could you say that another way?',
  error: 'Something went wrong',
}
