/**
 * Visitor analytics — integration point.
 *
 * A browser on its own cannot know how many people visit the portfolio, so no
 * number is ever invented. Until a backend is connected the UI shows
 * "THIS SESSION · 01" (you, right now).
 *
 * To connect real data, set VITE_VISITOR_ENDPOINT (e.g. in .env.local) to a
 * URL that:
 *   POST  → records a visit (called once per session)
 *   GET   → returns JSON { current?: number, today?: number, total?: number }
 * A Supabase edge function, Firebase function or any small serverless handler
 * works. The UI then switches to the real figures automatically.
 */
export interface VisitorStats {
  source: 'backend' | 'session'
  current?: number
  today?: number
  total?: number
}

const ENDPOINT = import.meta.env.VITE_VISITOR_ENDPOINT as string | undefined

export const SESSION_STATS: VisitorStats = { source: 'session', current: 1 }

export async function loadVisitorStats(): Promise<VisitorStats> {
  if (!ENDPOINT) return SESSION_STATS
  try {
    const key = 'mindscape:visit-recorded'
    let recorded = false
    try {
      recorded = sessionStorage.getItem(key) === '1'
    } catch {
      /* storage blocked */
    }
    if (!recorded) {
      await fetch(ENDPOINT, { method: 'POST', keepalive: true })
      try {
        sessionStorage.setItem(key, '1')
      } catch {
        /* storage blocked */
      }
    }
    const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(String(res.status))
    const d = (await res.json()) as Partial<VisitorStats>
    return { source: 'backend', current: d.current, today: d.today, total: d.total }
  } catch {
    // backend unreachable: fall back to the honest session view
    return SESSION_STATS
  }
}
