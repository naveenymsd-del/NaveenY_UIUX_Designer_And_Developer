/**
 * The portfolio guide's server: one Cloudflare Worker, two routes.
 *
 *   POST /realtime/session  → a short-lived realtime voice session (OpenAI
 *                             Realtime, WebRTC). The browser gets an ephemeral
 *                             key valid for minutes; the permanent key never
 *                             leaves this Worker. Audio then flows browser ↔
 *                             voice service directly; nothing passes through here.
 *   POST /  (or /chat)      → the text brain for the questions the browser's
 *                             built-in brain has no answer for. Claude when
 *                             ANTHROPIC_API_KEY is set; otherwise Cloudflare
 *                             Workers AI (the AI binding — free daily allocation,
 *                             no API key, no payment method), text only.
 *
 * All use the same instructions and knowledge (src/ai/guidePrompt.ts), so voice
 * and text answer alike. Nothing is stored; conversation content is never logged.
 * Every route is optional: the portfolio works fully without this Worker.
 */
import Anthropic from '@anthropic-ai/sdk'
import { PROJECTS_K, VOCABULARY } from '../src/ai/knowledge'
import { TOOL_SPECS, guideInstructions, toolToAction, worldSummary } from '../src/ai/guidePrompt'
import type { GuideAction } from '../src/ai/types'

export interface Env {
  /** the portfolio's origin, e.g. https://username.github.io — only it may call this Worker */
  ALLOWED_ORIGIN: string
  /** secret, for the text brain: `wrangler secret put ANTHROPIC_API_KEY` */
  ANTHROPIC_API_KEY?: string
  /** secret, for realtime voice: `wrangler secret put OPENAI_API_KEY` */
  OPENAI_API_KEY?: string
  /** Workers AI binding (`[ai] binding = "AI"` in wrangler.toml): the free text brain when no Anthropic key is set */
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> }
  /** optional overrides */
  WORKERS_AI_MODEL?: string
  REALTIME_MODEL?: string
  REALTIME_VOICE?: string
}

const PROJECT_IDS = PROJECTS_K.map((p) => p.id)

// best-effort per-instance rate limit (add a platform rate-limiting rule for real protection)
const hits = new Map<string, number[]>()
function limited(key: string, perMinute: number) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > perMinute
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })

/** the world context the browser sends, reduced to safe, short values */
function cleanWorld(raw: unknown) {
  const w = (raw ?? {}) as Record<string, unknown>
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')
  const tour = (w.tour ?? {}) as Record<string, unknown>
  return {
    location: str(w.location, 40) || 'unknown',
    openProject: typeof w.openProject === 'string' && PROJECT_IDS.includes(w.openProject) ? w.openProject : null,
    section: w.section === 'challenges' ? 'challenges' : w.section === 'overview' ? 'overview' : null,
    navigating: w.navigating === true,
    destination: str(w.destination, 30) || null,
    tour: { status: str(tour.status, 12) || 'idle', stop: str(tour.stop, 40) || null, waiting: tour.waiting === true },
    nearbyPerson: str(w.nearbyPerson, 30) || null,
    hour: typeof w.hour === 'number' && w.hour >= 0 && w.hour < 24 ? Math.floor(w.hour) : undefined,
  }
}

// ── realtime voice: mint a short-lived session ──────────────────────────────
async function realtimeSession(env: Env, body: { world?: unknown }, cors: Record<string, string>) {
  if (!env.OPENAI_API_KEY) return json({ error: 'voice not configured' }, 501, cors)
  const world = cleanWorld(body.world)
  const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      // the browser only needs the key long enough to connect
      expires_after: { anchor: 'created_at', seconds: 600 },
      session: {
        type: 'realtime',
        model: env.REALTIME_MODEL ?? 'gpt-realtime-2.1',
        instructions: `${guideInstructions({ voice: true, hour: world.hour })}\n\n${worldSummary(world)}`,
        tools: TOOL_SPECS.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters })),
        tool_choice: 'auto',
        audio: {
          input: {
            // laptop and phone microphones; cleaner audio means steadier turn detection
            noise_reduction: { type: 'far_field' },
            // portfolio names are easy to mishear; this biases the transcript, it doesn't rewrite speech
            transcription: { model: 'gpt-4o-mini-transcribe', language: 'en', prompt: `Portfolio tour of ${VOCABULARY.join(', ')}.` },
            // the visitor can talk over the guide; it stops and listens
            turn_detection: { type: 'semantic_vad', eagerness: 'auto', interrupt_response: true, create_response: true },
          },
          output: { voice: env.REALTIME_VOICE ?? 'marin', speed: 1.0 },
        },
      },
    }),
  })
  if (!res.ok) return json({ error: 'upstream' }, res.status === 429 ? 429 : 502, cors)
  const data = (await res.json()) as { value?: string; expires_at?: number; session?: { model?: string } }
  if (!data.value) return json({ error: 'upstream' }, 502, cors)
  // only the ephemeral key goes back — never the permanent one
  return json({ provider: 'openai-realtime', key: data.value, expiresAt: data.expires_at ?? null, model: data.session?.model ?? null }, 200, cors)
}

// ── text brain (Claude) ────────────────────────────────────────────────────
const CLAUDE_TOOLS: Anthropic.Beta.BetaTool[] = TOOL_SPECS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
  strict: true,
}))

async function textBrain(env: Env, body: { messages?: unknown; world?: unknown }, cors: Record<string, string>) {
  if (!env.ANTHROPIC_API_KEY && !env.AI) return json({ error: 'text brain not configured' }, 501, cors)
  // only short, plain text turns; the conversation must start with the visitor
  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-12)
    .filter((m): m is { role: 'user' | 'assistant'; text: string } => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .map((m) => ({ role: m.role, text: m.text.slice(0, 600) }))
  while (turns.length && turns[0].role !== 'user') turns.shift()
  if (!turns.length || turns[turns.length - 1].role !== 'user') return json({ error: 'messages' }, 400, cors)

  const world = cleanWorld(body.world)
  if (!env.ANTHROPIC_API_KEY) return workersAiBrain(env, turns, world, cors)
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t, i) =>
    i === turns.length - 1
      ? { role: 'user', content: [{ type: 'text', text: `<world_state>${worldSummary(world)}</world_state>` }, { type: 'text', text: t.text }] }
      : { role: t.role, content: t.text },
  )

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      // a safety-classifier decline is retried server-side on Anthropic's recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: guideInstructions({ voice: false, hour: world.hour }), cache_control: { type: 'ephemeral' } }],
      tools: CLAUDE_TOOLS,
      messages,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming)

    if (response.stop_reason === 'refusal') {
      return json({ text: 'I can’t help with that one. I’m happy to tell you about Naveen’s work, projects or experience.', actions: [] }, 200, cors)
    }
    const text = response.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.Beta.BetaTextBlock).text).join(' ').trim()
    const actions = response.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      .map((b) => toolToAction(b.name, (b.input ?? {}) as Record<string, unknown>))
      .filter((a): a is GuideAction => !!a)
    const project = actions.map((a) => ('projectId' in a ? a.projectId : null)).find(Boolean) ?? undefined
    return json({ text: text || (actions.length ? 'Sure — follow me.' : 'Sorry, could you say that again?'), actions, project }, 200, cors)
  } catch (err) {
    // the browser falls back to its built-in brain on any error
    const status = err instanceof Anthropic.RateLimitError ? 429 : err instanceof Anthropic.APIError ? 502 : 500
    return json({ error: 'upstream' }, status, cors)
  }
}

// ── text brain (Cloudflare Workers AI, free allocation) ──────────────────────
/**
 * Text only: it answers the open question in words and never moves the world.
 * Navigation, tours and links stay with the browser's built-in brain, which
 * handles them before anything reaches this route.
 */
const TEXT_ONLY = `
## This reply
You are answering one open question in text. You cannot call tools or move the visitor from here: if they ask to go somewhere or open something, tell them to say "take me to …" or "open the prototype". Reply in plain sentences (no markdown, no lists), at most three short sentences unless they ask for more. If the knowledge doesn't contain the answer, say you don't have that information in the portfolio.`

async function workersAiBrain(env: Env, turns: { role: 'user' | 'assistant'; text: string }[], world: ReturnType<typeof cleanWorld>, cors: Record<string, string>) {
  const model = env.WORKERS_AI_MODEL ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
  const messages = [
    { role: 'system', content: `${guideInstructions({ voice: false, hour: world.hour })}
${TEXT_ONLY}

Where the visitor is now: ${worldSummary(world)}` },
    ...turns.slice(-6).map((t) => ({ role: t.role, content: t.text })),
  ]
  try {
    const out = (await env.AI!.run(model, { messages, max_tokens: 320, temperature: 0.3 })) as { response?: unknown }
    const text = typeof out?.response === 'string' ? out.response.replace(/[*#`_]+/g, '').replace(/\s+/g, ' ').trim() : ''
    if (!text) return json({ error: 'upstream' }, 502, cors)
    return json({ text, actions: [] }, 200, cors)
  } catch (err) {
    // the free daily allocation ran out, or the model is busy: the browser keeps its own answer
    const msg = String((err as Error)?.message ?? err)
    return json({ error: 'upstream' }, /4006|quota|limit|neuron/i.test(msg) ? 429 : 502, cors)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin') ?? ''
    const cors: Record<string, string> = {
      'access-control-allow-origin': env.ALLOWED_ORIGIN,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      vary: 'origin',
    }
    // only the portfolio itself may use this Worker
    if (!env.ALLOWED_ORIGIN) return json({ error: 'not configured' }, 500, {})
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json({ error: 'method' }, 405, cors)
    if (origin !== env.ALLOWED_ORIGIN) return json({ error: 'origin' }, 403, cors)

    const ip = request.headers.get('cf-connecting-ip') ?? 'anon'
    const path = new URL(request.url).pathname.replace(/\/+$/, '')
    const voice = path === '/realtime/session'
    // voice sessions are long-lived, so far fewer of them are needed
    if (limited(`${voice ? 'v' : 't'}:${ip}`, voice ? 6 : 20)) return json({ error: 'rate' }, 429, cors)

    let body: { messages?: unknown; world?: unknown }
    try {
      const raw = await request.text()
      if (raw.length > 24_000) return json({ error: 'size' }, 413, cors)
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return json({ error: 'json' }, 400, cors)
    }

    if (voice) return realtimeSession(env, body, cors)
    if (path === '' || path === '/chat') return textBrain(env, body, cors)
    return json({ error: 'not found' }, 404, cors)
  },
}
