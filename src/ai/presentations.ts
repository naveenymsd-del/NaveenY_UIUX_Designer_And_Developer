import { COLLEAGUES } from '@/data/colleagues'
import { OFFICE_STORIES } from '@/data/portfolioContent'
import {
  AI_TOOLS, AI_WORKFLOW, CERTIFICATION, CONTACT, EDUCATION, EXPERIENCE, INTERESTS, PLACE_NAMES, PROFILE, PROJECTS_K, SKILL_GROUPS, TOOLS,
  joinList, type DestinationId, type ProjectK,
} from './knowledge'

/**
 * What the guide says when it presents a place or a project. Every sentence
 * is assembled from the portfolio's own data (src/data/*) — nothing here adds
 * facts: no metrics, team sizes, clients or tools that aren't in the data.
 * Presentations end by handing the conversation back to the visitor.
 */

/** lower-case the first letter — but never an acronym ("KPI cards", "UX research") */
const lowerFirst = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1))
const dot = (s: string) => s.replace(/[.!?]\s*$/, '')
const firstSentence = (s: string) => `${dot(s.split(/(?<=[.!?])\s/)[0])}.`
/** first-person case-study copy, retold in the guide's voice */
const third = (s: string, name = 'Naveen') =>
  s.replace(/\bI’m\b/g, `${name}’s`).replace(/\bI'm\b/g, `${name}'s`).replace(/\bI\b/g, name).replace(/\bmy\b/g, 'his').replace(/\bMy\b/g, 'His').replace(/\bme\b/g, 'him')

/** the places a visitor can pick from, as the guide offers them */
export const DESTINATION_MENU: { id: DestinationId; name: string; what: string }[] = [
  { id: 'home', name: 'Home', what: 'who Naveen is' },
  { id: 'education', name: 'Education', what: 'where his journey started' },
  { id: 'office', name: 'NFC Solutions', what: 'his professional world' },
  { id: 'projects', name: 'the Project Studio', what: 'his projects' },
  { id: 'gallery', name: 'the Design Journey', what: 'how he approaches design' },
  { id: 'contact', name: 'the Contact Café', what: 'how to reach him' },
]

/** "What would you like to explore next?" — the other places, briefly */
export function nextPrompt(here: DestinationId | null, lead = 'What would you like to explore next?') {
  const others = DESTINATION_MENU.filter((d) => d.id !== here)
  return `${lead} I can take you to ${joinList(others.map((d) => `${d.name} for ${d.what}`))}. Where should we go?`
}

const [MSC, BSC] = EDUCATION

/** a place in full — what "explain this" and "take me there and explain" give */
export function placePresentation(id: DestinationId): string {
  switch (id) {
    case 'home':
      return [
        `${PROFILE.fullName} is a UI/UX and Product Designer with ${PROFILE.experience} of experience, based in ${PROFILE.location}.`,
        `He specialises in ${PROFILE.specialization.toLowerCase()}: user-centred products across enterprise SaaS, recruitment and HR technology, healthcare and service businesses.`,
        `His skills cover ${joinList(SKILL_GROUPS.filter((g) => g.short !== 'Tools').map((g) => g.group))}, and he works in ${joinList(TOOLS.slice(0, 6))} and more.`,
        `He studied Computer Science — a B.Sc. and an M.Sc. — and he’s a ${CERTIFICATION.title}.`,
        `His process runs ${lowerFirst(dot(third(PROFILE.craft).replace(/^Naveen work across /, 'across ')))}.`,
        `Today he’s a ${EXPERIENCE.title} at ${EXPERIENCE.company}, where he has worked since May 2022. In his words: “${PROFILE.ai}”`,
      ].join(' ')
    case 'education':
      return [
        `This is where Naveen’s journey began. He studied Computer Science: a B.Sc. at ${BSC.institution}, ${BSC.place} (${BSC.years}), with a CGPA of ${BSC.cgpa},`,
        `then an M.Sc. at ${MSC.institution} (${MSC.years}), with a CGPA of ${MSC.cgpa}.`,
        `He’s also a ${CERTIFICATION.title}, from ${CERTIFICATION.issuer}, ${CERTIFICATION.year}.`,
        'From there he moved into UI/UX and product design.',
      ].join(' ')
    case 'office': {
      const names = joinList(COLLEAGUES.slice(0, 3).map((c) => c.name))
      return [
        `This is NFC Solutions — ${EXPERIENCE.company} in ${EXPERIENCE.location} — Naveen’s professional world. He has been a ${EXPERIENCE.title} here since May 2022.`,
        `His role: ${lowerFirst(dot(EXPERIENCE.summary))}.`,
        `The work spans ${joinList(EXPERIENCE.focus.slice(0, 4).map((x) => x.toLowerCase().replace('saas', 'SaaS').replace(' / hr tech', ' and HR tech')))} — ${joinList(EXPERIENCE.focus.slice(4, 8).map((x) => x.toLowerCase()))}.`,
        `Day to day, ${lowerFirst(third(OFFICE_STORIES.meeting.body ?? '')).replace(/^naveen work/, 'he works')}`,
        `His process runs from ${lowerFirst(dot(OFFICE_STORIES.designWall.body ?? ''))}.`,
        `The products from here are in the Project Studio, in the glass wing: ${joinList(PROJECTS_K.map((p) => p.title))}.`,
        `He works in ${joinList(TOOLS.slice(0, 5))}, with ${joinList(AI_TOOLS.slice(0, 2))} to explore faster — though he makes the design decisions himself.`,
        `The people you see around the office are his colleagues, like ${names} — I don’t have their roles, so I won’t guess.`,
      ].join(' ')
    }
    case 'projects':
      return `This is the Project Studio — the products Naveen has designed: ${joinList(PROJECTS_K.map((p) => `${p.title} (${p.category.split(' · ')[0]})`))}. Each screen opens a case study with an Overview and a Challenges tab, plus Figma links.`
    case 'gallery':
      return [
        'This is the Design Journey, in the park — how Naveen approaches design.',
        `His AI-assisted workflow has five steps: ${AI_WORKFLOW.map((s) => `${s.title.toLowerCase()} — ${lowerFirst(dot(s.text))}`).join('; ')}.`,
        `In his words: “${PROFILE.ai}”`,
        'The easels show real screens from his case studies,',
        `and outside product design he enjoys ${joinList(INTERESTS.map((x) => x.toLowerCase()))}.`,
      ].join(' ')
    case 'contact':
      return [
        'We’ve reached the Contact Café. This is where you can connect with Naveen.',
        `You can email him at ${CONTACT.email}, or call ${CONTACT.phone} — both are on the card here. LinkedIn and résumé links aren’t in the portfolio yet.`,
        'Or simply keep exploring.',
      ].join(' ')
    case 'start':
      return 'This is the start of Naveen’s world. Every place is up the avenue — and I can walk you to any of them.'
  }
}

/** what the guide says the moment it arrives somewhere (short; the full story is one "yes" away) */
export function arrivalLine(id: DestinationId): string {
  const L: Record<DestinationId, string> = {
    start: 'Here we are — back at the start.',
    home: 'We’re here — this is Naveen’s home: who he is, his skills and tools, and how he works.',
    education: 'We’re here — Education, where Naveen’s journey began.',
    office: `We’re here — NFC Solutions, where Naveen has been a ${EXPERIENCE.title} since May 2022.`,
    projects: `Here we are — the Project Studio: ${joinList(PROJECTS_K.map((p) => p.title))}.`,
    gallery: 'We’re here — the Design Journey: how Naveen approaches design, real screens from his work, and life outside the screen.',
    contact: '',
  }
  return L[id]
}

/** "What can I do here?" — per place */
export function placeActions(id: DestinationId | null, project?: ProjectK | null): string {
  if (project) {
    const links = project.prototypeUrl ? 'open the clickable prototype or the full case study in Figma' : 'open the full case study in Figma'
    return `Here you can read the ${project.title} case study — switch between Overview and Challenges, ${links}, or ask me to explain it, the challenge, or how Naveen designed it. Say “next project” to move on.`
  }
  const L: Partial<Record<DestinationId, string>> = {
    home: 'Walk up to the boards on the walls — his profile, skills, tools and AI workflow — and press E or tap them to read more. Or ask me about Naveen.',
    education: 'Walk to the boards to read about his degrees and certification, or ask me about his education.',
    office: 'You can meet his colleagues, read the boards about his role and process, or head into the Project Studio in the glass wing. Ask me to explain the company.',
    projects: 'Walk up to any screen and open it to read the case study — or I can present the projects one by one. Just say “show me the projects”.',
    gallery: 'Open an easel to browse real screens from his case studies, or visit the gazebo for his AI-assisted workflow.',
    contact: `You can email Naveen at ${CONTACT.email} or call ${CONTACT.phone}, sit down for a chat, or ask me to take you somewhere else.`,
  }
  return (id && L[id]) || 'You can walk anywhere with the joystick or keys, open the menu to see every place, or ask me to take you somewhere — Home, Education, NFC Solutions, the Project Studio, the Design Journey or the Contact Café.'
}

/** one project, presented on a tour: what, role, platform, problem, approach, a decision, links — then a question */
export function projectPresentation(p: ProjectK): string {
  const decision = p.decisions[0]
  const links = p.prototypeUrl
    ? 'If you’d like to see the actual interaction, the prototype is one tap away — “View prototype” — and the full case study is next to it.'
    : 'There’s no separate clickable prototype for this one, but the full case study is in Figma — “Case study”.'
  return [
    `This is ${p.title}. ${firstSentence(third(p.overview[0]))}`,
    `Naveen was the ${p.role} — ${lowerFirst(p.platform.replace(' · ', ', '))}, in ${p.category.split(' · ')[0]}.`,
    `The main challenge: ${p.challenge.headline}`,
    // approach lines are either actions ("Reviewed the tools…") or headings ("Role-based information architecture: …")
    /^[A-Z][a-z]+ed\b/.test(p.approach[0]) ? `First, he ${lowerFirst(dot(p.approach[0]))}.` : `His approach started with ${lowerFirst(dot(p.approach[0]))}.`,
    decision ? `One key decision: ${decision.title.replace(/[“”]/g, '')} — ${lowerFirst(dot(decision.text))}.` : '',
    links,
  ].filter(Boolean).join(' ')
}

export const PROJECT_TOUR_PROMPT = 'Would you like to explore this project further, or should I show you the next one?'

/** a destination named in a short answer to "where should we go?" */
export const CHOICE_WORDS: [DestinationId, RegExp][] = [
  ['projects', /\b(projects?|studio|project studio|work|case stud(y|ies))\b/],
  ['contact', /\b(contact|cafe|café|coffee|connect|talk)\b/],
  ['office', /\b(nfc|company|office|professional|work ?place|experience)\b/],
  ['education', /\b(education|college|campus|school|studies|degrees?|journey started|started)\b/],
  ['gallery', /\b(design journey|journey|design|gallery|park|process|approach|ai)\b/],
  ['home', /\b(home|about (him|naveen)|naveen)\b/],
]

export const placeName = (id: DestinationId) => PLACE_NAMES[id]
