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
  /** the Home introduction (visitor-facing) */
  intro: 'I’m Naveen, a UI/UX Designer with 4+ years of experience creating intuitive digital experiences across web applications, mobile products, enterprise systems and interactive experiences.',
  craft: 'I combine user-centered thinking, visual design, prototyping, design systems and technology to turn complex problems into clear, usable experiences.',
  ai: 'Today, I also use AI as a design partner to explore ideas, accelerate experimentation and expand what I can create — while keeping human judgment at the center of every design decision.',
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
/** the five plaques on the timeline wall — storytelling, not academic claims */
export const EDUCATION_TIMELINE: ContentItem[] = [
  P('Learn', 'Fundamentals, technology and creative exploration.'),
  P('Experiment', 'Small ideas become practical design exercises.'),
  P('Discover', 'Good design isn’t only about how something looks — it’s about how it works and how people experience it.'),
  P('Grow', 'Moving from creating screens to understanding problems, users, systems and interactions.'),
  P('Continue', 'Design is never finished. There is always something new to learn, test and explore.'),
]

export const EDUCATION_STORIES: Record<string, StoryContent> = {
  timeline: {
    kicker: 'Where it started', heading: 'Where the journey started',
    body: 'Every designer has a beginning. Before designing products for real users, there was a stage of learning, experimenting, making mistakes and discovering how technology and creativity could come together.',
    items: EDUCATION_TIMELINE,
  },
  classroom: {
    kicker: 'The classroom board', heading: 'What I learned',
    body: '[CONFIRM WHICH OF THESE YOU STUDIED — remove any that don’t apply]',
    items: [
      P('Design fundamentals', 'Visual hierarchy, layout and typography'),
      P('UX thinking', 'Designing for people and their goals'),
      P('Interaction', 'How things respond and feel'),
      P('Technology & problem solving', 'Understanding how things are built'),
    ],
  },
  book: {
    kicker: 'My education', heading: 'My education',
    body: 'The formal part of the story.',
    items: [
      P('Qualification', '[ADD DEGREE / DIPLOMA]'),
      P('Institution', '[ADD INSTITUTION]'),
      P('Years', '[ADD YEARS]'),
    ],
  },
  certificates: {
    kicker: 'Certifications', heading: 'Certificates & courses',
    body: 'Only real certificates go on this wall.',
    items: [P('Certificate', '[ADD CERTIFICATION 1]'), P('Certificate', '[ADD CERTIFICATION 2]'), P('Certificate', '[ADD CERTIFICATION 3]')],
  },
  growth: {
    kicker: 'Keep learning', heading: 'Keep learning',
    body: 'The tools change. The fundamentals continue to evolve.',
    items: [P('Currently learning', '[ADD WHAT YOU ARE LEARNING NOW]')],
  },
}

// ── NFC Solutions (workplace) ───────────────────────────────────────────────
export const OFFICE_STORIES: Record<string, StoryContent> = {
  reception: {
    kicker: 'My professional world', heading: 'NFC Solutions',
    body: 'This is where design moves from ideas to real products. At NFC Solutions, I work as part of a collaborative environment where design, product and technology come together to solve real problems and create usable digital experiences.',
    items: [
      P('Collaboration', 'Design + Product + Engineering. Great products are rarely created by one person — they grow through conversations, reviews, iterations and collaboration.'),
      P('Real products', 'Understanding requirements, balancing user needs, working within technical constraints and continuously refining the experience.'),
    ],
  },
  workspace: {
    kicker: 'My role', heading: 'UI/UX Designer',
    body: 'I work across the design process — from understanding problems and exploring ideas to creating interfaces, prototypes, systems and interactive experiences.',
    items: [
      P('Focus areas', 'UX thinking · UI design · user flows · wireframes · prototypes · design systems · interaction design · responsive design · AI-assisted exploration · collaboration with development'),
      P('Since', '[ADD START DATE AT NFC SOLUTIONS]'),
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
    kicker: 'Who I am', heading: 'Naveen · UI/UX Designer',
    body: `${PROFILE.intro} ${PROFILE.craft}`,
    items: [P('With AI', PROFILE.ai), P('Currently', `${PROFILE.role} at ${PROFILE.company}`), P('Based in', '[ADD LOCATION]')],
  },
  desk: {
    kicker: 'How I work', heading: 'Understand deeply, explore widely, decide with the user in mind.',
    body: 'My approach, in six steps:',
    items: [
      P('Understand', 'I start by understanding the problem, people and context.'),
      P('Explore', 'I explore multiple possibilities instead of jumping immediately to one solution.'),
      P('Design', 'I turn insights into flows, structures, interfaces and systems.'),
      P('Prototype', 'I make ideas interactive enough to experience and evaluate.'),
      P('Test', 'I look for confusion, friction and opportunities to improve.'),
      P('Refine', 'I iterate until the experience becomes clearer and more useful.'),
      P('With AI', 'AI helps me explore. I make the design decisions.'),
    ],
  },
  laptop: {
    kicker: 'My design tools', heading: 'Tools I work with',
    body: 'Design first, with enough code and AI to explore, prototype and collaborate well.',
    items: [
      P('Design', 'Figma · Framer'),
      P('AI', 'Claude · ChatGPT'),
      P('Code', 'HTML / CSS · JavaScript · React · Three.js'),
    ],
  },
  bookshelf: {
    kicker: 'Things I learn from', heading: 'The bookshelf',
    body: '[ADD BOOKS, BLOGS OR PEOPLE THAT SHAPE YOUR THINKING]',
  },
  journey: {
    kicker: 'Career journey', heading: `${PROFILE.experience} in design`,
    body: '[ADD YOUR CAREER-START STORY]',
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
    body: 'Walk along the wall — each tile is a tool or a practice.',
    items: [
      P('Figma', 'UI design, prototyping and design systems'),
      P('Claude', 'AI-assisted exploration, ideation and design workflows'),
      P('ChatGPT', 'Research, ideation, content exploration and problem solving'),
      P('Framer', 'Interactive prototypes and motion'),
      P('HTML / CSS', 'Understanding implementation constraints and collaborating with developers'),
      P('JavaScript · React', 'Interaction logic, and component thinking that mirrors design systems'),
      P('Three.js', 'Interactive 3D experiences — like this portfolio'),
      P('Practice', 'Design systems · UX research · wireframing · prototyping · interaction design · responsive design · AI-assisted design'),
    ],
  },
  approach: {
    kicker: 'How I work', heading: 'Understand deeply, explore widely, decide with the user in mind.',
    body: 'The full process is the nine-step Design Journey trail.',
    items: [P('With AI', 'AI helps me explore. I make the design decisions.')],
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

export const AI_WORKFLOW = ['Human problem', 'AI exploration', 'Ideas & possibilities', 'Human evaluation', 'Design', 'Prototype', 'Test', 'Refine', 'Final experience']
/** steps where the human decides (highlighted on the AI ring) */
export const AI_HUMAN_STEPS = new Set(['Human problem', 'Human evaluation', 'Design', 'Final experience'])

export const AI_STORY: StoryContent = {
  kicker: 'How AI changed my workflow', heading: 'AI is my design partner',
  body: 'I don’t use AI to replace design thinking. I use it to expand design thinking.',
  items: [
    P('How', 'I use AI to explore more possibilities, challenge my first ideas, accelerate repetitive work and experiment with new ways of designing.'),
    P('But', 'The final decisions still come from understanding people, context, product goals and usability.'),
    P('AI assists with', 'Research exploration · ideation · variations · content · prototyping · iteration · code collaboration'),
    P('I stay responsible for', 'Empathy · context · judgment · prioritisation · product thinking · UX decisions · validation'),
  ],
}

export const ACTIVITY_STORIES: Record<string, StoryContent> = {
  learning: { kicker: 'Beyond the screen · Learning', heading: 'Learning', body: 'Staying curious and continuously exploring new ideas, tools and approaches.' },
  visual: { kicker: 'Beyond the screen · Visual exploration', heading: 'Visual exploration', body: 'Looking at interfaces, products, environments and everyday experiences to understand what makes them work.' },
  uiux: { kicker: 'Beyond the screen · UI/UX', heading: 'UI/UX', body: 'Creating clear hierarchy, honest interactions and accessible experiences.' },
  interactive: { kicker: 'Beyond the screen · Interactive design', heading: 'Interactive design', body: 'Exploring spatial and interactive experiences — including this portfolio itself.' },
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
