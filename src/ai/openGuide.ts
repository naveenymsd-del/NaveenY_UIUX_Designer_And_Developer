import { enableText } from './guide'
import { useVoiceStore } from './voiceStore'

/**
 * The one AI Guide panel. Every entry point — the hero's "Ask AI Guide", the
 * launcher, the companion in the world, the menu — calls these, so there is a
 * single panel and a single conversation. Opening never turns the microphone
 * on: chat is ready at once; voice needs the visitor's explicit tap.
 */
export function openGuide() {
  const v = useVoiceStore.getState()
  if (v.mode === 'off') enableText()
  useVoiceStore.getState().set({ sheet: true })
}
export function closeGuide() {
  useVoiceStore.getState().set({ sheet: false, consentOpen: false })
}
export function toggleGuide() {
  if (useVoiceStore.getState().sheet) closeGuide()
  else openGuide()
}
