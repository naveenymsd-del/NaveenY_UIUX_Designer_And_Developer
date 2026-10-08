import type { BrainReply, WorldContext } from '../types'
import { validateActions } from '../actions'
import { PROJECTS_K } from '../knowledge'

/**
 * Optional server brain (tier 2). When VITE_GUIDE_ENDPOINT is set at build
 * time, open-ended questions go to that endpoint (see server/guide.ts), which
 * holds the AI provider's API key server-side and answers from the same
 * knowledge base. The URL is public; no secret ever reaches the browser.
 * If the endpoint is unset, slow or failing, the local brain answers instead.
 */
const ENDPOINT = (import.meta.env.VITE_GUIDE_ENDPOINT as string | undefined)?.trim() || ''
export const remoteAvailable = /^https:\/\//.test(ENDPOINT) || (import.meta.env.DEV && /^http:\/\/localhost/.test(ENDPOINT))

export async function remoteReply(history: { role: 'user' | 'assistant'; text: string }[], world: WorldContext): Promise<BrainReply | null> {
  if (!remoteAvailable) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-12), world }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { text?: unknown; actions?: unknown; project?: unknown }
    if (typeof data.text !== 'string' || !data.text.trim()) return null
    return {
      text: data.text.trim().slice(0, 1200),
      actions: validateActions(data.actions),
      project: PROJECTS_K.some((p) => p.id === data.project) ? (data.project as string) : undefined,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
