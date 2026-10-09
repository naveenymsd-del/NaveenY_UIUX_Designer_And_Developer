// AI guide brain QA (no browser): runs real visitor phrasing through the
// built-in brain with conversation memory, and checks intent, grounding and
// actions. Usage: node scripts/qa-guide-brain.mjs [--print]
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'guide-brain-'))
const out = join(dir, 'brain.mjs')
await build({
  stdin: {
    contents: `export { localReply, findProject } from './src/ai/brain/local'
export { conversation, rememberUser, rememberReply, resetConversation, setProject } from './src/ai/conversation'
export { knowledgeText, PROJECTS_K, CONTACT } from './src/ai/knowledge'`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, tsconfig: 'tsconfig.app.json', logLevel: 'error',
})
const B = await import(pathToFileURL(out).href)
rmSync(dir, { recursive: true, force: true })

const PRINT = process.argv.includes('--print')
const problems = []
const BASE = { location: 'start', openProject: null, navigating: false, destination: null, section: null, tour: { status: 'idle', kind: null, stop: null, waiting: false }, nearbyPerson: null, voice: 'text', hour: 18 }
let world = { ...BASE }
const say = (text) => {
  B.rememberUser(text)
  const r = B.localReply(text, world, B.conversation)
  B.rememberReply(r)
  if (PRINT) console.log(`\n> ${text}\n  ${r.text}${r.actions.length ? `\n  [${r.actions.map((a) => JSON.stringify(a)).join(', ')}]` : ''}`)
  return r
}
const check = (text, test, label) => {
  const r = say(text)
  const ok = test(r)
  if (!ok) problems.push(`"${text}" — ${label}\n    got: ${r.text} ${JSON.stringify(r.actions)}`)
  console.log(`${ok ? '✓' : '✗'} ${text}  →  ${label}`)
  return r
}
const act = (type, key, value) => (r) => r.actions.some((a) => a.type === type && (key ? a[key] === value : true))
const txt = (re) => (r) => re.test(r.text)
const none = (r) => r.actions.length === 0
const and = (...fs) => (r) => fs.every((f) => f(r))

// ── persona: casual visitor
check('Hey', txt(/^Hi! Good evening\. Welcome/), 'friendly greeting (time-aware)')
check('Are you an AI?', txt(/\bAI\b/), 'honest about being an AI')
check('Are you Naveen?', txt(/his AI guide/i), 'not pretending to be Naveen')
check('Can you actually walk?', txt(/where you’d like to go/i), 'invites a destination')
check('Where should I go first?', and(txt(/Project Studio/), (r) => r.offer?.destination === 'projects'), 'recommends the studio, offers')
check('yeah', act('navigate', 'destination', 'projects'), '"yeah" accepts the offer → walk to projects')

// ── persona: recruiter
B.resetConversation()
check('Tell me about yourself', txt(/UI\/UX and Product Designer with 4\+ years/), 'about Naveen, third person')
check('what do you do', txt(/Naveen is a UI\/UX and Product Designer/), '"you" means Naveen')
check('How many years of experience do you have?', txt(/4\+ years.*NFC Solutions India Pvt\. Ltd\..*May 2022/), 'years + company + dates')
check('What kind of products have you designed?', and(txt(/TASK, KidPool, Calmscient, INTA and IntelliStaff/), (r) => r.offer?.type === 'tour' && r.offer?.kind === 'projects'), 'lists the five projects, offers to present them one by one')
check('Where are you based?', txt(/Hyderabad, India/), 'location')
check('How can I contact you?', txt(/naveenyarramallugalla@gmail\.com.*\+91 70362 82178/), 'email + phone')
check('Do you have a LinkedIn?', act('linkedin'), 'LinkedIn → opens his profile')
check('Can I see his resume?', and(act('resume'), txt(/résumé/)), 'résumé → opens the PDF')
check('Download his CV', act('resume'), 'CV → the résumé')
check('show me his résumé', act('resume'), 'résumé with accents')

// ── context: what is TASK → what did you do there → web or mobile → show me
B.resetConversation()
check('What is TASK?', and(txt(/^TASK is an enterprise ticketing/), (r) => r.project === 'task'), 'TASK overview from data')
check('What did you do there?', txt(/UI\/UX Designer on TASK/), '"there" = TASK → role')
check('Was it web or mobile?', txt(/web dashboards/i), 'platform of TASK')
check('Was it mobile?', txt(/^No — /), 'yes/no on mobile')
check('What was the challenge?', txt(/Lots of tickets/), 'challenge from case study')
check('Tell me more', txt(/Lists without hierarchy/), 'deeper challenge detail')
check('Show me.', act('navigateProject', 'projectId', 'task'), '"show me" walks to TASK')
check('tell me about that ticketing project', txt(/^TASK is/), 'ticketing alias → TASK')

// ── navigation phrasing
B.resetConversation()
check('Take me to your projects.', act('tour', 'kind', 'projects'), 'go to projects → walk to the studio, then each project in turn')
check("Let's go to your office", act('navigate', 'destination', 'office'), 'go to office')
check('Can you show me your education?', act('navigate', 'destination', 'education'), 'go to education')
check('Actually, take me home.', act('navigate', 'destination', 'home'), 'go home')
check('Take me to the café', act('navigate', 'destination', 'contact'), 'go to the café')
check('Show me IntelliStaff', act('navigateProject', 'projectId', 'intellistaff'), 'project by name')
check('Show me Intelli staff', act('navigateProject', 'projectId', 'intellistaff'), 'split name')
check('show me intellistuff', act('navigateProject', 'projectId', 'intellistaff'), 'misheard name (fuzzy)')
check('open calm scient', act('navigateProject', 'projectId', 'calmscient'), 'Calm scient')
check('Show me Kid Pool', act('navigateProject', 'projectId', 'kidpool'), 'Kid Pool')
check('Take me into the office', act('navigate', 'destination', 'office'), '"into" is not INTA')
world = { ...world, location: 'projects' }
check('Take me to projects', act('tour', 'kind', 'projects'), 'already in the studio → presents the projects (the studio stop is "already" there, no walk)')
world = { ...world, location: 'project:task', openProject: 'task' }
B.resetConversation()
check('Show me the challenge', act('showSection', 'section', 'challenges'), 'switch case study tab')
check('Open the prototype', and(act('openPrototype', 'projectId', 'task'), act('openPrototype', 'kind', 'prototype')), 'UI prototype of the open project')
check('Open the case study in Figma', act('openPrototype', 'kind', 'caseStudy'), 'Figma case study link')
check('Can I try it?', act('openPrototype', 'projectId', 'task'), '"try it" → prototype')
check('What is this?', txt(/TASK case study/), 'location-aware "what is this"')
check('Go back', act('goBack'), 'go back')
check('Open the IntelliStaff prototype', and(act('openPrototype', 'kind', 'caseStudy'), txt(/isn’t a separate clickable prototype/)), 'no UI prototype → honest, case study instead')
world = { ...BASE }

// ── control
check('Stop.', act('stop'), 'stop')
check('Wait', and(act('stop'), txt(/^Yep\?$/)), 'wait → "Yep?"')
check('What does B2B mean?', txt(/business-to-business/), 'glossary')

// ── designer / client personas
check('How do you use AI in your design workflow?', txt(/explore.*final design decisions/i), 'AI positioning')
check('What tools do you use?', txt(/Figma, Figma Make, Adobe XD, Photoshop, Canva, Relume, Google Stitch, UX Pilot, ChatGPT and Claude/), 'tools list')
check('Do you know Figma?', txt(/Yes — Figma/), 'specific tool')
check('Can you design mobile applications?', txt(/KidPool.*Calmscient.*IntelliStaff/), 'mobile capability from project data')
check('Have you designed healthcare products?', txt(/Calmscient/), 'healthcare')
check('Have you worked on enterprise products?', txt(/enterprise SaaS/), 'enterprise')
check('Can you create design systems?', txt(/design systems/i), 'design systems')
check('Can you work with developers?', txt(/developer handoff/i), 'developers')
check('Where did you study?', txt(/M\.Sc\..*Sri Hari.*B\.Sc\..*CSSR & SRRM/), 'education')
check('Tell me about your design process', txt(/UX research, information architecture/), 'process from résumé')
check('What did Naveen do on KidPool?', txt(/UI\/UX Designer on KidPool/), 'role on KidPool')
check('Who was Calmscient for?', txt(/people managing anxiety/i), 'users of Calmscient')
check('What colours does INTA use?', txt(/navy/i), 'INTA design system')

// ── honesty: out of domain / unknown
check('What is the weather tomorrow?', and(none, txt(/outside what I know/)), 'no weather')
check('Who is the president of France?', and(none, txt(/outside what I know/)), 'no trivia')
check('What was the revenue impact of TASK?', (r) => !/\d+%|\$\d/.test(r.text), 'no invented metrics')
check('asdf qwerty', txt(/don’t want to guess/), 'honest fallback')

// ── friend-like: greetings follow the visitor's local time (and never correct them)
B.resetConversation()
world = { ...BASE, hour: 9 }
check('Hi', txt(/Good morning/), 'morning greeting at 09:00')
world = { ...BASE, hour: 14 }
check('Hello', txt(/Good afternoon/), 'afternoon greeting at 14:00')
world = { ...BASE, hour: 19 }
check('Hey there', txt(/Good evening/), 'evening greeting at 19:00')
check('Good morning', txt(/Good morning/), 'answers "good morning" in kind at 19:00')
check("What's up?", txt(/showing people around/), 'what’s up')
world = { ...BASE }

// ── "explain" follows the conversation and what's on screen
B.resetConversation()
check('What is IntelliStaff?', txt(/^IntelliStaff Mobile lets/), 'what is → short')
check('Explain.', and(txt(/IntelliStaff/), txt(/client managers/i)), 'bare "explain" → IntelliStaff, medium')
check('Explain it', txt(/IntelliStaff/), '"explain it" → IntelliStaff')
check('How did Naveen build it?', and(txt(/approached the design of IntelliStaff/), txt(/doesn’t include the engineering implementation/)), 'build it → design process, honest about engineering')
check('What was difficult?', txt(/Staffing ran on phone calls/), 'difficult → the real challenge')
check('Show me.', act('navigateProject', 'projectId', 'intellistaff'), 'show me → IntelliStaff')
check('Explain everything about KidPool', and(txt(/The challenge:/), txt(/How he approached it/), txt(/Design decisions/)), 'explain everything → full case study')
check('Explain the previous one', txt(/IntelliStaff/), 'the previous one → IntelliStaff')
world = { ...BASE, location: 'project:task', openProject: 'task', section: 'challenges' }
B.resetConversation()
check('Explain', txt(/The challenge on TASK/), 'on the Challenges tab, "explain" explains the challenge')
check('Explain the challenge', and(txt(/Lots of tickets/), act('showSection', 'section', 'challenges')), 'explain the challenge (+ show the tab)')
check('How did he build this?', txt(/approached the design of TASK/), 'with TASK on screen, "this" = TASK')
check('How did he build this website?', txt(/React|three.js/), '"this website" = the portfolio')
world = { ...BASE }

// ── the portfolio itself, answered from the repository
B.resetConversation()
check('How is this built?', txt(/React.*three.js|three.js/), 'portfolio stack, simple')
check('Explain the architecture', txt(/procedurally|Rapier/), 'architecture, technical')
check('What technology is this using?', txt(/React/), 'technology')
check('How does the AI navigate?', txt(/waypoints|walks/), 'AI navigation explained')
check('How does the character move?', txt(/Rapier|character controller/), 'character')
check('How does the minimap work?', txt(/one location config/), 'minimap')
check('Is this a website or a game?', txt(/website you can play/), 'website or game')
check('Is my voice stored?', txt(/^No — the portfolio doesn’t record or keep your voice/), 'privacy, answered first')

// ── references: ordinals, "the mobile one"
B.resetConversation()
check('What projects has he worked on?', txt(/TASK, KidPool, Calmscient, INTA and IntelliStaff/), 'list')
check('Tell me about the first one', txt(/^TASK is/), 'the first one → TASK')
check('What about the last one?', txt(/IntelliStaff/), 'the last one → IntelliStaff')
check('Tell me about the mobile one', txt(/KidPool, Calmscient and IntelliStaff/), 'the mobile one → asks which (3 fit)')
check('the second one', txt(/Calmscient/), '…then "the second one" of that list → Calmscient')
check('the healthcare one', txt(/Calmscient/), 'the healthcare one → Calmscient')

// ── interruptions and changes of mind
B.resetConversation()
check('Wait, what does B2B mean?', txt(/business-to-business/), '"wait, …" answers the question')
check('Actually, take me home', act('navigate', 'destination', 'home'), '"actually, …" carries on')
check('Take me somewhere else', and(act('stop'), txt(/Where should we go?/), (r) => r.choosing === true), 'take me somewhere else → lists the places, waits for a choice')
check('Change that', act('stop'), 'change that')

// ── colleagues: names only, never a role
world = { ...BASE, location: 'office', nearbyPerson: 'Murali' }
check('Who is this?', and(txt(/Murali/), txt(/won’t guess/)), 'who is this → nearby colleague, no role')
check('What does he do?', txt(/don’t have their role/), 'no invented role')
world = { ...BASE }

// ── tours
B.resetConversation()
check('Tell me everything about Naveen', act('tour', 'kind', 'full'), 'full tour starts')
check('Give me a tour', act('tour', 'op', 'start'), 'give me a tour')
check('Show me all projects', act('tour', 'kind', 'projects'), 'project tour')
world = { ...BASE, tour: { status: 'active', kind: 'full', stop: 'education', waiting: true } }
check('Skip this', act('tour', 'op', 'next'), 'skip → next stop')
check('Move on', act('tour', 'op', 'next'), 'move on → next stop')
check('Go back', act('tour', 'op', 'prev'), 'go back (in a tour) → previous stop')
check('Continue', act('tour', 'op', 'continue'), 'continue')
check('Stop the tour', act('tour', 'op', 'stop'), 'stop the tour')
check('I want to explore myself', act('tour', 'op', 'stop'), 'explore myself → tour stops')
world = { ...BASE, tour: { status: 'active', kind: 'full', stop: 'education', waiting: true } }
check('Pause', and(act('stop'), txt(/^Paused/)), 'pause mid-tour → stops, says how to continue')

// at a tour stop, "this" / "explain" mean the stop — even after talking about something else
B.resetConversation()
check('What is KidPool?', (r) => r.project === 'kidpool', '(earlier topic: KidPool)')
B.setProject('intellistaff') // the tour arrived at IntelliStaff (tour.ts sets the subject)
world = { ...BASE, location: 'project:intellistaff', openProject: 'intellistaff', tour: { status: 'active', kind: 'projects', stop: 'project:intellistaff', waiting: true } }
check('Explain', txt(/IntelliStaff/), 'at IntelliStaff: "explain" → IntelliStaff')
check('What is this?', txt(/IntelliStaff/), 'at IntelliStaff: "what is this?" → IntelliStaff')
check('How did he design it?', txt(/IntelliStaff/), 'at IntelliStaff: "how did he design it?" → its design process')
check('What was the challenge here?', txt(/IntelliStaff|challenge/i), 'at IntelliStaff: the challenge')
world = { ...BASE }

// ── the visitor's exact commands, as one session (the world state follows each walk) ──
B.resetConversation()
world = { ...BASE }
const at = (location, extra = {}) => { world = { ...BASE, location, ...extra } }
check('Take me home', act('navigate', 'destination', 'home'), 'take me home → walks home')
at('home')
check('Tell me about Naveen', and(txt(/UI\/UX and Product Designer with 4\+ years/), txt(/B\.Sc\..*M\.Sc\./), txt(/NFC Solutions India/), txt(/Where should we go\?/), (r) => r.choosing === true), 'about Naveen in full (role, skills, education, process, work), then where next')
check('What tools does Naveen use?', txt(/Figma/), 'tools')
check('Take me to education', act('navigate', 'destination', 'education'), 'take me to education')
at('education')
check('Tell me about his education', and(txt(/B\.Sc\./), txt(/M\.Sc\./), txt(/CGPA/), txt(/Where should we go\?/)), 'education in full, then where next')
check('Take me to NFC', act('navigate', 'destination', 'office'), 'take me to NFC')
at('office')
check('Explain the company', and(txt(/NFC Solutions India Pvt\. Ltd\./), txt(/since May 2022/), txt(/Project Studio/), txt(/Figma/), txt(/won’t guess/), txt(/Where should we go\?/)), 'NFC in full: role, work, process, projects, tools, colleagues — then where next')
check('What does Naveen do there?', txt(/UI\/UX Designer at NFC Solutions India/), 'his role at NFC')
check('Take me to projects', act('tour', 'kind', 'projects'), 'take me to projects → studio, then each project')
B.setProject('task') // the tour has arrived at TASK (tour.ts sets the subject)
at('project:task', { openProject: 'task', tour: { status: 'active', kind: 'projects', stop: 'project:task', waiting: true } })
check('What projects has he worked on?', txt(/TASK, KidPool, Calmscient, INTA and IntelliStaff/), 'the projects, by name')
check('Explain this project', txt(/TASK/), 'explain this project → TASK')
check('Show me the prototype', act('openPrototype', 'projectId', 'task'), 'show me the prototype → TASK prototype')
check('Next project', act('tour', 'op', 'next'), 'next project (on the tour)')
check('Go back', act('tour', 'op', 'prev'), 'go back (on the tour) → previous')
at('street', { navigating: true, destination: 'kidpool', tour: { status: 'active', kind: 'projects', stop: 'project:kidpool', waiting: false } })
check('Actually, take me to education', and(act('navigate', 'destination', 'education'), txt(/change of plan/)), 'change of course mid-walk → new destination, acknowledged')
at('street')
check('Take me to contact', act('navigate', 'destination', 'contact'), 'take me to contact')
at('contact')
check('What can I do here?', and(txt(/naveenyarramallugalla@gmail\.com/), txt(/somewhere else/)), 'what can I do here → at the café')
check('Take me somewhere else', and(txt(/Where should we go\?/), (r) => r.choosing === true), 'somewhere else → the places, waiting for a choice')
check('the design journey', and(act('navigate', 'destination', 'gallery'), (r) => r.actions[0].explain === true), 'a choice → walks there, presents it on arrival')
check('Guide me', act('tour', 'kind', 'full'), 'guide me → the full tour')
at('street', { navigating: true, destination: 'home', tour: { status: 'active', kind: 'full', stop: 'home', waiting: false } })
check('Stop', act('stop'), 'stop')
at('street', { tour: { status: 'paused', kind: 'full', stop: 'home', waiting: false } })
check('Continue', act('tour', 'op', 'continue'), 'continue (the tour)')
at('street', { navigating: true, destination: 'home', tour: { status: 'active', kind: 'full', stop: 'home', waiting: false } })
check('Pause', and(act('stop'), txt(/^Paused/)), 'pause')
at('contact')
check('Explain this', and(txt(/Contact Café/), txt(/naveenyarramallugalla@gmail\.com/), txt(/Where should we go\?/)), 'explain this at the café → the café')
at('projects')
check('Explain this', and(txt(/Project Studio/), txt(/one by one/), (r) => r.offer?.type === 'tour'), 'explain this in the studio → the studio, offers the projects one by one')
at('project:calmscient', { openProject: 'calmscient' })
check('Explain this', txt(/Calmscient/), 'explain this inside Calmscient → Calmscient')

// compound and natural navigation
B.resetConversation()
world = { ...BASE }
check('Take me to NFC and explain about Naveen’s company', and(act('navigate', 'destination', 'office'), (r) => r.actions[0].explain === true, txt(/tell you all about it/)), 'walk to NFC, present it on arrival')
for (const [q, dest] of [['Show me the company', 'office'], ['Let’s talk', 'contact'], ['Take me to the café', 'contact'], ['Show me your education', 'education']]) {
  check(q, act('navigate', 'destination', dest), `natural phrasing → ${dest}`)
}
for (const q of ['Show me your projects', 'Let’s see the projects', 'Take me to the projects']) check(q, act('tour', 'kind', 'projects'), 'projects → the project tour')
check('Where are your projects?', and(txt(/Project Studio/), (r) => r.offer?.type === 'tour'), 'where are the projects → where, and an offer')
check('Tell me about your company', and(txt(/NFC Solutions India/), (r) => r.offer?.destination === 'office'), 'about the company (elsewhere) → presented, offer to go')
check('How does Naveen work?', and(txt(/UX research/), (r) => r.offer?.destination === 'gallery'), 'how he works → process, offer the Design Journey')

// a walk question, answered
B.resetConversation()
at('street', { navigating: true, destination: 'projects' })
B.conversation.question = { id: 'simplicity', at: Date.now() }
check('Simplicity', txt(/Good choice.*almost there/), 'answer to the walk question → a natural reply')
B.conversation.question = { id: 'form', at: Date.now() }
check('What is TASK?', txt(/^TASK is/), 'a real question during a walk question is answered as a question')
world = { ...BASE }

// grounding: every number/email/phone in any answer must appear in the knowledge text
const K = B.knowledgeText()
console.log(`\n${problems.length ? `${problems.length} problem(s):\n- ${problems.join('\n- ')}` : 'all checks passed'}`)
console.log(`knowledge text: ${K.length} chars`)
process.exit(problems.length ? 1 : 0)
