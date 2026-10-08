# AI guide Worker (optional)

**You don't need this to run the portfolio.** With no Worker, no API key and
no `VITE_*` variables, the AI guide works fully: the built-in brain
(`src/ai/brain/local.ts`) answers from the portfolio data, and voice uses the
browser's own speech recognition and synthesis ("Browser voice"). Tours,
walking, context and the text chat all work.

This Worker adds optional extras behind the same interfaces:

| Route | Enabled by | Cost | What it does |
|---|---|---|---|
| `POST /` (or `/chat`) | the **Workers AI binding** (already in `wrangler.toml`) | **free**: Workers AI's 10,000 neurons/day on the Workers Free plan. When used up, requests fail, the browser answers with its built-in brain, nothing is charged. No API key. | Answers, in text only, the open questions the built-in brain has no answer for, grounded on the same portfolio knowledge. It can't move the world; navigation, tours and links stay in the browser. |
| `POST /` (or `/chat`) | `ANTHROPIC_API_KEY` secret | paid API | Same route, answered by Claude instead (with the world tools). Takes priority over Workers AI when set. |
| `POST /realtime/session` | `OPENAI_API_KEY` secret | paid API | Live speech-to-speech ("Live voice"): mints a 10-minute session key for OpenAI Realtime (`gpt-realtime-2.1`, WebRTC). Claude has no realtime audio API, so this provider sits behind the same `VoiceProvider` interface. 501 without the secret. |

**Free tier, measured:** each Workers AI answer sends the portfolio knowledge
(about 7,400 tokens) plus the question. With the default
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` that is about 220 neurons, so
roughly 45 answers a day; with `WORKERS_AI_MODEL =
"@cf/meta/llama-3.1-8b-instruct-fp8"` about 35 neurons, so roughly 280 a day.
Only questions the built-in brain can't answer use any of it. Neither model is
on Cloudflare's paid-only list
([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)).

No API key ever reaches the browser or the repository: keys are Worker secrets,
and the browser gets at most a short-lived realtime session key.

```
Browser (guide.ts)  — built-in brain first; only "I don't know" questions go out
   │  POST /chat { messages: last turns (text only), world: { location, openProject, … } }
   ▼
Cloudflare Worker  server/guide.ts
   │  Workers AI (free, text only)  — or Claude if ANTHROPIC_API_KEY is set
   ▼
{ text, actions }   → actions validated in the browser (src/ai/actions.ts) before anything moves
```

## Free setup (no payment method, no API key)

Needs a free Cloudflare account (sign up at dash.cloudflare.com; the Workers
Free plan is the default and doesn't ask for a card).

```bash
cd server
npm install
npx wrangler login          # opens the browser to sign in to your free Cloudflare account
npx wrangler deploy         # prints the Worker URL, e.g. https://naveen-portfolio-guide.<you>.workers.dev
```

Then in GitHub → **Settings → Secrets and variables → Actions → Variables**,
add `VITE_GUIDE_ENDPOINT` = that Worker URL (a public URL, so a *variable*, not
a secret) and re-run the deploy workflow. For local development, put it in
`.env.local`.

`wrangler.toml` sets `ALLOWED_ORIGIN` to the live site
(`https://naveenymsd-del.github.io`); requests from any other origin are
refused. If the Worker is slow (over 9 s), failing, rate-limited or out of free
allocation, the browser silently keeps its built-in answer.

## Optional paid extras

```bash
npx wrangler secret put ANTHROPIC_API_KEY   # Claude text brain (paid API)
npx wrangler secret put OPENAI_API_KEY      # live speech-to-speech (paid API)
npx wrangler deploy
```

For live voice, also add the GitHub variable `VITE_VOICE_SESSION_ENDPOINT` =
`<Worker URL>/realtime/session`. Leave it unset and voice stays browser voice.

## What it does and doesn't do

- **Grounded:** the system prompt contains the knowledge text built from
  `src/data/*` (`knowledgeText()` in `src/ai/knowledge.ts`). The model is told
  to answer only from it, to speak about Naveen in the third person, and to say
  so when it doesn't know.
- **Closed set of actions** (Claude and live voice; the free Workers AI brain has none — text only): `navigate_to_location`, `navigate_to_project`,
  `open_link` (UI prototype or case study), `show_case_section`, `tour`,
  `stop_navigation` and `go_back`. The realtime voice gets the same tools. Enums
  limit them to known places and project ids; `strict: true` keeps the
  arguments schema-valid. The browser re-validates every action anyway. No
  URLs, coordinates or code come from the model: a link opens only from
  the project's own `prototypeUrl` / `caseStudyUrl`.
- **Refusals (Claude):** requests use `fallbacks: "default"` (beta
  `server-side-fallback-2026-07-01`). A safety-classifier decline is retried on
  Anthropic's recommended fallback model; if the whole chain declines, the
  visitor gets a polite deflection.
- **Privacy:** nothing is stored or logged. Only the last few short text turns
  and the visitor's location in the world are sent. No audio ever reaches this
  endpoint. Realtime audio goes from the browser straight to OpenAI over
  WebRTC (the Worker only mints the session). Nothing is recorded or stored
  by the portfolio.
- **Abuse limits:** 24 KB request cap, 600 characters per turn, and a
  best-effort limit of 20 text requests and 6 voice sessions a minute per IP. For real protection, add a
  Cloudflare rate-limiting rule.

## Type-check

```bash
cd server && npm install && npx tsc --noEmit
```
