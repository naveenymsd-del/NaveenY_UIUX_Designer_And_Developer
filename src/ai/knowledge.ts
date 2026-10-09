/**
 * The guide's knowledge layer. Nothing here is new information: it reads the
 * portfolio's own data (portfolioContent, projects, world, colleagues) and
 * re-shapes it for answering questions. Pure TypeScript with no browser APIs,
 * so the optional server endpoint (server/guide.ts) can import it too.
 */
import { COLLEAGUES } from '../data/colleagues'
import {
  AI_TOOLS, AI_WORKFLOW, CERTIFICATION, CONTACT, EDUCATION, EXPERIENCE, INTERESTS, PROFILE, SKILL_GROUPS, TOOLS,
} from '../data/portfolioContent'
import { PROJECT_CONTENT, type ProjectContent } from '../data/projects'

export { AI_TOOLS, AI_WORKFLOW, CERTIFICATION, CONTACT, EDUCATION, EXPERIENCE, INTERESTS, PROFILE, SKILL_GROUPS, TOOLS }
export const PROJECTS_K = PROJECT_CONTENT
export type ProjectK = ProjectContent

/** places the guide can walk to (a closed set — nothing else is ever navigable) */
export const DESTINATIONS = ['start', 'home', 'education', 'office', 'projects', 'gallery', 'contact'] as const
export type DestinationId = (typeof DESTINATIONS)[number]

export const PLACE_NAMES: Record<DestinationId, string> = {
  start: 'the start', home: 'Home', education: 'Education', office: 'the NFC Solutions office',
  projects: 'the Project Studio', gallery: 'the Design Journey', contact: 'the Contact Café',
}

/** where the visitor can be (for "what is this?") */
export type LocationKey = DestinationId | 'street' | 'plaza' | `project:${string}`

/** what each place is, in the guide's words (grounded in what the place contains) */
export const PLACE_ABOUT: Record<DestinationId | 'street' | 'plaza', string> = {
  start: 'This is the start of Naveen’s world — the welcome promenade. Home, Education, the NFC Solutions office, the Project Studio, the Design Journey and the Contact Café are all up the avenue.',
  home: 'This is Naveen’s home — about him, his skills and tools, how he uses AI in design, and a few interests.',
  education: 'This is where you can explore Naveen’s academic background: an M.Sc. and a B.Sc. in Computer Science, and his UI/UX certification.',
  office: `This represents Naveen’s professional world at ${EXPERIENCE.company}, where he has worked as a ${EXPERIENCE.title} since May 2022. The Project Studio is in the glass wing on the right.`,
  projects: `This is the Project Studio, where Naveen’s case studies live: ${PROJECT_CONTENT.map((p) => p.title).join(', ')}.`,
  gallery: 'This is the Design Journey, in the park — how Naveen approaches design: his AI-assisted workflow in the gazebo, real UI screens from his case studies on the easels, and his interests outside product design.',
  contact: 'This is the Contact Café, the last stop — where you can get in touch with Naveen.',
  street: 'You’re out on the avenue. I can take you to Home, Education, NFC Solutions, the Project Studio, the Design Journey or the Contact Café.',
  plaza: 'This is the fountain plaza, a place to pause. The projects are in the Project Studio inside the NFC Solutions office.',
}

/** extra spoken / misheard names for projects (speech recognition often splits or merges words) */
export const PROJECT_ALIASES: Record<string, string[]> = {
  task: ['task', 'tasks', 'ticketing', 'ticketing project', 'ticket', 'ticket management', 'project management'],
  kidpool: ['kidpool', 'kid pool', 'kids pool', 'kit pool', 'kid-pool', 'carpool', 'carpooling', 'school carpooling'],
  calmscient: ['calmscient', 'calm scient', 'calm science', 'calm sciences', 'calmsient', 'calm sient', 'mental health', 'wellness'],
  inta: ['inta', 'enta', 'inta website', 'trademark', 'international trademark association', 'ask inta'],
  intellistaff: ['intellistaff', 'intelli staff', 'intelly staff', 'intel staff', 'intel e staff', 'intellistaf', 'staffing', 'staffing app'],
}

/** portfolio vocabulary, offered to speech recognisers that accept phrase hints */
export const VOCABULARY = [
  'Naveen', 'NFC Solutions', ...PROJECT_CONTENT.map((p) => p.title), 'Project Studio', 'Contact Café', 'Design Journey', 'Gallery',
  'Figma', 'Figma Make', 'UX Pilot', 'Relume', 'Google Stitch', 'UI/UX', 'UX', 'Product Designer', 'B2B', 'SaaS', 'prototype', 'case study',
]

/** a few plain-language definitions for terms used in the case studies */
export const GLOSSARY: Record<string, string> = {
  b2b: 'B2B means business-to-business — the product is designed for organisations and teams rather than individual consumers.',
  saas: 'SaaS means software as a service — software used in the browser on a subscription, rather than installed.',
  ux: 'UX is user experience — how easy, clear and pleasant a product is to use, from flows and structure to usability.',
  ui: 'UI is the user interface — the screens, layout, type, colour and components people actually see and touch.',
  ia: 'Information architecture is how content and features are organised and labelled, so people can find what they need.',
  'design system': 'A design system is a shared set of reusable components, styles and rules, so a product stays consistent as it grows.',
  prototype: 'A prototype is a clickable model of a product, used to try flows and test ideas before anything is built.',
  wireframe: 'A wireframe is a simple, low-fidelity layout of a screen — structure first, before visual design.',
  'case study': 'A case study explains a project: the problem, the approach, the design decisions and the result screens.',
  wcag: 'WCAG is the Web Content Accessibility Guidelines — the standard for making digital products accessible.',
}

const list = (a: string[]) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)
export { list as joinList }

/** the projects whose platform/category matches a capability ("mobile", "healthcare"…) */
export function projectsMatching(re: RegExp) {
  return PROJECT_CONTENT.filter((p) => re.test(`${p.category} ${p.platform} ${p.fullTitle}`))
}

/**
 * The whole knowledge base as compact text — the grounding document for the
 * optional LLM endpoint. Built from the same data as the 3D world.
 */
export function knowledgeText() {
  const lines: string[] = []
  lines.push(`# ${PROFILE.fullName}`)
  lines.push(`Role: ${PROFILE.role}. Specialization: ${PROFILE.specialization}. Experience: ${PROFILE.experience}. Location: ${PROFILE.location}.`)
  lines.push(`Summary: ${PROFILE.summary}`)
  lines.push(`Craft: ${PROFILE.craft}`)
  lines.push(`AI position: ${PROFILE.ai} AI workflow: ${AI_WORKFLOW.map((s) => `${s.n} ${s.title} — ${s.text}`).join(' ')} AI tools: ${AI_TOOLS.join(', ')}.`)
  lines.push(`Experience: ${EXPERIENCE.title}, ${EXPERIENCE.company}, ${EXPERIENCE.location}, ${EXPERIENCE.dates}. ${EXPERIENCE.summary} Focus areas: ${EXPERIENCE.focus.join(', ')}.`)
  lines.push(`Education: ${EDUCATION.map((e) => `${e.degree} in ${e.field}, ${e.institution}, ${e.place}, ${e.years}, CGPA ${e.cgpa}`).join('; ')}.`)
  lines.push(`Certification (the only one): ${CERTIFICATION.title}, ${CERTIFICATION.issuer}, ${CERTIFICATION.year}.`)
  for (const g of SKILL_GROUPS) lines.push(`Skills — ${g.group}: ${g.items.join(', ')}.`)
  lines.push(`Interests: ${INTERESTS.join(', ')}.`)
  lines.push(`Contact: email ${CONTACT.email}; phone ${CONTACT.phone}. LinkedIn and résumé links are not available yet.`)
  lines.push(`Colleagues shown in the office: ${COLLEAGUES.map((c) => c.name).join(', ')} (their roles are not listed).`)
  lines.push('')
  for (const p of PROJECT_CONTENT) {
    lines.push(`## Project ${p.title} (id: ${p.id}) — ${p.fullTitle}`)
    lines.push(`Domain: ${p.category}. Platform: ${p.platform}. Naveen's role: ${p.role}. Scope: ${p.scope}.`)
    lines.push(`Statement: ${p.summary}`)
    lines.push(`Overview: ${p.overview.join(' ')}`)
    lines.push(`Approach: ${p.approach.join(' ')}`)
    lines.push(`Key flows: ${p.flows.map((f) => `${f.title}: ${f.steps.join(' → ')}`).join('; ')}.`)
    lines.push(`Information architecture: ${p.ia.map((i) => `${i.title} (${i.text})`).join('; ')}.`)
    lines.push(`Design system: ${p.design.text} Colours: ${p.design.colors.map((c) => `${c.name} ${c.hex}`).join(', ')}. Type: ${p.design.type}. Components: ${p.design.components.join(', ')}.`)
    lines.push(`Challenge: ${p.challenge.headline} ${p.challenge.items.map((c) => `${c.title} — ${c.text}`).join(' ')} Question: ${p.challenge.question}`)
    lines.push(`Users: ${p.users.map((u) => `${u.name} (${u.who}; needs: ${u.needs.join(', ')})`).join('; ')}.`)
    lines.push(`Design decisions: ${p.decisions.map((d) => `${d.title} — ${d.text}`).join(' ')}`)
    lines.push(p.prototypeUrl
      ? 'Links: a clickable UI prototype and the full case-study presentation, both in Figma (use the open_prototype tool with kind prototype or caseStudy).'
      : 'Links: the full case-study presentation in Figma (open_prototype with kind caseStudy). There is no separate clickable UI prototype link for this project.')
    lines.push('')
  }
  lines.push('## Places in the 3D world')
  for (const d of DESTINATIONS) lines.push(`${d}: ${PLACE_ABOUT[d]}`)
  return lines.join('\n')
}
