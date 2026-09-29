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
    body: 'The full case studies live in the Project District.',
    cta: { label: 'Open projects', action: 'projects' },
  },
  window: {
    kicker: 'Looking ahead', heading: 'What’s next',
    body: '[ADD WHAT YOU WANT TO DO NEXT]',
    items: [P('Interests', '[ADD INTERESTS]')],
  },
  contact: {
    kicker: 'Contact', heading: 'Let’s talk',
    body: 'Open to conversations about design, products and interactive experiences.',
    items: [P('Email', '[ADD EMAIL]'), P('LinkedIn', '[ADD LINKEDIN]')],
    cta: { label: 'Contact', action: 'contact' },
  },
}

// ── Design Park: process trail, AI workflow, activities ────────────────────
export const DESIGN_PROCESS: { n: string; title: string; text: string }[] = [
  { n: '01', title: 'Understand', text: 'Start with people, context and the real problem.' },
  { n: '02', title: 'Research', text: 'Listen, observe and gather evidence.' },
  { n: '03', title: 'Explore', text: 'Many ideas before one answer.' },
  { n: '04', title: 'Define', text: 'Frame the problem and what success means.' },
  { n: '05', title: 'Design', text: 'Flows, layouts and systems that fit.' },
  { n: '06', title: 'Prototype', text: 'Make it real enough to learn from.' },
  { n: '07', title: 'Test', text: 'Put it in front of users, early.' },
  { n: '08', title: 'Refine', text: 'Iterate on what we learned.' },
  { n: '09', title: 'Deliver', text: 'Ship with care, then keep improving.' },
]

export const AI_WORKFLOW = ['Human problem', 'AI exploration', 'Ideas', 'Human evaluation', 'Design', 'Prototype', 'Test', 'Refine']

export const AI_STORY: StoryContent = {
  kicker: 'AI-assisted design', heading: 'AI is my design partner',
  body: 'AI helps me explore faster. I stay the decision-maker.',
  items: [
    P('AI assists with', 'Research exploration · ideation · variations · content · prototyping · iteration · code collaboration'),
    P('I stay responsible for', 'Empathy · context · judgment · prioritisation · product thinking · UX decisions · validation'),
  ],
}

export const ACTIVITY_STORIES: Record<string, StoryContent> = {
  learning: { kicker: 'Activity · Learning', heading: 'Always reading', body: '[ADD HOW YOU KEEP LEARNING]' },
  visual: { kicker: 'Activity · Visual exploration', heading: 'Looking closely', body: '[ADD YOUR VISUAL / CREATIVE INTERESTS]' },
  uiux: { kicker: 'Activity · UI/UX design', heading: 'Designing interfaces', body: 'Clear hierarchy, honest interactions and accessible defaults.' },
  interactive: { kicker: 'Activity · Interactive design', heading: 'Designing in 3D', body: 'Exploring interactive and spatial experiences — like this neighbourhood.' },
}
