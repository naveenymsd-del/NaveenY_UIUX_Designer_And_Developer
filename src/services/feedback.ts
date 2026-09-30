/**
 * Feedback — integration point.
 *
 * Set VITE_FEEDBACK_ENDPOINT to a URL that accepts a JSON POST
 * { rating, message, page, at } (Supabase table insert, Firebase function,
 * Formspree, a serverless handler…). No account is required from visitors.
 *
 * Without an endpoint, feedback is kept in this browser (localStorage) so
 * nothing is lost while testing, and the UI says so honestly.
 */
export type FeedbackRating = 'Loved the experience' | 'Interesting' | 'Could be better' | 'Café review'

export interface FeedbackEntry {
  rating: FeedbackRating
  message: string
  page: string
  at: string
}

const ENDPOINT = import.meta.env.VITE_FEEDBACK_ENDPOINT as string | undefined
export const feedbackConnected = !!ENDPOINT

export async function submitFeedback(rating: FeedbackRating, message: string): Promise<'sent' | 'saved-locally'> {
  const entry: FeedbackEntry = { rating, message: message.trim().slice(0, 2000), page: location.pathname, at: new Date().toISOString() }
  if (ENDPOINT) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) })
    if (!res.ok) throw new Error(`Feedback failed (${res.status})`)
    return 'sent'
  }
  try {
    const key = 'mindscape:feedback'
    const list = JSON.parse(localStorage.getItem(key) ?? '[]') as FeedbackEntry[]
    list.push(entry)
    localStorage.setItem(key, JSON.stringify(list.slice(-50)))
  } catch {
    /* storage blocked — nothing else to do without a backend */
  }
  return 'saved-locally'
}
