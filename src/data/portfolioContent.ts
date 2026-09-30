/**
 * Portfolio content — everything the world "says" about Naveen lives here.
 *
 * Only facts already provided are stated (name, role, 4+ years, NFC
 * Solutions). Everything else is a clearly marked placeholder in [BRACKETS]
 * to be replaced with real details. Keep entries short: the world shows them
 * on boards, plaques and small cards, not as long pages.
 */
export interface ContentItem {
  label: string
  text: string
  placeholder?: boolean
}

export interface StoryContent {
  heading: string
  kicker: string
  body: string
  items?: ContentItem[]
  /** optional call to action handled by the panel */
  cta?: { label: string; action: 'projects' | 'contact' }
}

const P = (label: string, text: string): ContentItem => ({ label, text, placeholder: /\[.*\]/.test(text) })

export const PROFILE = {
  name: 'Naveen',
  role: 'UI/UX Designer',
  experience: '4+ years experience',
  company: 'NFC Solutions',
  tagline: 'Designing human experiences with technology and AI.',
}

/**
 * Contact links. Replace each placeholder with the real value; any entry that
 * is still a [PLACEHOLDER] is shown as "coming soon" instead of a broken link.
 */
export const CONTACT = {
  phone: '[ADD PHONE]',
  email: '[ADD EMAIL]',
  linkedin: '[ADD LINKEDIN URL]',
  resume: '[ADD RESUME URL]',
  portfolio: '[ADD PORTFOLIO URL]',
}

// ── Education ───────────────────────────────────────────────────────────────
export const EDUCATION_TIMELINE: ContentItem[] = [
  P('Academic background', '[ADD EDUCATION DETAILS — degree, institution, years]'),
  P('Design foundations', '[ADD HOW YOU STARTED IN DESIGN]'),
  P('Technology & tools', '[ADD KEY TOOLS / TECHNOLOGIES LEARNED]'),
  P('Certifications', '[ADD CERTIFICATIONS]'),
  P('Continuous learning', '[ADD COURSES, COMMUNITIES OR SELF-STUDY]'),
]

export const EDUCATION_STORIES: Record<string, StoryContent> = {
  timeline: {
    kicker: 'Learning journey', heading: 'How I got here',
    body: 'Walk along the wall — each plaque is a step in my learning journey.',
    items: EDUCATION_TIMELINE,
  },
  classroom: {
    kicker: 'Design foundations', heading: 'What the classroom taught me',
    body: 'Fundamentals that still shape every design decision.',
    items: [
      P('Principles', '[ADD DESIGN PRINCIPLES YOU LEARNED — e.g. hierarchy, usability]'),
      P('Methods', '[ADD RESEARCH / UX METHODS YOU STUDIED]'),
      P('Practice', '[ADD STUDENT PROJECTS OR EXERCISES]'),
    ],
  },
  book: {
    kicker: 'Academic background', heading: 'My education',
    body: '[ADD EDUCATION DETAILS]',
    items: [
      P('Qualification', '[ADD DEGREE / DIPLOMA]'),
      P('Institution', '[ADD INSTITUTION]'),
      P('Years', '[ADD YEARS]'),
    ],
  },
  certificates: {
    kicker: 'Certifications', heading: 'Certificates & courses',
    body: 'Recognition along the way.',
    items: [P('Certificate', '[ADD CERTIFICATION 1]'), P('Certificate', '[ADD CERTIFICATION 2]'), P('Certificate', '[ADD CERTIFICATION 3]')],
  },
  growth: {
    kicker: 'Continuous learning', heading: 'Still learning, every week',
    body: 'Design moves fast. I keep up through practice, reading and experiments.',
    items: [P('Currently learning', '[ADD WHAT YOU ARE LEARNING NOW]')],
  },
}

// ── NFC Solutions (workplace) ───────────────────────────────────────────────
export const OFFICE_STORIES: Record<string, StoryContent> = {
  reception: {
    kicker: 'My workplace', heading: 'NFC Solutions',
    body: 'Where I design every day, as part of a team working across product and technology.',
    items: [
      P('Collaborative teams', 'Design, product and engineering working side by side.'),
      P('Real projects', 'Learning through real products and real users.'),
      P('Better experiences', 'Turning ideas into usable digital experiences.'),
    ],
  },
  workspace: {
    kicker: 'My role', heading: `${PROFILE.role} · ${PROFILE.experience}`,
    body: '[ADD EXPERIENCE DETAILS — your role and responsibilities at NFC Solutions]',
    items: [
      P('Role', '[ADD ROLE TITLE & START DATE]'),
      P('Focus', '[ADD PRODUCTS / AREAS YOU WORK ON]'),
      P('Impact', '[ADD WHAT YOU CONTRIBUTE]'),
    ],
  },
  meeting: {
    kicker: 'Collaboration', heading: 'Designing together',
    body: 'Good products come from good conversations: reviews, critiques and shared decisions.',
    items: [
      P('With product', 'Framing problems and priorities.'),
      P('With engineering', 'Designing for what can be built well.'),
      P('With users', 'Validating ideas before they ship.'),
    ],
  },
  designWall: {
    kicker: 'Design practice', heading: 'Designing better digital experiences',
    body: 'Sketches, flows and prototypes on the wall — the messy middle of good design.',
    items: [P('Process', 'Explore widely, decide carefully, refine relentlessly.')],
  },
}

// ── Home / profile ─────────────────────────────────────────────────────────
export const HOME_STORIES: Record<string, StoryContent> = {
  hello: {
    kicker: 'About me', heading: `Hi, I’m ${PROFILE.name}`,
    body: `${PROFILE.role} with ${PROFILE.experience}. I design clear, human products — and increasingly, interactive experiences like this one.`,
    items: [P('Currently', `Designing at ${PROFILE.company}`), P('Based in', '[ADD LOCATION]')],
  },
  desk: {
    kicker: 'My workspace', heading: 'Where the thinking happens',
    body: 'Design approach: understand deeply, explore widely, decide with the user in mind.',
    items: [
      P('Product design', 'End-to-end flows from problem to polished UI.'),
      P('Design systems', 'Reusable components and consistent patterns.'),
      P('Prototyping', 'Interactive prototypes to test ideas early.'),
    ],
  },
  laptop: {
    kicker: 'My design tools', heading: 'Tools I work with',
    body: '[ADD YOUR DESIGN TOOLS]',
    items: [P('Design', '[ADD TOOLS — e.g. your primary design tool]'), P('Prototyping', '[ADD TOOLS]'), P('AI-assisted', '[ADD AI TOOLS YOU USE]')],
  },
  bookshelf: {
    kicker: 'Things I learn from', heading: 'The bookshelf',
    body: '[ADD BOOKS, BLOGS OR PEOPLE THAT SHAPE YOUR THINKING]',
  },
  journey: {
    kicker: 'Career journey', heading: `${PROFILE.experience} in design`,
    body: '[ADD CAREER JOURNEY DETAILS]',
    items: [P('Now', `${PROFILE.role} · ${PROFILE.company}`), P('Before', '[ADD EARLIER EXPERIENCE]')],
  },
  portfolio: {
    kicker: 'Selected work', heading: 'Work I’m proud of',
    body: 'The full case studies live in the Project Studio, inside the NFC Solutions office.',
    cta: { label: 'Go to the Project Studio', action: 'projects' },
  },
  window: {
    kicker: 'Looking ahead', heading: 'What’s next',
    body: '[ADD WHAT YOU WANT TO DO NEXT]',
    items: [P('Interests', '[ADD INTERESTS]')],
  },
  contact: {
    kicker: 'Contact', heading: 'Let’s talk',
    body: 'Open to conversations about design, products and interactive experiences.',
    items: [P('Email', CONTACT.email), P('LinkedIn', CONTACT.linkedin)],
    cta: { label: 'Contact', action: 'contact' },
  },
  skills: {
    kicker: 'Tools & skills', heading: 'What I work with',
    body: 'Design first, with enough code and AI to explore, prototype and collaborate well.',
    items: [
      P('Figma', 'UI design, prototyping and design systems'),
      P('Claude · ChatGPT', 'AI-assisted exploration, research, ideation and problem solving'),
      P('HTML · CSS · JS · React', 'Understanding implementation and collaborating with developers'),
      P('Three.js', 'Interactive 3D experiences — like this portfolio'),
      P('Practice', 'UX research · wireframing · prototyping · interaction design · responsive design · design systems'),
    ],
  },
  approach: {
    kicker: 'Design approach', heading: 'How I approach a problem',
    body: '[ADD YOUR DESIGN APPROACH IN A SENTENCE OR TWO]',
    items: [P('My process', 'Nine steps, from Understand to Deliver — walk the Design Journey trail.'), P('With AI', 'AI helps me explore. I make the design decisions.')],
  },
}

// ── Design Park: process trail, AI workflow, activities ────────────────────
export const DESIGN_PROCESS: { n: string; title: string; text: string }[] = [
  { n: '01', title: 'Understand', text: 'Start with people, context and the real problem.' },
  { n: '02', title: 'Research', text: 'Listen, observe and gather evidence.' },
  { n: '03', title: 'Explore', text: 'Many ideas before one answer.' },
  { n: '04', title: 'Ideate', text: 'Sketch widely, then choose with the user in mind.' },
  { n: '05', title: 'Design', text: 'Flows, layouts and systems that fit.' },
  { n: '06', title: 'Prototype', text: 'Make it real enough to learn from.' },
  { n: '07', title: 'Test', text: 'Put it in front of users, early.' },
  { n: '08', title: 'Refine', text: 'Iterate on what we learned.' },
  { n: '09', title: 'Final experience', text: 'Ship with care, then keep improving.' },
]

export const AI_WORKFLOW = ['Understand', 'Explore', 'AI assistance', 'Human evaluation', 'Design', 'Prototype', 'Test', 'Refine']
/** steps where the human decides (highlighted on the AI ring) */
export const AI_HUMAN_STEPS = new Set(['Understand', 'Human evaluation', 'Design', 'Refine'])

export const AI_STORY: StoryContent = {
  kicker: 'AI-assisted design', heading: 'AI is my design partner',
  body: 'AI helps me explore. I make the design decisions.',
  items: [
    P('AI assists with', 'Research exploration · ideation · variations · content · prototyping · iteration · code collaboration'),
    P('I stay responsible for', 'Empathy · context · judgment · prioritisation · product thinking · UX decisions · validation'),
    P('The flow', 'Human problem → AI exploration → ideas → human judgment → design → prototype → test → refine → final experience'),
  ],
}

export const ACTIVITY_STORIES: Record<string, StoryContent> = {
  learning: { kicker: 'Activity · Learning', heading: 'Always reading', body: '[ADD HOW YOU KEEP LEARNING]' },
  visual: { kicker: 'Activity · Visual exploration', heading: 'Looking closely', body: '[ADD YOUR VISUAL / CREATIVE INTERESTS]' },
  uiux: { kicker: 'Activity · UI/UX design', heading: 'Designing interfaces', body: 'Clear hierarchy, honest interactions and accessible defaults.' },
  interactive: { kicker: 'Activity · Interactive design', heading: 'Designing in 3D', body: 'Exploring interactive and spatial experiences — like this neighbourhood.' },
}

// ── Tools & skills (Home · skill wall) ─────────────────────────────────────
/**
 * The tools and practices on the Home skill wall. Keep only what you really
 * use; each note is one line. Order = wall order (left → right, top → bottom).
 */
export const TOOLS: { name: string; note: string; group: 'tool' | 'practice' | 'code' }[] = [
  { name: 'Figma', note: 'UI design, prototyping and design systems', group: 'tool' },
  { name: 'Claude', note: 'AI-assisted exploration, ideation and design workflows', group: 'tool' },
  { name: 'ChatGPT', note: 'Research, ideation, content exploration and problem solving', group: 'tool' },
  { name: 'Framer', note: 'Interactive prototypes and motion', group: 'tool' },
  { name: 'HTML / CSS', note: 'Understanding implementation constraints and collaborating with developers', group: 'code' },
  { name: 'JavaScript', note: 'Interaction logic behind prototypes', group: 'code' },
  { name: 'React', note: 'Component thinking that mirrors design systems', group: 'code' },
  { name: 'Three.js', note: 'Interactive 3D experiences — like this portfolio', group: 'code' },
  { name: 'Design Systems', note: 'Reusable components and consistent patterns', group: 'practice' },
  { name: 'UX Research', note: 'Understanding people before designing for them', group: 'practice' },
  { name: 'Wireframing', note: 'Structure and flow before visuals', group: 'practice' },
  { name: 'Prototyping', note: 'Making ideas real enough to test', group: 'practice' },
  { name: 'Interaction Design', note: 'How things respond, move and feel', group: 'practice' },
  { name: 'Responsive Design', note: 'Layouts that work on every screen', group: 'practice' },
  { name: 'AI-assisted Design', note: 'AI explores possibilities; human judgment decides', group: 'practice' },
]

// ── Career transformation (the Growth Walk, campus → NFC Solutions) ───────
/**
 * Eight stations along the avenue from the Education campus to NFC Solutions.
 * The stage names follow the journey Naveen described; replace the
 * [ADD …] lines with real specifics (years, first tools, milestones).
 */
export const CAREER_STAGES: { n: string; title: string; line: string; detail: string }[] = [
  { n: '01', title: 'Early design', line: 'Simple sketches and first layouts.', detail: '[ADD HOW YOUR DESIGN JOURNEY BEGAN]' },
  { n: '02', title: 'First UI', line: 'Basic screens — learning what works.', detail: '[ADD YOUR FIRST UI WORK]' },
  { n: '03', title: 'UX thinking', line: 'Understanding users, not just screens.', detail: '[ADD WHEN UX THINKING CLICKED FOR YOU]' },
  { n: '04', title: 'Systems', line: 'Components, patterns and design systems.', detail: '[ADD DESIGN SYSTEM EXPERIENCE]' },
  { n: '05', title: 'Real products', line: 'Designing applications people use.', detail: `[ADD PRODUCT WORK — e.g. at ${PROFILE.company}]` },
  { n: '06', title: 'Interaction', line: 'Prototypes, motion and interactive experiences.', detail: '[ADD INTERACTION / PROTOTYPING MILESTONES]' },
  { n: '07', title: 'AI-assisted design', line: 'AI explores possibilities; I make the decisions.', detail: '[ADD HOW AI CHANGED YOUR WORKFLOW]' },
  { n: '08', title: 'Today', line: 'A professional UI/UX designer.', detail: `${PROFILE.role} · ${PROFILE.experience} · ${PROFILE.company}` },
]
