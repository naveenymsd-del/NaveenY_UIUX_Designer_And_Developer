import {
  AI_TOOLS, AI_WORKFLOW, CERTIFICATION, CONTACT, DESTINATIONS, EDUCATION, EXPERIENCE, GLOSSARY, INTERESTS, PLACE_ABOUT, PLACE_NAMES,
  PROFILE, PROJECTS_K, PROJECT_ALIASES, SKILL_GROUPS, TOOLS, joinList, projectsMatching, type DestinationId, type ProjectK,
} from '../knowledge'
import { COLLEAGUES } from '@/data/colleagues'
import type { BrainReply, GuideAction, WorldContext } from '../types'
import type { ConversationState, Entity } from '../conversation'
import { portfolioAnswer, portfolioTopic } from '../portfolioKnowledge'
import { partOfDay } from '../guidePrompt'

/**
 * The guide's built-in brain: understands natural phrasing by intent (not
 * exact commands), remembers the project and place being discussed, and
 * answers only from the portfolio's own data. Runs instantly in the browser
 * with no API; the optional server brain (remote.ts) can take over for
 * open-ended conversation, with this as its fallback.
 *
 * Voice: the guide talks about Naveen in the third person — it is his AI
 * guide, not Naveen.
 */

// ── text helpers ─────────────────────────────────────────────────────────
export function normalize(input: string) {
  return ` ${input
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\bwhat's\b/g, 'what is').replace(/\bwhere's\b/g, 'where is').replace(/\bwho's\b/g, 'who is').replace(/\bthat's\b/g, 'that is')
    .replace(/\blet's\b/g, 'let us').replace(/\bi'd\b/g, 'i would').replace(/\bcan't\b/g, 'cannot').replace(/\bdon't\b/g, 'do not')
    .replace(/\bnaveen's\b/g, 'naveen').replace(/café/g, 'cafe')
    .replace(/[^a-z0-9/+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `
}
const has = (t: string, re: RegExp) => re.test(t)
const words = (t: string) => t.trim().split(' ').filter(Boolean)
const squash = (s: string) => s.replace(/[^a-z0-9]/g, '')

function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** "I designed…" in the case-study copy becomes "Naveen designed…" when the guide says it */
export function thirdPerson(s: string, name = 'Naveen') {
  let first = true
  return s
    .replace(/\bI\b/g, () => (first ? ((first = false), name) : 'he'))
    .replace(/\bmy\b/g, 'his').replace(/\bMy\b/g, 'His').replace(/\bme\b/g, 'him')
}

const PROJ = (id: string) => PROJECTS_K.find((p) => p.id === id)!
/** a world location as a conversation entity (a project screen, or a place) */
const placeEntity = (loc: string): Entity | null =>
  loc.startsWith('project:') ? { kind: 'project', id: loc.slice(8) } : (DESTINATIONS as readonly string[]).includes(loc) ? { kind: 'place', id: loc as DestinationId } : null

/** which project is named — exact aliases first, then forgiving matches for misheard names */
export function findProject(t: string): ProjectK | null {
  const flat = squash(t)
  for (const p of PROJECTS_K) {
    for (const a of PROJECT_ALIASES[p.id] ?? [p.title.toLowerCase()]) {
      if (t.includes(` ${a} `) || (a.replace(/ /g, '').length >= 6 && flat.includes(squash(a)))) return p
    }
  }
  // misheard long names ("intellistuff", "calmsient", "kidpol"): one or two letters off
  const toks = words(t)
  const grams = [...toks, ...toks.slice(0, -1).map((w, i) => w + toks[i + 1])]
  for (const p of PROJECTS_K) {
    const name = p.title.toLowerCase()
    if (name.length < 6) continue
    if (grams.some((g) => g.length >= 5 && lev(g, name) <= (name.length >= 9 ? 2 : 1))) return p
  }
  return null
}

const PLACE_WORDS: [DestinationId, RegExp][] = [
  ['projects', /\b(projects?|project studio|studio|case stud(y|ies)|your work|his work|naveen work|portfolio|products?)\b/],
  ['contact', /\b(contact|cafe|coffee|get in touch)\b/],
  ['office', /\b(office|nfc|nfc solutions|work ?place|company|professional world)\b/],
  ['education', /\b(education|college|school|universit(y|ies)|campus|degrees?|academic|studies)\b/],
  ['gallery', /\b(gallery|art|sketch\w*|park|gazebo|ai area|interests|hobbies|easels?)\b/],
  ['home', /\b(home|house|skills?|tools?|skill wall)\b/],
  ['start', /\b(start|beginning|entrance|spawn|welcome)\b/],
]
export function findPlace(t: string): DestinationId | null {
  for (const [id, re] of PLACE_WORDS) if (re.test(t)) return id
  return null
}

const NAV_VERB = /\b(take|bring|walk|lead|go|head|move|navigate|show|open|visit|jump|let us (go|see|head|check|look)|i want to (see|go|visit)|i would like to (see|go|visit)|can i see|can we (go|see)|check out|look at|point me)\b/
const PRONOUN = /\b(it|that|this|there|this one|that one|that project|the project|this project)\b/
const PROJECT_FACET = /\b(challenge|challenges|problem|difficult|difficulty|hard|hardest|tricky|approach|process|flows?|journeys?|platform|mobile|web|ios|android|desktop|users?|audience|personas?|design system|colou?rs?|palette|typography|fonts?|components?|decisions?|information architecture|ia|sitemap|structure|screens?|role|responsib\w*|part|domain|industry|scope|tools? used|built with)\b/

// ── reply builders ───────────────────────────────────────────────────────
const reply = (text: string, extra: Partial<BrainReply> = {}): BrainReply => ({ text, actions: [], ...extra })
const go = (destination: DestinationId): GuideAction => ({ type: 'navigate', destination })
const goProject = (projectId: string): GuideAction => ({ type: 'navigateProject', projectId })

const firstSentence = (s: string) => `${s.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, '')}.`
function projectShort(p: ProjectK) {
  return `${firstSentence(thirdPerson(p.overview[0]))} The platform: ${p.platform.replace(' · ', ', ')}. Naveen was the ${p.role}.`
}
/** said when the guide has walked the visitor to a project screen */
export function projectArrival(id: string) {
  const p = PROJ(id)
  return `Here it is. ${projectShort(p)}`
}
function projectMore(p: ProjectK) {
  return `${p.overview.map((x) => thirdPerson(x)).join(' ')} His approach: ${p.approach.slice(0, 3).map((s) => s.replace(/\.$/, '')).join('; ').toLowerCase()}.`
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const dot = (s: string) => s.replace(/[.!?]$/, '')

/** "explain X" — a medium answer: what it is, who it's for, Naveen's part */
function projectExplain(p: ProjectK) {
  const mine = p.overview.find((x) => /\bI (designed|worked|built|led|created)\b/.test(x))
  const part = mine ? thirdPerson(mine, 'He') : `His work covered ${p.approach.slice(0, 2).map((x) => lowerFirst(dot(x))).join(', and ')}.`
  return `${firstSentence(thirdPerson(p.overview[0]))} It’s designed for ${joinList(p.users.map((u) => u.name.toLowerCase()))}, on ${lowerFirst(p.platform.replace(' · ', ', '))}. Naveen was the ${p.role}. ${part}`
}
/** "explain everything about X" — the whole case study, conversationally */
function projectEverything(p: ProjectK) {
  const links = p.prototypeUrl ? 'Both the clickable prototype and the full case study are in Figma if you want to see them.' : 'The full case study is in Figma if you want to see it.'
  return [
    `${p.overview.map((x) => thirdPerson(x)).join(' ')}`,
    `The challenge: ${p.challenge.headline} The key problems were ${joinList(p.challenge.items.map((c) => lowerFirst(c.title)))}.`,
    `How he approached it: ${p.approach.join(' ')}`,
    `The key flows: ${p.flows.map((f) => `${f.title} — ${f.steps.join(', ')}`).join('; ')}.`,
    `Design decisions: ${p.decisions.map((d) => `${d.title.replace(/[“”]/g, '')} — ${lowerFirst(dot(d.text))}`).join('; ')}.`,
    `Visually, ${lowerFirst(p.design.text)}`,
    links,
  ].join(' ')
}
/** "how did he build / design X?" — the design process (the portfolio documents design, not engineering) */
function projectProcess(p: ProjectK) {
  return `Here’s how Naveen approached the design of ${p.title}. ${p.approach.join(' ')} The key flows were ${joinList(p.flows.map((f) => f.title.toLowerCase()))}. Visually, ${lowerFirst(p.design.text)} I can explain the UX and UI design, but the portfolio doesn’t include the engineering implementation details for ${p.title}.`
}
/** a place, explained a little more than "what is this?" */
function placeExplain(id: DestinationId) {
  const [m, b] = EDUCATION
  const extra: Partial<Record<DestinationId, string>> = {
    home: `His skills span UX research and information architecture, UI and interaction design, design systems, prototyping and developer handoff, and his tools include ${joinList(TOOLS.slice(0, 5))} and more.`,
    education: `He did a B.Sc. in Computer Science (${b.years}) and an M.Sc. (${m.years}), both in ${m.place}, and he’s a ${CERTIFICATION.title} from ${CERTIFICATION.issuer}.`,
    office: `${EXPERIENCE.summary}`,
    projects: `Each screen is one project, with its case study and Figma links. If you want complex enterprise workflows, start with TASK; for multi-role mobile UX, KidPool.`,
    gallery: `Outside product design, he enjoys ${joinList(INTERESTS.map((x) => x.toLowerCase()))}.`,
    contact: `You can email him at ${CONTACT.email} or call ${CONTACT.phone}.`,
  }
  return `${PLACE_ABOUT[id]}${extra[id] ? ` ${extra[id]}` : ''}`
}

const ORDINALS: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4 }
/** "the first one", "the last one", "the previous one", "the mobile one" → a project (or a question back) */
function resolveReference(t: string, ctx: ConversationState, world: WorldContext): ProjectK | BrainReply | null {
  const list = (ctx.lastList ?? PROJECTS_K.map((p) => p.id)).map(PROJ)
  const ord = t.match(/\b(first|second|third|fourth|fifth|last) (one|project)\b/)
  if (ord) return ord[1] === 'last' ? list[list.length - 1] : list[ORDINALS[ord[1]]] ?? null
  if (has(t, /\b(previous|earlier|other) (one|project)\b|\bthe one before\b/)) return ctx.prevProject ? PROJ(ctx.prevProject) : null
  if (has(t, /\bnext (one|project)\b/) && world.tour.status === 'idle') {
    const cur = world.openProject ?? ctx.project
    const i = cur ? PROJECTS_K.findIndex((p) => p.id === cur) : -1
    return PROJECTS_K[(i + 1) % PROJECTS_K.length]
  }
  const attr = t.match(/\bthe (mobile|web|website|healthcare|health|wellness|recruitment|staffing|hr|school|carpool\w*|ticketing|trademark|legal|enterprise|saas) (one|project|app)\b/)
  if (!attr) return null
  const re: Record<string, RegExp> = {
    mobile: /mobile|ios|android/i, web: /web|website|dashboard/i, website: /website/i, healthcare: /health/i, health: /health/i, wellness: /wellness|health/i,
    recruitment: /recruit|staffing|hr/i, staffing: /staffing/i, hr: /hr tech/i, school: /school/i, carpool: /carpool/i, carpooling: /carpool/i,
    ticketing: /ticket/i, trademark: /trademark|legal/i, legal: /legal/i, enterprise: /saas|enterprise/i, saas: /saas/i,
  }
  const key = attr[1].startsWith('carpool') ? 'carpool' : attr[1]
  const matches = PROJECTS_K.filter((p) => re[key]?.test(`${p.category} ${p.platform} ${p.fullTitle}`))
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    return reply(`A few projects fit that — ${joinList(matches.map((p) => p.title))}. Which one do you mean?`, { list: matches.map((p) => p.id) })
  }
  return null
}

let greetTurn = 0
function greeting(t: string, hour: number) {
  // if they said "good morning", answer in kind — never correct them
  const said = t.match(/\bgood (morning|afternoon|evening)\b/)?.[1]
  const part = said ?? partOfDay(hour)
  const lines = [
    `Hi! Good ${part}. Welcome to Naveen’s world.`,
    `Hey! Good ${part} — nice to have you here. Want to explore, or ask me something?`,
    `Hi! Good ${part}. Welcome in — I can show you around, or answer anything about Naveen’s work.`,
  ]
  return lines[greetTurn++ % lines.length]
}
const METRICS = /\b(revenue|roi|metrics?|kpis?|results?|impact|outcomes?|conversion|numbers|growth|sales|success rate|how many (users|downloads|customers))\b/

function projectFacet(p: ProjectK, t: string): BrainReply | null {
  const q = (re: RegExp) => has(t, re)
  if (q(METRICS)) {
    return reply(`The portfolio doesn’t include metrics or business results for ${p.title} — the case study covers the design itself, and I don’t want to guess. I can walk you through the design work instead.`, { project: p.id })
  }
  if (q(/\b(what did (you|he|naveen) do|(your|his|naveen) role|role|responsib\w*|(your|his) part|what was (your|his) (job|part)|what did (you|he) work on|what did (you|he) design)\b/)) {
    // his own part, in the case study's words — or, where it doesn't say, the approach
    const mine = p.overview.find((x) => /\bI (designed|worked|built|led|created)\b/.test(x))
    const what = mine ? thirdPerson(mine, 'He') : `His work covered ${p.approach.slice(0, 2).map((x) => lowerFirst(x.replace(/\.$/, ''))).join(', and ')}.`
    return reply(`Naveen was the ${p.role} on ${p.title}. ${what}`, { project: p.id, more: projectMore(p) })
  }
  if (q(/\b(platform|mobile|web|ios|android|desktop|app or|website)\b/)) {
    const mobile = /mobile|ios|android/i.test(p.platform)
    const web = /web|website|dashboard|desktop/i.test(p.platform)
    const askMobile = q(/\b(mobile|ios|android|app)\b/) && !q(/\bweb\b/)
    const askWeb = q(/\b(web|website|desktop)\b/) && !q(/\bmobile\b/)
    const lead = askMobile ? (mobile ? 'Yes — ' : 'No — ') : askWeb ? (web ? 'Yes — ' : 'No — ') : ''
    const kind = mobile && web ? 'a mobile and web product' : mobile ? 'a mobile product' : 'a web product'
    return reply(`${lead}${p.title} is ${kind}: ${lowerFirst(p.platform.replace(' · ', ', '))}, in ${p.category.replace(' · ', ', ')}.`, { project: p.id })
  }
  if (q(/\b(challenges?|problem|difficult|hard part|hardest|issue)\b/)) {
    return reply(`The main challenge — ${p.challenge.headline} The key problems: ${joinList(p.challenge.items.map((c) => lowerFirst(c.title)))}.`, {
      project: p.id,
      more: `${p.challenge.items.map((c) => `${c.title}: ${c.text}`).join(' ')} The guiding question was: ${p.challenge.question}`,
    })
  }
  if (q(/\b(approach|process|how did (you|he)|method)\b/)) {
    return reply(`${p.approach.slice(0, 3).map((s) => s.replace(/\.$/, '')).join('. ')}.`, { project: p.id, more: `${p.approach.join(' ')}` })
  }
  if (q(/\b(flows?|journeys?|steps)\b/)) {
    const f = p.flows[0]
    return reply(`The key flows are ${joinList(p.flows.map((x) => x.title))}. For example, ${f.title}: ${f.steps.join(', then ')}.`, {
      project: p.id, more: p.flows.map((x) => `${x.title}: ${x.steps.join(' → ')}.`).join(' '),
    })
  }
  if (q(/\b(users?|audience|personas?|who uses|roles|for whom|target)\b|\bwho (is|was|are|were)\b.*\bfor\b/)) {
    return reply(`It’s designed for ${joinList(p.users.map((u) => u.name.toLowerCase()))}.`, {
      project: p.id, more: p.users.map((u) => `${u.name} — ${u.who}; they need to ${u.needs.map((n) => n.charAt(0).toLowerCase() + n.slice(1)).join(', ')}.`).join(' '),
    })
  }
  if (q(/\b(design system|colou?rs?|palette|typography|fonts?|type|components?|visual|look|style)\b/)) {
    const type = p.design.type.split('—')[0].trim()
    return reply(`${p.design.text} Its main colours are ${joinList(p.design.colors.slice(0, 3).map((c) => c.name))}, and the type is ${/^(A|An|The)\b/.test(type) ? lowerFirst(type) : type}.`, {
      project: p.id, more: `Colours: ${p.design.colors.map((c) => `${c.name} ${c.hex}`).join(', ')}. Components include ${joinList(p.design.components)}.`,
    })
  }
  if (q(/\b(decisions?|why did|learn\w*|takeaways?)\b/)) {
    return reply(`Key decisions: ${p.decisions.slice(0, 3).map((d) => d.title.replace(/[“”]/g, '')).join('; ')}.`, {
      project: p.id, more: p.decisions.map((d) => `${d.title}: ${d.text}`).join(' '),
    })
  }
  if (q(/\b(information architecture|ia|sitemap|structure|navigation)\b/)) {
    return reply(`It’s organised into ${joinList(p.ia.map((i) => i.title))}.`, { project: p.id, more: p.ia.map((i) => `${i.title}: ${i.text}.`).join(' ') })
  }
  if (q(/\b(screens?|ui)\b/)) {
    return reply(`The case study shows ${joinList(p.screens.map((s) => s.caption.toLowerCase()))}. I can open it for you here, or the Figma links.`, { project: p.id, offer: goProject(p.id) })
  }
  if (q(/\b(domain|industry|category|kind of (product|project))\b/)) return reply(`${p.title} is in ${p.category}.`, { project: p.id })
  if (q(/\b(scope|deliverables)\b/)) return reply(`The scope: ${p.scope}.`, { project: p.id })
  if (q(/\b(tools?|figma|built with)\b/)) return reply(`The design and prototype were made in Figma — that’s where the interactive prototype lives.`, { project: p.id })
  return null
}

function aboutNaveen(): BrainReply {
  return reply(
    `Naveen is a UI/UX and Product Designer with ${PROFILE.experience} of experience, designing web and mobile products across enterprise SaaS, healthcare, recruitment and service platforms. Want to see some of his work?`,
    { offer: go('projects'), entity: { kind: 'naveen' }, more: `${PROFILE.summary} ${thirdPerson(PROFILE.craft).replace('Naveen work', 'Naveen works')} He works at ${EXPERIENCE.company} in ${EXPERIENCE.location}.` },
  )
}

function capability(t: string): BrainReply | null {
  if (!has(t, /\b(can|could|do|does|did|have|has|is|are) (you|he|naveen)\b|\b(experience (with|in)|worked (on|with))\b/)) return null
  const names = (ps: ProjectK[]) => joinList(ps.map((p) => `${p.title} (${p.platform.replace(' · ', ', ')})`))
  if (has(t, /\b(mobile|ios|android|apps?)\b/)) {
    const ps = projectsMatching(/mobile|ios|android/i)
    return reply(`Yes — mobile work in the portfolio includes ${names(ps)}.`, { offer: go('projects') })
  }
  if (has(t, /\b(health|healthcare|medical|wellness)\b/)) return reply(`Yes — Calmscient is a mental health and wellness product: a mobile app plus a web admin panel.`, { project: 'calmscient', offer: goProject('calmscient') })
  if (has(t, /\b(enterprise|b2b|saas)\b/)) return reply(`Yes — enterprise SaaS is one of his focus areas at ${PROFILE.company}. TASK, a B2B ticketing and project-management platform, is a good example.`, { project: 'task', offer: goProject('task') })
  if (has(t, /\b(recruit\w*|hr|staffing|hiring)\b/)) return reply(`Yes — IntelliStaff is a staffing mobile app in recruitment and HR tech.`, { project: 'intellistaff', offer: goProject('intellistaff') })
  if (has(t, /\b(web|websites?|responsive|dashboards?)\b/)) {
    const ps = projectsMatching(/web|website|dashboard/i)
    return reply(`Yes — web work includes ${names(ps)}.`, { offer: go('projects') })
  }
  if (has(t, /\b(design systems?|component librar\w*|style guides?|components)\b/)) {
    const g = SKILL_GROUPS.find((x) => x.short === 'Systems')!
    return reply(`Yes — ${joinList(g.items.slice(0, 3).map((s) => s.toLowerCase()))} are part of his work. Every case study here documents its own design system, colours and components.`)
  }
  if (has(t, /\b(developers?|engineers?|handoff|code|html|css|front ?end)\b/)) {
    return reply(`Yes — developer handoff and cross-functional collaboration are part of his practice, and he has front-end awareness in HTML and CSS. On Calmscient he supported developers implementing the UI in HTML/CSS.`)
  }
  if (has(t, /\b(prototyp\w*)\b/)) return reply(`Yes — interactive prototyping is one of his skills. Most projects in the studio have a clickable Figma prototype you can open, and every one has its full case study in Figma.`)
  if (has(t, /\b(research|usability|user testing|interviews?|personas?)\b/)) {
    return reply(`Yes — his UX skills include ${joinList(SKILL_GROUPS[0].items.slice(0, 6).map((s) => s.toLowerCase()))}.`)
  }
  if (has(t, /\b(accessib\w*|wcag|a11y)\b/)) return reply(`Yes — accessibility (WCAG 2.1) is listed among his systems and delivery skills.`)
  if (has(t, /\b(figma|adobe|xd|photoshop|canva|relume|stitch|ux pilot|chatgpt|claude)\b/)) {
    const tool = TOOLS.find((x) => t.includes(` ${x.toLowerCase()} `) || t.includes(` ${x.toLowerCase().split(' ')[0]} `))
    return tool ? reply(`Yes — ${tool} is one of the tools he works with.`) : null
  }
  return null
}

const HELP = 'You can ask me about Naveen, his experience or a project — like “What is TASK?” — or tell me where to go: “Take me to the projects.” Say “stop” any time.'

// ── the brain ────────────────────────────────────────────────────────────
export function localReply(input: string, world: WorldContext, ctx: ConversationState): BrainReply {
  let t = normalize(input)
  // "wait, what does B2B mean?" / "actually, take me home": answer what follows the interjection
  const lead = t.match(/^ (actually|wait|hold on|hang on|no wait|sorry|okay so|ok so|so|um|uh|hmm|well|oh) (?=\S+ \S+)/)
  if (lead) t = ` ${t.slice(lead[0].length)}`
  const n = words(t).length
  if (!n) return reply('Sorry, I didn’t catch that.')

  const touring = world.tour.status === 'active' || world.tour.status === 'paused'
  const tourCmd = (op: 'start' | 'next' | 'prev' | 'stop' | 'continue', kind?: 'full' | 'projects'): GuideAction => ({ type: 'tour', op, kind })

  // tours: start, stop — explicit phrases win over everything else
  if (has(t, /\b(stop|end|exit|quit|cancel) (the )?tour\b|\bno more tour\b|\bi (want|would like|wanna) to explore (on my own|myself|by myself)\b|\blet me explore\b|\bexplore (it )?(myself|on my own)\b/)) {
    return reply('Sure. I’ll stay with you here — ask me anything, or take the controls yourself.', { actions: [tourCmd('stop')] })
  }
  if (has(t, /\b(show|walk|take) me (through )?(all|every one of|each of) (the |his |naveen )?projects\b|\b(walk|take) me through (the |his |all |all the )?projects\b|\b(tour|go through) (of )?(the |all |all the )?projects( one by one)?\b|\bprojects one by one\b/)) {
    return reply('Sure — I’ll take you through the projects one at a time. Stop me whenever you like.', { actions: [tourCmd('start', 'projects')] })
  }
  if (has(t, /\b(tell me everything about (naveen|him|you)|give me (a|the|a full|the full|a guided) tour|(show|take) me around|walk me through (the |this |his |naveen )?(portfolio|world|everything|place)|take me through everything|(full|guided|whole) tour|show me (his|naveen|your) journey|tour of the portfolio)\b/)) {
    return reply('Sure. Let me give you the tour — we’ll walk it, and you can stop me or ask questions any time.', { actions: [tourCmd('start', 'full')] })
  }
  if (touring) {
    if (has(t, /^ (next|skip|skip (this|it|this one)|move on|next (one|stop|project)|show me the next( one| project| stop)?|go to the next( one| project| stop)?|on to the next( one)?|let us move on) /)) return reply('', { actions: [tourCmd('next')] })
    if (has(t, /^ (continue|continue the tour|keep going|carry on|resume|resume the tour|let us continue|go on) /)) return reply('', { actions: [tourCmd('continue')] })
    if (has(t, /\b(go back|previous (one|project|stop)|the one before|back to the (last|previous) (one|stop|project))\b/) || t === ' back ') return reply('', { actions: [tourCmd('prev')] })
  } else if (world.tour.status === 'stopped' && has(t, /^ (continue|continue the tour|resume|resume the tour|keep going) /)) {
    return reply('', { actions: [tourCmd('continue')] })
  }

  // control words — always instant
  if (has(t, /^ (stop|stop it|stop walking|stop moving|stop talking|halt|cancel|never ?mind|forget it|be quiet|quiet|shh+|enough) /) || (n <= 3 && has(t, /\b(stop|cancel)\b/))) {
    return reply(touring ? 'Okay, I’ve stopped. Say “continue the tour” when you’re ready.' : 'Okay, I’ve stopped.', { actions: [{ type: 'stop' }], offer: null })
  }
  if (has(t, /^ (pause|pause (it|the tour|here)|let us pause|take a break) /)) {
    return reply(touring ? 'Paused. Ask me anything, or say “continue” when you’re ready.' : 'Okay, I’ve paused.', { actions: [{ type: 'stop' }], offer: null })
  }
  if (has(t, /^ (wait|hold on|hang on|one sec|one second|wait a (sec|second|minute)|just a sec) /)) return reply('Yep?', { actions: [{ type: 'stop' }] })
  if (has(t, /^ (take me somewhere else|somewhere else|change that|change of plan|not there) /)) {
    return reply('Sure — where would you like to go instead?', { actions: [{ type: 'stop' }, ...(touring ? [tourCmd('stop')] : [])] })
  }
  // "actually, take me home" — drop the "actually" and carry on; on its own it's a change of mind
  if (has(t, /^ (actually|no wait|no no) /)) return reply('Sure — what would you like instead?', { actions: [{ type: 'stop' }] })
  if (has(t, /\b(go back|take me back|back to where|previous (place|spot))\b/) || t === ' back ') return reply('Sure, heading back.', { actions: [{ type: 'goBack' }] })

  // answering an offer ("Want me to take you there?" → "yes")
  if (ctx.offer && n <= 6 && has(t, /^ (yes|yeah|yep|yup|ya|sure|ok|okay|please|go ahead|let us go|let us do it|do it|sounds good|absolutely|of course|why not|alright|all right|definitely|great) /)) {
    const a = ctx.offer
    return reply(a.type === 'navigate' || a.type === 'navigateProject' ? 'Great — follow me.' : a.type === 'tour' ? '' : 'Sure.', { actions: [a], offer: null })
  }
  if (ctx.offer && n <= 4 && has(t, /^ (no|nope|not now|maybe later|no thanks|nah) /)) return reply('No problem. What else would you like to know?', { offer: null })

  if (n <= 4 && has(t, /^ (thanks|thank you|thx|cheers|cool|nice|great|awesome|perfect|got it) /)) return reply('You’re welcome. Anything else you’d like to see?')
  if (n <= 5 && has(t, /^ (hi|hey|hello|hiya|yo|good (morning|afternoon|evening)|howdy|hey there|hi there|hello there)\b/)) return reply(greeting(t, world.hour))
  if (n <= 5 && has(t, /^ (what is up|whats up|sup|how are you|how is it going)\b/)) return reply('All good — just showing people around Naveen’s world. Where would you like to start?')
  if (has(t, /\b(what can (you|i) (do|say|ask)|help me|^ help |how does this work|what should i (say|ask)|commands?|what do i say)\b/)) return reply(HELP, { actions: [{ type: 'help' }] })

  // who the guide is (honest: an AI guide, not Naveen)
  if (has(t, /\bare you naveen\b/)) return reply('No — I’m his AI guide. Naveen designed everything you’re walking through; I just show you around.')
  if (has(t, /\b(are you (an? )?(ai|bot|robot|human|real|person|chatbot)|who are you|what are you|your name|who am i talking to)\b/)) {
    return reply('Yep, I’m an AI — the guide inside Naveen’s portfolio. I can answer questions about his work, open projects, and walk you around the world.')
  }
  if (has(t, /\bcan you (actually |really )?(walk|move|take me|fly)\b/)) return reply('That’s the idea. Tell me where you’d like to go.')

  // a few plain definitions ("what does B2B mean?")
  const term = Object.keys(GLOSSARY).find((k) => t.includes(` ${k} `))
  if (term && has(t, /\b(mean|means|meaning|stand for|stands for|define|what is a|what is an|what are|what is)\b/) && !findProject(t)) return reply(GLOSSARY[term])

  let proj = findProject(t)
  // "the first one", "the previous one", "the mobile one"
  if (!proj) {
    const ref = resolveReference(t, ctx, world)
    if (ref && 'actions' in ref) return ref
    if (ref) proj = ref
  }
  const ctxProject = ctx.project ?? (world.openProject || null)
  const refers = has(t, PRONOUN)
  const place = findPlace(t)

  // outside the portfolio — honest, never a guess
  if (!proj && has(t, /\b(weather|temperature|forecast|news|president|prime minister|election|stock|bitcoin|crypto|score|recipe|capital of|translate|movie|song|lottery|horoscope)\b/)) {
    return reply('That’s outside what I know — I don’t have live or general information. I can tell you about Naveen’s work, projects, skills or experience.')
  }

  // ── context: what "this", "it", "explain" and "how did he build this" are about ──
  // what's in front of the visitor: the open case study, otherwise the place they're in
  const visible: Entity | null = world.openProject ? { kind: 'project', id: world.openProject } : placeEntity(world.location)
  const portfolioWords = has(t, /\b(this|the|your|his) (website|site|portfolio|world|game|web ?app|3d world|experience)\b/)

  // "who is this?" — a colleague the visitor is standing next to (names only; roles aren't in the portfolio)
  if (has(t, /\bwho (is|s) (this|that|he|she|this person|that person|this guy|that guy)\b|\bwho am i (looking at|talking to|standing next to)\b/) && !has(t, /\bnaveen\b/) && world.location !== 'start') {
    if (world.nearbyPerson) {
      return reply(`That’s ${world.nearbyPerson}, one of Naveen’s colleagues at NFC Solutions. I don’t have details about their role in the portfolio, so I won’t guess.`, { entity: { kind: 'person', id: world.nearbyPerson } })
    }
    if (world.location === 'office' || world.location === 'projects') return reply('I don’t have enough information about that person in the portfolio.')
  }
  if (ctx.entity?.kind === 'person' && has(t, /\bwhat (does|did) (she|he|they) do\b|\b(her|his|their) (role|job)\b/)) {
    return reply('I don’t have their role in the portfolio, so I won’t guess.')
  }

  // "how did he build this?" — the project on screen (its design process), or the portfolio itself
  const buildQ = has(t, /\bhow (did|does|do) (he|naveen|you) (build|make|create|develop|design|approach)\b|\bhow (was|is|were) (this|it|that|they) (built|made|designed|created|developed)\b|\bfrom (the )?(beginning|start) to (the )?end\b/)
  if (buildQ) {
    const contextProject = proj ?? (portfolioWords ? null : world.openProject ? PROJ(world.openProject) : ctx.entity?.kind === 'project' && has(t, /\b(it|that|there|them)\b/) ? PROJ(ctx.entity.id) : null)
    if (contextProject) return reply(projectProcess(contextProject), { project: contextProject.id, more: projectEverything(contextProject) })
    if (portfolioWords || has(t, /\b(this|it)\b/) || world.location === 'street' || world.location === 'start') {
      return reply(portfolioAnswer('stack', world.voice, has(t, /\b(explain|detail|technical|architecture)\b/)), { entity: { kind: 'portfolio' }, more: portfolioAnswer('architecture', world.voice, true) })
    }
  }

  // questions about the portfolio itself ("what technology is this?", "how does the AI navigate?")
  const ptopic = !proj ? portfolioTopic(t) : null
  if (ptopic && (portfolioWords || !has(t, /\bnaveen (use|uses|know)\b/))) {
    const deep = has(t, /\b(explain|detail|details|technical|architecture|in depth)\b/)
    return reply(portfolioAnswer(ptopic, world.voice, deep), { entity: { kind: 'portfolio' }, more: ptopic === 'architecture' ? null : portfolioAnswer('architecture', world.voice, true) })
  }

  // "explain", "explain it", "explain everything about X", "explain the previous one"
  // ("open the full case study in Figma" is a link request, handled below)
  const openingLink = has(t, /\bcase ?stud(y|ies)\b/) && has(t, /\b(open|figma|link|new tab|presentation)\b/)
  const everything = !openingLink && has(t, /\b(everything|all) about\b|\bfull (story|case study)\b|\bin full\b/)
  if (has(t, /\b(explain|describe|elaborate|walk me through)\b/) || everything || has(t, /^ (tell me about (it|this|that)|what about (it|this|that)|more about (it|this|that)) $/)) {
    const prev = has(t, /\b(previous|earlier|other) (one|project)\b/) && ctx.prevProject ? PROJ(ctx.prevProject) : null
    const e: Entity | null = proj || prev ? { kind: 'project', id: (proj ?? prev)!.id } : has(t, /\b(this|here)\b/) ? visible ?? ctx.entity : ctx.entity ?? visible
    if (e?.kind === 'project') {
      const p = PROJ(e.id)
      if (everything) return reply(projectEverything(p), { project: p.id })
      // a named part ("explain the challenge", "explain the approach")
      const f = has(t, PROJECT_FACET) ? projectFacet(p, t) : null
      if (f) {
        const show: GuideAction[] = has(t, /\bchallenge/) && world.openProject === p.id ? [{ type: 'showSection', section: 'challenges' }] : []
        // the headline, then the detail (not the same list twice)
        const lead = has(t, /\b(challenges?|problem|difficult\w*|hard\w*|tricky)\b/) ? `The main challenge — ${p.challenge.headline}` : f.text.split(/(?<=[.!?])\s/)[0]
        return { ...f, text: f.more ? `${lead} ${f.more}` : f.text, actions: show, more: null }
      }
      // the tab on screen decides: "explain" on the Challenges tab explains the challenge
      if (world.openProject === p.id && world.section === 'challenges') {
        return reply(`The challenge on ${p.title}: ${p.challenge.headline} ${p.challenge.items.map((c) => `${c.title} — ${lowerFirst(c.text)}`).join(' ')}`, { project: p.id, more: `The guiding question was: ${p.challenge.question}` })
      }
      return reply(projectExplain(p), { project: p.id, more: projectEverything(p) })
    }
    if (e?.kind === 'place') return reply(placeExplain(e.id), { place: e.id })
    if (e?.kind === 'portfolio') return reply(portfolioAnswer('architecture', world.voice, true), { entity: e })
    if (e?.kind === 'naveen') return reply(`${PROFILE.summary} ${thirdPerson(PROFILE.craft).replace('Naveen work', 'Naveen works')}`, { entity: e })
    if (e?.kind === 'person') return reply('I don’t have more information about that person in the portfolio.')
    if (!proj && !place) return reply('Happy to — what should I explain: Naveen, one of the projects, or this place?')
  }

  // the full case-study presentation in Figma ("open the case study link", or "open the case study" with one already on screen)
  const caseLink = has(t, /\bcase ?stud(y|ies)\b/) && (has(t, /\b(figma|link|full|presentation|behance|deck|new tab)\b/) || (has(t, /\bopen\b/) && !!world.openProject && !proj))
  if (caseLink) {
    const p = proj ?? (ctxProject ? PROJ(ctxProject) : null)
    if (!p) return reply(`Which project’s case study — ${joinList(PROJECTS_K.map((x) => x.title))}?`)
    return reply(`Sure — opening the full ${p.title} case study in Figma, in a new tab.`, { actions: [{ type: 'openPrototype', projectId: p.id, kind: 'caseStudy' }], project: p.id })
  }

  // the clickable UI prototype ("open the prototype", "can I try it?")
  if (has(t, /\b(prototype|figma file|in figma)\b/) || has(t, /\bcan i (try|play with|use|click through|test) (it|that|this)\b/)) {
    const p = proj ?? (ctxProject ? PROJ(ctxProject) : null)
    if (!p) return reply(`Which project’s prototype — ${joinList(PROJECTS_K.map((x) => x.title))}?`)
    if (!p.prototypeUrl) {
      return reply(`There isn’t a separate clickable prototype for ${p.title} in the portfolio, but its full case study is in Figma — opening that in a new tab.`, { actions: [{ type: 'openPrototype', projectId: p.id, kind: 'caseStudy' }], project: p.id })
    }
    return reply(`Sure — opening the ${p.title} prototype in Figma, in a new tab.`, { actions: [{ type: 'openPrototype', projectId: p.id, kind: 'prototype' }], project: p.id })
  }

  // a case-study tab ("show me the challenge")
  if (has(t, /\b(show|open|see|go to|switch to|read)\b/) && has(t, /\b(challenges?|overview)\b/)) {
    const p = proj ?? (ctxProject ? PROJ(ctxProject) : null)
    const section = has(t, /\bchallenge/) ? 'challenges' : 'overview'
    if (p) {
      const actions: GuideAction[] = world.openProject === p.id ? [{ type: 'showSection', section }] : [goProject(p.id), { type: 'showSection', section }]
      const text = section === 'challenges' ? `Here’s the challenge. ${p.challenge.headline}` : `Here’s the overview. ${projectShort(p)}`
      return reply(text, { actions, project: p.id, more: section === 'challenges' ? p.challenge.items.map((c) => `${c.title}: ${c.text}`).join(' ') : projectMore(p) })
    }
  }

  // "tell me more"
  if (has(t, /\b(tell me more|more detail|more details|go deeper|elaborate|explain more|in detail|keep going|go on|more about (it|that))\b/) && !proj) {
    if (ctx.more) return reply(ctx.more, { more: null })
    if (ctxProject) return reply(projectMore(PROJ(ctxProject)), { project: ctxProject })
    return reply('More about what — Naveen, his experience, or one of the projects?')
  }

  // recommendations ("where should I start?", "show me something interesting")
  if (has(t, /\b(where should (i|we) (go|start|begin)|what should i (see|look at|check)|which (project|one) (should|first|to)|best (work|project)|strongest|favou?rite|most interesting|something interesting|coolest|recommend|surprise me|what is good|where to (go|start))\b/)) {
    const inStudio = world.location === 'projects' || world.location.startsWith('project:')
    if (inStudio) {
      return reply('If you want complex product workflows, I’d start with TASK. If you’re into multi-role mobile UX, KidPool is a good one. Which one?', { offer: goProject('task') })
    }
    return reply('If you want to see the product work, I’d start at the Project Studio inside the NFC Solutions office. Want me to take you there?', { offer: go('projects') })
  }

  // where am I / what is this
  if (has(t, /\b(where am i|where are we|what is (this|here)( place)?|what am i (looking at|seeing)|what is this place|what are these)\b/)) {
    const loc = world.location
    if (loc.startsWith('project:')) {
      const p = PROJ(loc.slice(8))
      return reply(`This is the ${p.title} case study. ${projectShort(p)}`, { project: p.id, more: projectMore(p) })
    }
    return reply(PLACE_ABOUT[loc as keyof typeof PLACE_ABOUT] ?? PLACE_ABOUT.street)
  }

  // navigation ("take me to TASK", "let's go to your office", "show me")
  if (has(t, NAV_VERB) && !has(t, /\b(tell|explain|describe|what|why|how|who)\b/)) {
    const targetProject = proj ?? (!place && refers && ctxProject ? PROJ(ctxProject) : null)
    if (targetProject) {
      if (world.openProject === targetProject.id) return reply(`${targetProject.title} is open right here.`, { project: targetProject.id })
      return reply('Let’s take a look.', { actions: [goProject(targetProject.id)], project: targetProject.id })
    }
    let dest = place
    if (!dest && (refers || has(t, /^ (show me|show|take me there|let us go|go) $/))) {
      if (ctx.offer && (ctx.offer.type === 'navigate' || ctx.offer.type === 'navigateProject')) return reply('Sure — follow me.', { actions: [ctx.offer], offer: null })
      if (ctxProject) return reply('Let’s take a look.', { actions: [goProject(ctxProject)], project: ctxProject })
      if (ctx.place) dest = ctx.place
    }
    if (dest) {
      const here = world.location === dest || (dest === 'projects' && world.location.startsWith('project:'))
      if (here) return reply(dest === 'projects' ? 'We’re already here. Which project would you like to see?' : `We’re already at ${PLACE_NAMES[dest]}.`, { place: dest })
      const line = dest === 'projects' ? 'Sure. Follow me — the Project Studio is inside the NFC Solutions office.' : `Sure, let’s go to ${PLACE_NAMES[dest]}.`
      return reply(line, { actions: [go(dest)], place: dest })
    }
    if (has(t, /\b(take|bring|walk|lead|go|head|navigate)\b/)) return reply('Where would you like to go — Home, Education, NFC Solutions, the Project Studio, the Gallery or the Contact Café?')
  }

  // capability questions about Naveen ("can you design mobile apps?") — unless they point at a project
  if (!proj && !refers) {
    const early = capability(t)
    if (early) return early
  }

  // questions about one project (named, or the one we were talking about: "what was the challenge?")
  const aboutContext = refers || (has(t, PROJECT_FACET) && (!has(t, /\b(your|his|naveen)\b/) || has(t, /\b(was|were|did)\b/)))
  const facetProject = proj ?? (ctxProject && aboutContext && !has(t, /\b(tools do|skills)\b/) ? PROJ(ctxProject) : null)
  if (facetProject) {
    const f = projectFacet(facetProject, t)
    if (f) return f
    if (proj) return reply(projectShort(proj), { project: proj.id, more: projectMore(proj), offer: goProject(proj.id) })
  }

  const cap = capability(t)
  if (cap) return cap

  // about Naveen
  if (has(t, /\b(projects?|case stud(y|ies)|portfolio)\b/) && has(t, /\b(what|which|list|have (you|he)|worked on|designed)\b/) || has(t, /\bwhat (have|has) (you|he|naveen) (worked on|designed|built|made)\b|\bwhat (kind|kinds|type|types|sort) of (products|work|projects|apps)\b/)) {
    return reply(`Naveen’s case studies here are ${joinList(PROJECTS_K.map((p) => p.title))} — enterprise SaaS, school carpooling, mental health, a trademark association website and a staffing app. Want me to take you to them?`, { offer: go('projects') })
  }
  if (has(t, /\b(where is|where are|how do i get to|where can i find)\b/) && place) {
    return reply(`${PLACE_ABOUT[place].split('. ')[0]}. Want me to take you there?`, { offer: go(place), place })
  }
  if (has(t, /\b(how many years|years of experience|how long|experience|worked (at|for)|career|employer|companies|company|job|where (do|does) (you|he) work|current (role|job))\b/)) {
    return reply(`Naveen has ${PROFILE.experience} of experience. He’s been a ${EXPERIENCE.title} at ${EXPERIENCE.company} in ${EXPERIENCE.location} since May 2022, owning UX and UI for enterprise, healthcare and service-industry products.`, {
      more: `${EXPERIENCE.summary} His focus areas: ${joinList(EXPERIENCE.focus)}.`, offer: go('office'),
    })
  }
  if (has(t, /\b(design process|(your|his) process|how (do|does) (you|he|naveen) (design|work|approach)|workflow|methodology|how (you|he) work)\b/) && !has(t, /\bai\b/)) {
    return reply(`${thirdPerson(PROFILE.craft).replace('Naveen work', 'Naveen works')} AI helps him explore faster, but he makes the design decisions.`, {
      more: `His AI-assisted workflow: ${AI_WORKFLOW.map((s) => `${s.title} — ${s.text.replace(/\.$/, '').toLowerCase()}`).join('; ')}.`,
    })
  }
  if (has(t, /\b(ai|artificial intelligence|chatgpt|claude|machine learning|llm)\b/)) {
    return reply(`AI helps Naveen explore ideas, research directions, content, prototypes and alternatives faster — with ${joinList(AI_TOOLS)}. He stays responsible for UX judgment, prioritization and the final design decisions.`, {
      more: `His AI-assisted workflow has five steps: ${AI_WORKFLOW.map((s) => `${s.n} ${s.title} — ${s.text.replace(/\.$/, '').toLowerCase()}`).join('; ')}. AI accelerates exploration; human judgment drives the final experience.`,
      offer: go('gallery'),
    })
  }
  if (has(t, /\b(stud(y|ied|ies)|education|degrees?|college|universit(y|ies)|qualifications?|cgpa|gpa|masters?|bachelors?|msc|bsc|m sc|b sc|graduat\w*)\b/)) {
    const [m, b] = EDUCATION
    return reply(`Naveen studied Computer Science: an M.Sc. at ${m.institution}, ${m.place} (${m.years}), and a B.Sc. at ${b.institution}, ${b.place} (${b.years}).`, {
      more: `His CGPA was ${m.cgpa} for the M.Sc. and ${b.cgpa} for the B.Sc. He is also a ${CERTIFICATION.title}, from ${CERTIFICATION.issuer}, ${CERTIFICATION.year}.`, offer: go('education'),
    })
  }
  if (has(t, /\bcertif\w*\b/)) return reply(`He’s a ${CERTIFICATION.title}, from ${CERTIFICATION.issuer}, ${CERTIFICATION.year}. That’s his one certification.`)
  if (has(t, /\b(tools?|software|apps do|which apps|figma|adobe|photoshop|canva|relume|stitch|ux pilot)\b/)) {
    return reply(`His workflow includes ${joinList(TOOLS)}, with HTML/CSS knowledge for developer collaboration.`, { offer: go('home') })
  }
  if (has(t, /\b(skills?|good at|strengths?|expertise|capabilit\w*|speciali[sz]\w*|what kind of designer|what type of designer)\b/)) {
    return reply(`Naveen specialises in ${PROFILE.specialization.toLowerCase()}. His skills span UX research and information architecture, UI and interaction design, design systems, prototyping and developer handoff.`, {
      more: SKILL_GROUPS.map((g) => `${g.group}: ${g.items.join(', ')}.`).join(' '), offer: go('home'),
    })
  }
  if (has(t, /\b(where (are|is) (you|he|naveen) (based|located|from)|based|location|which city|where (do|does) (you|he) live)\b/)) return reply(`He’s based in ${PROFILE.location}.`)
  if (has(t, /\b(contact|reach|email|e mail|phone|number|call|hire|get in touch|linkedin|resume|cv|connect)\b/)) {
    const missing = has(t, /\b(linkedin|resume|cv)\b/) ? ' LinkedIn and résumé links aren’t in the portfolio yet, so email or phone is best.' : ''
    return reply(`You can email Naveen at ${CONTACT.email} or call ${CONTACT.phone}.${missing} The Contact Café has both — want me to take you there?`, { offer: go('contact') })
  }
  if (has(t, /\b(hobb(y|ies)|interests?|free time|outside (of )?work|sketch\w*|cricket|danc\w*|pencil)\b/)) {
    return reply(`Outside product design, Naveen enjoys ${joinList(INTERESTS.map((i) => i.toLowerCase()))}.`, { offer: go('gallery') })
  }
  if (has(t, /\b(colleagues?|coworkers?|team ?mates?|who (is|are) (that|these|those|they)|people in the office)\b/)) {
    return reply(`The people in the office are his colleagues at NFC Solutions — ${joinList(COLLEAGUES.map((c) => c.name))}. I don’t have their roles.`)
  }
  if (has(t, /\b(what (do|does) (you|he|naveen) do|who is (naveen|he)|tell me about (yourself|naveen|him)|about (yourself|naveen|him)|introduce|(your|his) background|what is (your|his) (work|job|role)|who (made|built|designed) this)\b/)) return aboutNaveen()

  if (has(t, METRICS)) return reply('The portfolio doesn’t include metrics or business results, and I don’t want to guess. I can walk you through the design work instead.')

  // a named project, or a place, with no clear question: describe it
  if (proj) return reply(projectShort(proj), { project: proj.id, more: projectMore(proj), offer: goProject(proj.id) })
  if (place && DESTINATIONS.includes(place)) return reply(`${PLACE_ABOUT[place]} Want me to take you there?`, { offer: go(place), place })

  return reply('I don’t want to guess about that. I can tell you about Naveen’s work, projects, skills or experience — or take you somewhere.', { unknown: true })
}
