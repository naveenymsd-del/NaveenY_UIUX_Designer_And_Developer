/**
 * The voice layer's contract. The guide only talks to a VoiceProvider, so
 * engines are interchangeable without touching the guide or the 3D world:
 *
 *   realtime.ts — realtime speech-to-speech over WebRTC (primary)
 *   browser.ts  — the browser's own speech recognition + synthesis (fallback)
 *
 * Text input and the on-screen transcript go through the same provider when
 * it can carry them (realtime), so voice and text share one conversation.
 */
export type VoiceErrorCode = 'denied' | 'no-mic' | 'unsupported' | 'network' | 'unavailable' | 'tts'

export interface VoiceHandlers {
  /** what the visitor said; `final` once settled. `turn` identifies the utterance (realtime item id) */
  userTranscript: (text: string, final: boolean, turn: string) => void
  /** what the guide is saying, as it streams; `turn` identifies the reply */
  assistantTranscript: (text: string, final: boolean, turn: string) => void
  userSpeechStart: () => void
  userSpeechEnd: () => void
  assistantSpeechStart: () => void
  assistantSpeechEnd: () => void
  /** the visitor spoke over the guide (barge-in): its speech has already stopped */
  interrupted: () => void
  /** the model asked for a world action; resolve with a short JSON result for the model */
  toolCall: (name: string, args: Record<string, unknown>) => Promise<string>
  /** the browser blocked audio playback until the visitor taps */
  audioBlocked: () => void
  /** the session dropped (network, server) — the guide falls back */
  disconnected: (reason: VoiceErrorCode | 'closed') => void
  error: (code: VoiceErrorCode) => void
}

export interface VoiceProvider {
  readonly name: 'realtime' | 'browser'
  /** can this engine carry typed text and do its own understanding (one brain for voice + text)? */
  readonly conversational: boolean
  readonly canListen: boolean
  readonly canSpeak: boolean
  readonly listening: boolean
  readonly speaking: boolean
  /** open the session (the first call triggers the browser's microphone permission) */
  connect(): Promise<void>
  /** close the session and release the microphone */
  disconnect(): Promise<void>
  startListening(): Promise<void>
  stopListening(): Promise<void>
  /** stop the guide speaking immediately */
  interrupt(): void
  /** a typed message into the same conversation (conversational engines only) */
  sendText(text: string): Promise<void>
  /** have the guide say a line (navigation narration, tour stops) in its own voice */
  say(text: string): Promise<void>
  /** let the engine know where the visitor is (conversational engines only) */
  updateContext(summary: string): void
  isConnected(): boolean
  on(handlers: Partial<VoiceHandlers>): void
}
