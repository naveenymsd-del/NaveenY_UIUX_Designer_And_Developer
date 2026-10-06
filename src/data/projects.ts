/**
 * Projects — the single source of truth for every place a project appears:
 * the Project Studio screens inside Naveen Solutions, the case-study
 * presentation, the menu, the AI guide and the /projects overview (street
 * pavilions).
 *
 * Only projects with a verified Figma prototype belong here. Each one is an
 * Overview and a set of Challenges written from the prototype itself, plus
 * the prototype link shown next to the title. Appending an entry creates its
 * studio bay, screen, interaction, pavilion and case study automatically.
 */
export interface ProjectChallenge {
  title: string
  description: string
}

export interface ProjectContent {
  id: string
  title: string
  /** e.g. "Ticket & Project Tracking · Web App" */
  category: string
  /** one line, shown under the title */
  description: string
  /** only when confirmed */
  role?: string
  year?: string
  tools?: string[]
  /** a few short paragraphs */
  overview: string[]
  challenges: ProjectChallenge[]
  /** the exact Figma prototype URL */
  prototypeUrl: string
  /** extra words the AI guide accepts for this project */
  aliases?: string[]
  /** colour used on the studio screen and in the presentation */
  accent: string
}

export interface ProjectDef extends ProjectContent {
  number: string
  color: number
  /** pavilion ground position (street / projects overview) */
  position: [number, number, number]
  yaw: number
  camera: { position: [number, number, number]; target: [number, number, number] }
}

export const PROJECT_CONTENT: ProjectContent[] = [
  {
    id: 'task',
    title: 'TASK',
    category: 'Ticket & Project Tracking · Web App',
    description: 'A redesign of the ticketing tool NFC Solutions uses to log, assign and track work across its projects.',
    overview: [
      'TASK is the internal ticketing and project-tracking tool at NFC Solutions. Team members use it to raise tickets, see what is assigned to them and follow work through to resolution across several company projects.',
      'The prototype covers two roles. A user signs in to a personal dashboard: open, in-progress, due-soon and resolved counts, a “My Work” ticket table, milestone progress, an activity trend and upcoming deadlines. An administrator gets the same structure at team level, with total, resolved and closed counts and a ticket-status overview.',
      'From the dashboards the flows go into detail — a ticket list with search, quick filters, saved views, column settings and bulk actions; a ticket page with assignment, dates, tags, notes, activity, related tickets, history, attachments and followers; milestones with progress, burndown and Gantt views; and account and preference settings.',
      'Several screens exist in the file as an earlier version and a “redesign”, built on a shared component set (buttons, inputs, badges, tables, tabs, sidebar items) and colour, typography and spacing foundations.',
    ],
    challenges: [
      {
        title: 'Many ticket attributes in one row',
        description: 'Every ticket carries an ID, summary, project, status, priority, due date and assignee. Status, priority and due dates are colour-coded badges so a row can be read without opening the ticket.',
      },
      {
        title: 'Many ways to slice the same work',
        description: 'Assigned, Unassigned, Reported by Me, Resolved, Recently Modified and Followed by Me are views over one table. The ticket list adds search, quick filters, saved views and adjustable columns so a long list can be narrowed without losing your place.',
      },
      {
        title: 'A dense ticket page',
        description: 'Description, people, dates, estimates, properties, attachments, related tickets, followers and history all live on one ticket. They are split into a main column, tabs (Notes, Activities, Related Tickets, History) and a side panel with quick actions — clone, sub-ticket, move, delete.',
      },
      {
        title: 'Milestone progress at a glance',
        description: 'A milestone opens on its progress, open and closed ticket counts, timeline and due status, with burndown and Gantt views one tab away for anyone who needs the detail.',
      },
      {
        title: 'Two roles, one structure',
        description: 'User and administrator dashboards share the same layout and components but differ in scope — personal work versus the whole team’s ticket flow.',
      },
      {
        title: 'Designing the states, not just the screens',
        description: 'Profile and preferences are designed through editing, unsaved changes, validation errors, save success and reset confirmation, alongside empty states, a delete confirmation and a mobile preferences layout.',
      },
    ],
    prototypeUrl:
      'https://www.figma.com/proto/vUIgk3l5i7TXJwCPXHq7xu/TASK-UI?node-id=152-19286&viewport=1484%2C-2898%2C0.11&t=SplDLtshCgBKTxhy-1&scaling=scale-down-width&content-scaling=fixed&starting-point-node-id=152%3A19286&page-id=0%3A1',
    accent: '#d9881a',
  },
  {
    id: 'kidpool',
    title: 'KidPool',
    category: 'School Carpooling · Mobile App',
    description: 'A mobile app for parents at the same school to ask for and give school rides, with verification and school check-in built into every ride.',
    overview: [
      'KidPool is a carpooling app for school families. Verified parents near the same school ask each other for rides and offer seats, and the school is told who is bringing each child and checks them in on arrival.',
      'The prototype follows one parent, Sarah, through a complete journey: signing up with her phone number, getting verified — photo ID, selfie match, driving record, background check and vehicle details — adding her child and joining her school’s circle of verified parents.',
      'She then asks for a ride, reviews the request, waits while nearby parents are notified, approves the parent who offers and follows the ride with live tracking until her daughter is checked in at school. The second half reverses the roles: Sarah gives a ride to another family, with a pickup checklist, a school pass for the drop-off line and a ride summary.',
      'Supporting screens cover ride history, notifications, a weekly schedule, a school community feed, a profile with parental controls, an SOS screen and an animated intro. Sign-up also offers a school-staff role, but the prototype follows the parent experience.',
    ],
    challenges: [
      {
        title: 'Trust before the first ride',
        description: 'Parents are handing their children to other adults. Verification is broken into short steps with visible progress (“2 of 4 complete · ~5 min”), explains what is checked and how ID images are handled, and lets parents ask for rides while their background check is still pending.',
      },
      {
        title: 'Every parent plays both roles',
        description: 'Anyone can ask for a ride and give one. Home shows tomorrow’s ride next to requests from other families, and the giving flow — request, offer, approval, pickup, drive, drop-off — mirrors the asking flow so both feel familiar.',
      },
      {
        title: 'Keeping parents in control',
        description: 'The requesting parent approves the ride partner before anything is confirmed, seeing their rating, rides given, vehicle and booster seat. Profile controls set who can see requests and limit location sharing to rides only.',
      },
      {
        title: 'Coordinating three parties',
        description: 'Each ride involves the requesting parent, the driver and the school. The confirmation screen lays out every step — approved, school notified, pickup, check-in — and staff scan the driver’s ride pass at arrival.',
      },
      {
        title: 'What a driver needs at the curb',
        description: 'Child details (photo, clothing, booster, medical notes), a pickup checklist and a driving mode with voice-only alerts keep the essentials in view without pulling attention from the road.',
      },
      {
        title: 'Planning for emergencies',
        description: 'An SOS screen puts hold-to-call 911, alerts to both parents, live-location sharing and the child’s medical note on one screen.',
      },
    ],
    prototypeUrl:
      'https://www.figma.com/proto/UkougomRKZEjdNS0EC1Twf/CarPooling_For_Student?page-id=80%3A2&node-id=83-4852&starting-point-node-id=83%3A4852&scaling=scale-down&content-scaling=fixed&show-proto-sidebar=1',
    aliases: ['kid pool', 'carpool', 'carpooling'],
    accent: '#6f9a12',
  },
  {
    id: 'spyder',
    title: 'Spyder',
    category: 'Accounting Services Website · Design Assignment',
    description: 'A marketing website for an accounting firm serving startups and growing businesses, designed as a UI/UX assignment for GHC.',
    overview: [
      'Spyder is a website for an accounting and finance firm whose clients are startups and growing businesses. Its job is to explain four services — bookkeeping, tax, CFO services and R&D tax credits — and turn visitors into consultation requests.',
      'The design is a single long landing page: a hero with the core promise and a “Talk to an Expert” call to action, the kinds of businesses the firm works with, an expandable list of services, three reasons the firm is different, client testimonials, a featured case study, recent articles, a closing consultation banner and a footer with a newsletter sign-up.',
      'It was completed as a UI/UX designer assignment for GHC.',
    ],
    challenges: [
      {
        title: 'Making a dry service approachable',
        description: 'Accounting is abstract and text-heavy. The page leans on photography of people, short card copy and a confident blue-and-yellow palette so it reads as a service from people rather than a list of compliance tasks.',
      },
      {
        title: 'Four services without a wall of text',
        description: 'Bookkeeping, tax, CFO and R&D tax-credit services sit in an expandable list, so visitors scan the names first and open only the one they care about.',
      },
      {
        title: 'Letting visitors find themselves',
        description: '“Who we work with” cards for startups, retail, manufacturing and professional services come before the service detail, so each kind of business sees it is in the right place.',
      },
      {
        title: 'Building credibility in the right order',
        description: 'Proof — a regular-customer count, testimonials, a case study and articles — sits between the service explanation and the final call to action, where a visitor is deciding whether to get in touch.',
      },
      {
        title: 'One clear next step',
        description: '“Talk to an Expert” appears in the navigation, the hero and the closing banner, so the main action is in reach wherever a visitor is ready.',
      },
    ],
    prototypeUrl:
      'https://www.figma.com/proto/i852L2XjU3cEM6LpoRVOWN/UI-UX-Web-Designs?page-id=0%3A1&node-id=6-6031&viewport=-1230%2C107%2C0.13&t=veHL1rWqirIBKMHR-1&scaling=scale-down&content-scaling=fixed&starting-point-node-id=6%3A6031&show-proto-sidebar=1',
    aliases: ['ghc', 'accounting'],
    accent: '#2347b5',
  },
]

/**
 * Prototypes the connected Figma account can't open yet. They stay out of the
 * portfolio until their files are shared and the content is written from them.
 */
export const PENDING_PROJECTS: { id: string; title: string; prototypeUrl: string; reason: string }[] = [
  {
    id: 'calmscient',
    title: 'Calmscient',
    prototypeUrl:
      'https://www.figma.com/proto/8JRaJprIyCtDy7zfMsOuSs/UI-UX-MOBILE-DESIGNS?node-id=48-5821&viewport=1583%2C-1322%2C0.2&t=xXUuRp9uhQlCeCK1-1&scaling=scale-down&content-scaling=fixed&starting-point-node-id=48%3A5821&show-proto-sidebar=1&page-id=0%3A1',
    reason: 'Figma file not accessible to the connected account — share it, then write Overview and Challenges from the prototype.',
  },
  {
    id: 'inta',
    title: 'INTA',
    prototypeUrl:
      'https://www.figma.com/proto/QCaAaghXmnuMOjWVpdXSUB/INTADesign?node-id=17616-105510&viewport=27096%2C-7560%2C0.3&t=AvpwDXISkSBHOWm3-1&scaling=scale-down-width&content-scaling=fixed&starting-point-node-id=17616%3A105510&page-id=0%3A1',
    reason: 'Figma file not accessible to the connected account — share it, then write Overview and Challenges from the prototype.',
  },
]

export const PLAZA_CENTER: [number, number] = [19, -25]

/** pavilion lots around the plaza (the /projects overview); extra projects reuse lots */
const PAVILIONS: [number, number, number][] = [
  [12.5, 0.15, -37.5], [19, 0.15, -39.5], [25.5, 0.15, -37.5], [13, 0.15, -12.5], [25, 0.15, -12.5],
  [11.4, 0.15, -25], [26.6, 0.15, -25], [19, 0.15, -11],
]

export const PROJECTS: ProjectDef[] = PROJECT_CONTENT.map((c, i) => {
  const position = PAVILIONS[i % PAVILIONS.length]
  const dx = PLAZA_CENTER[0] - position[0]
  const dz = PLAZA_CENTER[1] - position[2]
  const yaw = Math.atan2(dx, dz)
  const len = Math.hypot(dx, dz)
  const nx = dx / len
  const nz = dz / len
  // Camera sits on the fountain side looking back at the pavilion, target
  // shifted to screen-right so the pavilion frames left of the panel.
  const right = { x: nz, z: -nx }
  return {
    ...c,
    number: String(i + 1).padStart(2, '0'),
    color: parseInt(c.accent.slice(1), 16),
    position,
    yaw,
    camera: {
      position: [position[0] + nx * 9.2 + right.x * 1.2, 3.9, position[2] + nz * 9.2 + right.z * 1.2],
      target: [position[0] + right.x * 2.1, 1.8, position[2] + right.z * 2.1],
    },
  }
})

export const PROJECTS_OVERVIEW_CAMERA = {
  position: [-3, 17, -4] as [number, number, number],
  target: [20, 0.5, -26] as [number, number, number],
}

export function getProject(id: string | null) {
  return PROJECTS.find((p) => p.id === id) ?? null
}

export const isPlaceholder = (t: string) => /\[[^\]]+\]/.test(t)

/** project names the AI guide understands ("show TASK", "open KidPool"…) */
export function matchProject(text: string): ProjectDef | null {
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const words = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
  // short names ("TASK") must be whole words; longer ones may be spaced ("kid pool")
  for (const p of PROJECTS) {
    for (const name of [p.title, ...(p.aliases ?? [])]) {
      const key = squash(name)
      if (words.includes(` ${key} `) || (key.length > 4 && squash(text).includes(key))) return p
    }
  }
  return null
}

/** development-time note of prototypes waiting to be verified */
export function reportPendingProjects() {
  if (!import.meta.env.DEV || !PENDING_PROJECTS.length) return
  console.groupCollapsed(`[projects] ${PENDING_PROJECTS.length} prototype(s) waiting for Figma access — not shown`)
  for (const p of PENDING_PROJECTS) console.info(`${p.title}: ${p.reason}`)
  console.groupEnd()
}
