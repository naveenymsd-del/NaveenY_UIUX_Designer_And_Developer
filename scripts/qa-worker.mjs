// The optional Cloudflare Worker (server/guide.ts), tested offline by calling
// its fetch handler directly — no Cloudflare account, no API key, no network.
// Checks: with no keys every AI route answers 501 (the site then uses its
// built-in brain); with the Workers AI binding the text brain answers in plain
// text, grounded on the portfolio knowledge, with no actions; an exhausted free
// allocation becomes a 429 the browser falls back from; origin and size checks.
// The Workers AI binding is a stand-in here: this checks the Worker's side of
// the contract, not the model's answers.
// Usage: node scripts/qa-worker.mjs
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'guide-worker-'))
const out = join(dir, 'worker.mjs')
await build({
  entryPoints: ['server/guide.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out,
  nodePaths: ['server/node_modules'], tsconfig: 'tsconfig.app.json', logLevel: 'error',
})
const worker = (await import(pathToFileURL(out).href)).default
rmSync(dir, { recursive: true, force: true })

const problems = []
const expect = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`) }
const ORIGIN = 'https://naveenymsd-del.github.io'
const call = (path, body, env, origin = ORIGIN, ip = String(Math.random())) =>
  worker.fetch(new Request(`https://guide.example.workers.dev${path}`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }), env)
const ask = { messages: [{ role: 'user', text: 'What is his favourite design book?' }], world: { location: 'home', hour: 20 } }

// ── nothing configured: every AI route says so, nothing is called
const bare = { ALLOWED_ORIGIN: ORIGIN }
expect((await call('/chat', ask, bare)).status === 501, 'no keys, no AI binding: text brain → 501 (site uses its built-in brain)')
expect((await call('/realtime/session', { world: {} }, bare)).status === 501, 'no OPENAI_API_KEY: realtime session → 501 (site uses browser voice)')

// ── free Workers AI text brain
let seen = null
const ai = { run: async (model, input) => { seen = { model, input }; return { response: '**Naveen** doesn’t list a favourite  book in the portfolio — I don’t have that information.' } } }
const env = { ALLOWED_ORIGIN: ORIGIN, AI: ai }
const r = await call('/chat', ask, env)
const data = await r.json()
expect(r.status === 200 && typeof data.text === 'string', `Workers AI binding: 200 with text ("${String(data.text).slice(0, 60)}…")`)
expect(!/[*#`]/.test(data.text) && !/\s{2}/.test(data.text), 'markdown and double spaces stripped for speech')
expect(Array.isArray(data.actions) && data.actions.length === 0, 'text only: no world actions from the model')
expect(seen?.model === '@cf/meta/llama-3.3-70b-instruct-fp8-fast', `default model ${seen?.model}`)
const sys = seen?.input?.messages?.[0]?.content ?? ''
expect(seen?.input?.messages?.[0]?.role === 'system' && /naveenyarramallugalla@gmail\.com/.test(sys) && /TASK/.test(sys), 'grounded: system prompt carries the portfolio knowledge')
console.log(`  system prompt: ${sys.length} chars ≈ ${Math.round(sys.length / 4)} tokens`)
expect(/cannot call tools/.test(sys) && /don't have that information in the portfolio/.test(sys), 'told: text only, say when it doesn’t know')
expect(seen?.input?.messages?.at(-1)?.content === 'What is his favourite design book?', 'the visitor’s question is the last message')
await call('/chat', ask, { ...env, WORKERS_AI_MODEL: '@cf/meta/llama-3.1-8b-instruct-fp8' })
expect(seen?.model === '@cf/meta/llama-3.1-8b-instruct-fp8', 'WORKERS_AI_MODEL overrides the model')

// free allocation used up / model error → the browser keeps its own answer
const spent = { ALLOWED_ORIGIN: ORIGIN, AI: { run: async () => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons') } } }
expect((await call('/chat', ask, spent)).status === 429, 'free allocation exhausted → 429 (browser falls back, nothing charged)')
const broken = { ALLOWED_ORIGIN: ORIGIN, AI: { run: async () => ({}) } }
expect((await call('/chat', ask, broken)).status === 502, 'empty model reply → 502 (browser falls back)')

// ── guards
expect((await call('/chat', ask, env, 'https://evil.example')).status === 403, 'other origins refused')
expect((await call('/chat', 'x'.repeat(30000), env)).status === 413, 'oversized body refused')
expect((await call('/chat', { messages: [] }, env)).status === 400, 'empty conversation refused')
let limited = 0
for (let i = 0; i < 22; i++) if ((await call('/chat', ask, env, ORIGIN, 'same-ip')).status === 429) limited++
expect(limited >= 1, `rate limit: ${limited} of 22 rapid requests from one visitor refused`)
expect((await call('/anything', ask, env)).status === 404, 'unknown route → 404')

console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
process.exit(problems.length ? 1 : 0)
