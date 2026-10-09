/**
 * Portfolio content — everything the world "says" about Naveen lives here.
 *
 * Source of truth: Naveen's résumé. Only facts from the résumé are stated;
 * anything not in it is left out rather than shown as a placeholder. Keep
 * entries short: the world shows them on boards, plaques and small cards,
 * not as long pages. Projects live in data/projects.ts.
 */
import { PROJECT_CONTENT } from './projects'

export interface ContentItem {
  label: string
  text: string
}

export interface StoryContent {
  heading: string
  kicker: string
  body: string
  items?: ContentItem[]
  /** optional call to action handled by the panel */
  cta?: { label: string; action: 'projects' | 'contact' | 'gallery' }
}

const P = (label: string, text: string): ContentItem => ({ label, text })

export const PROFILE = {
  name: 'Naveen',
  fullName: 'Naveen Y',
  role: 'UI/UX Designer · Product Designer',
  specialization: 'Web & Mobile App Design',
  experience: '4+ years',
  company: 'NFC Solutions',
  companyFull: 'NFC Solutions India Pvt. Ltd.',
  location: 'Hyderabad, India',
  tagline: 'Designing clear, human digital experiences across web, mobile and enterprise products.',
  summary:
    'UI/UX Designer with 4+ years of experience designing user-centered web and mobile applications across enterprise SaaS, recruitment/HR technology, healthcare, and service businesses.',
  /** shown in the Home "About me" panel */
  about:
    'I’m a UI/UX Designer and Product Designer with 4+ years of experience designing digital products across enterprise SaaS, healthcare, recruitment/HR technology and service platforms.',
  craft:
    'I work across UX research, information architecture, user flows, wireframing, prototyping, UI design, design systems and developer handoff.',
  ai: 'AI helps me explore. I make the design decisions.',
}

/**
 * Contact. Only real, working values belong here — an empty string hides the
 * button everywhere. LinkedIn is Naveen's profile (supplied by him). `resume` is Naveen's résumé PDF, served from
 * /public (View opens it in a new tab, Download saves it).
 */
export const CONTACT = {
  email: 'naveenyarramallugalla@gmail.com',
  phone: '+91 70362 82178',
  linkedin: 'https://www.linkedin.com/in/naveen-yarramallugalla-782361238',
  resume: '/resume/Naveen_Yarramallugalla_UIUX_Designer_Resume.pdf',
}

// ── Experience (résumé) ─────────────────────────────────────────────────────
export const EXPERIENCE = {
  title: 'UI/UX Designer',
  company: PROFILE.companyFull,
  location: PROFILE.location,
  dates: 'May 2022 – Present',
  summary:
    'End-to-end ownership of UX and UI for enterprise, healthcare and service-industry products from requirements and research through prototyping, design systems and developer handoff.',
  focus: [
    'Enterprise SaaS', 'Healthcare', 'Recruitment / HR Tech', 'Service platforms', 'Web applications',
    'Mobile applications', 'Dashboards', 'Design systems', 'Prototyping', 'Developer collaboration',
  ],
}

// ── Education & certification (résumé) ─────────────────────────────────────
export const EDUCATION: { degree: string; short: string; field: string; institution: string; place: string; years: string; cgpa: string }[] = [
  { degree: 'Master of Science (M.Sc.)', short: 'M.Sc.', field: 'Computer Science', institution: 'Sri Hari Degree and PG College', place: 'Kadapa', years: '2019–2021', cgpa: '7.8' },
  { degree: 'Bachelor of Science (B.Sc.)', short: 'B.Sc.', field: 'Computer Science', institution: 'CSSR & SRRM Degree and PG College', place: 'Kadapa', years: '2016–2019', cgpa: '8.1' },
]

/** the one certification */
export const CERTIFICATION = { title: 'Certified UI/UX Designer (CWD)', issuer: 'Tech Mahindra Smart Academy', year: '2021' }

// ── Skills & tools (résumé) ────────────────────────────────────────────────
export const SKILL_GROUPS: { group: string; short: string; items: string[] }[] = [
  {
    group: 'UX Design', short: 'UX',
    items: ['User Research', 'Stakeholder Interviews', 'Personas', 'Journey Mapping', 'Information Architecture', 'User Flows', 'Task Flows', 'Wireframing', 'Usability Testing', 'Heuristic Evaluation', 'Design Thinking'],
  },
  {
    group: 'UI Design', short: 'UI',
    items: ['UI Design', 'Visual Design', 'Interaction Design', 'High-Fidelity UI', 'Responsive Design', 'Mobile Design', 'Dashboard Design', 'Typography', 'Grid & Layout', 'Branding'],
  },
  {
    group: 'Systems & Delivery', short: 'Systems',
    items: ['Design Systems', 'Component Libraries', 'Style Guides', 'Interactive Prototyping', 'Accessibility (WCAG 2.1)', 'Developer Handoff', 'Cross-Functional Collaboration', 'Agile/Scrum'],
  },
  {
    group: 'Tools', short: 'Tools',
    items: ['Figma', 'Figma Make', 'Adobe XD', 'Photoshop', 'Canva', 'Relume', 'Google Stitch', 'UX Pilot', 'ChatGPT', 'Claude'],
  },
  {
    group: 'Front-end awareness', short: 'Front-end',
    items: ['HTML5', 'CSS3', 'Responsive Layouts', 'Developer Handoff'],
  },
]

export const TOOLS = SKILL_GROUPS.find((g) => g.short === 'Tools')!.items
export const AI_TOOLS = ['ChatGPT', 'Claude', 'Figma Make', 'UX Pilot']

export const INTERESTS = ['Pencil Art & Sketching', 'Cricket', 'Dance']

// ── AI-assisted design ─────────────────────────────────────────────────────
export const AI_WORKFLOW: { n: string; title: string; text: string; human?: boolean }[] = [
  { n: '01', title: 'Explore', text: 'Research directions, references and possibilities.' },
  { n: '02', title: 'Ideate', text: 'Generate and compare alternative concepts.' },
  { n: '03', title: 'Prototype', text: 'Rapidly explore interaction and UI directions.' },
  { n: '04', title: 'Refine', text: 'Challenge assumptions, iterate and improve.' },
  { n: '05', title: 'Human judgment', text: 'Choose what actually works for the user and product.', human: true },
]

export const AI_STORY: StoryContent = {
  kicker: 'AI-assisted design', heading: PROFILE.ai,
  body: 'AI accelerates exploration. Human judgment drives the final experience.',
  items: [
    ...AI_WORKFLOW.map((s) => P(`${s.n} — ${s.title}`, s.text)),
    P('AI tools', AI_TOOLS.join(' · ')),
  ],
}

// ── Gallery ────────────────────────────────────────────────────────────────
/**
 * Gallery images (paths under /public). Only real work belongs here: the UI
 * screens below are exported from the Figma case studies. Pencil art or
 * photographs can be added with category 'Sketching' / 'Photography' once
 * real files exist — nothing is shown for a category without images.
 */
export interface GalleryItem {
  id: string
  image: string
  caption: string
  category: 'UI/UX work' | 'Sketching' | 'Photography'
  /** project id, when the image belongs to a case study */
  project?: string
}

// filled from the project screens so the gallery and case studies never disagree
export const GALLERY: GalleryItem[] = PROJECT_CONTENT.flatMap((p) =>
  p.screens.map((s, i) => ({ id: `${p.id}-${i}`, image: s.image, caption: `${p.title} · ${s.caption}`, category: 'UI/UX work' as const, project: p.id })),
)

// ── Education building ─────────────────────────────────────────────────────
const educationItems = (): ContentItem[] =>
  EDUCATION.map((e) => P(`${e.short} ${e.field} · ${e.years}`, `${e.institution}, ${e.place} · CGPA ${e.cgpa}`))

export const EDUCATION_STORIES: Record<string, StoryContent> = {
  timeline: {
    kicker: 'Education', heading: 'Computer Science',
    body: 'Master’s and bachelor’s degrees in Computer Science, Kadapa.',
    items: educationItems(),
  },
  certificates: {
    kicker: 'Certification', heading: CERTIFICATION.title,
    body: `${CERTIFICATION.issuer} · ${CERTIFICATION.year}`,
  },
}

// ── NFC Solutions (workplace) ──────────────────────────────────────────────
export const OFFICE_STORIES: Record<string, StoryContent> = {
  reception: {
    kicker: 'My professional world', heading: 'NFC Solutions',
    body: EXPERIENCE.summary,
    items: [P(EXPERIENCE.title, `${EXPERIENCE.company} · ${EXPERIENCE.location}`), P('Since', EXPERIENCE.dates)],
  },
  workspace: {
    kicker: 'My role', heading: EXPERIENCE.title,
    body: `${EXPERIENCE.dates} · ${EXPERIENCE.company}`,
    items: [P('Focus areas', EXPERIENCE.focus.join(' · '))],
  },
  meeting: {
    kicker: 'Collaboration', heading: 'Designing with product & engineering',
    body: 'I work on real digital products with product and engineering teams — from requirements and research through prototyping and developer handoff.',
  },
  designWall: {
    kicker: 'Design practice', heading: 'From requirements to UI',
    body: 'Research, information architecture, user flows, wireframes and prototypes — then design systems and handoff.',
    cta: { label: 'See the Project Studio', action: 'projects' },
  },
}

// ── Home / profile ─────────────────────────────────────────────────────────
export const HOME_STORIES: Record<string, StoryContent> = {
  hello: {
    kicker: 'About me', heading: `Hi, I’m ${PROFILE.name}.`,
    body: `${PROFILE.about} ${PROFILE.craft}`,
    items: [P('Role', PROFILE.role), P('Experience', PROFILE.experience), P('Location', PROFILE.location)],
  },
  desk: {
    kicker: 'Experience', heading: EXPERIENCE.title,
    body: EXPERIENCE.summary,
    items: [P(EXPERIENCE.company, `${EXPERIENCE.location} · ${EXPERIENCE.dates}`)],
  },
  laptop: {
    kicker: 'Tools', heading: 'Tools I work with',
    body: 'Design and prototyping first, with front-end awareness for developer collaboration.',
    items: [P('Tools', TOOLS.join(' · ')), P('Front-end', 'HTML5 · CSS3')],
  },
  skills: {
    kicker: 'Skills', heading: 'What I work with',
    body: 'UX, UI, systems and delivery — and the tools behind them.',
    items: SKILL_GROUPS.map((g) => P(g.group, g.items.join(' · '))),
  },
  aiWorkflow: AI_STORY,
  galleryEntry: {
    kicker: 'Gallery', heading: 'Selected work & interests',
    body: 'UI screens from my case studies, and what I enjoy outside product design.',
    cta: { label: 'Go to the Design Journey', action: 'gallery' },
  },
  portfolio: {
    kicker: 'Selected work', heading: 'Projects',
    body: 'The case studies live in the Project Studio, inside the NFC Solutions office.',
    cta: { label: 'Go to the Project Studio', action: 'projects' },
  },
  window: {
    kicker: 'Outside product design', heading: 'Interests',
    body: INTERESTS.join(' · '),
  },
  contact: {
    kicker: 'Contact', heading: 'Let’s talk',
    body: `${PROFILE.fullName} · ${PROFILE.location}`,
    items: [P('Email', CONTACT.email), P('Phone', CONTACT.phone)],
    cta: { label: 'Contact', action: 'contact' },
  },
}

// ── Gallery park: interests ─────────────────────────────────────────────────
export const ACTIVITY_STORIES: Record<'sketching' | 'cricketDance', StoryContent> = {
  sketching: { kicker: 'Outside product design', heading: 'Pencil Art & Sketching', body: 'One of my interests outside product design.' },
  cricketDance: { kicker: 'Outside product design', heading: 'Cricket & Dance', body: 'What I enjoy when I’m away from the desk.' },
}

// ── AI guide: answers to common questions ──────────────────────────────────
/**
 * Questions the companion answers before travelling somewhere. `words` is a
 * lowercase regex source; `go` is a world stop id (data/world.ts).
 */
export const GUIDE_ANSWERS: { words: string; answer: string; go: 'home' | 'education' | 'nfcSolutions' | 'projects' | 'gallery' | 'contactCafe' }[] = [
  {
    words: '\\b(how|why)\\b.*\\b(use|uses|using)\\b.*\\bai\\b|\\bai\\b.*\\b(workflow|process|role)\\b|\\bai tools?\\b',
    answer: `AI helps ${PROFILE.name} explore ideas, research directions, content, prototypes and alternatives faster — with tools like ${AI_TOOLS.join(', ')}. He remains responsible for UX judgment, prioritization and final design decisions.`,
    go: 'gallery',
  },
  {
    words: '\\b(tools?|software|figma|stack)\\b',
    answer: `His workflow includes ${TOOLS.slice(0, -1).join(', ')} and ${TOOLS[TOOLS.length - 1]}, with HTML/CSS knowledge for developer collaboration.`,
    go: 'home',
  },
  {
    words: '\\b(skills?|good at|expertise|speciali[sz]\\w*)\\b',
    answer: `${PROFILE.name} works across UX research, information architecture, user flows, wireframing, prototyping, UI design, design systems, accessibility and developer handoff.`,
    go: 'home',
  },
  {
    words: '\\b(stud(y|ied|ies)|education|degrees?|college|qualifications?|certificat\\w*)\\b',
    answer: `${PROFILE.name} holds an M.Sc. in Computer Science (${EDUCATION[0].years}, ${EDUCATION[0].institution}, ${EDUCATION[0].place}) and a B.Sc. in Computer Science (${EDUCATION[1].years}). He is a ${CERTIFICATION.title}, ${CERTIFICATION.issuer}, ${CERTIFICATION.year}.`,
    go: 'education',
  },
  {
    words: '\\b(experience|work(s|ed)? at|job|company|employer|career)\\b',
    answer: `${PROFILE.name} has been a ${EXPERIENCE.title} at ${EXPERIENCE.company}, ${EXPERIENCE.location}, since May 2022 — owning UX and UI for enterprise, healthcare and service-industry products.`,
    go: 'nfcSolutions',
  },
  {
    words: '\\b(contact|reach|email|phone|call|hire)\\b',
    answer: `You can email ${PROFILE.name} at ${CONTACT.email} or call ${CONTACT.phone}. Let’s head to the Contact Café.`,
    go: 'contactCafe',
  },
  {
    words: '\\b(hobb(y|ies)|interests?|free time|sketch\\w*|cricket|dance)\\b',
    answer: `Outside product design, ${PROFILE.name} enjoys ${INTERESTS.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`,
    go: 'gallery',
  },
  {
    words: '\\b(what does|who is|who\'?s|tell me about)\\b.*\\b(naveen|he|him)\\b|\\babout (naveen|him)\\b',
    answer: `${PROFILE.name} is a UI/UX and Product Designer with ${PROFILE.experience} of experience designing web and mobile products across enterprise SaaS, healthcare, recruitment and service platforms.`,
    go: 'home',
  },
]

export function matchAnswer(text: string) {
  const t = text.toLowerCase()
  return GUIDE_ANSWERS.find((a) => new RegExp(a.words).test(t)) ?? null
}
