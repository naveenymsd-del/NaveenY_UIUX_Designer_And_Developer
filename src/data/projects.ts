/**
 * Projects — the single source of truth for every place a project appears:
 * the Project Studio screens inside NFC Solutions, the case-study
 * presentation, the menu, the AI guide and the /projects overview (street
 * pavilions).
 *
 * Only projects with a verified Figma prototype belong here. Content comes
 * from Naveen's résumé (names, domains, role) and the case-study frames in
 * the Figma file each prototype opens (flows, IA, visual language, screens).
 * Nothing is added that isn't visible in those sources — no metrics, no
 * outcomes. Appending an entry creates its studio bay, screen, interaction,
 * pavilion and case study automatically.
 */
export interface CaseItem {
  title: string
  text: string
}

export interface CaseUser {
  name: string
  /** one line: who they are */
  who: string
  needs: string[]
}

export interface CaseFlow {
  title: string
  steps: string[]
}

export interface CaseScreen {
  /** path under /public */
  image: string
  caption: string
  alt: string
}

export interface ProjectContent {
  id: string
  /** short name shown as the title ("TASK") */
  title: string
  /** full name ("TASK — Ticketing & Project Management Platform") */
  fullTitle: string
  /** domain, e.g. "B2B SaaS · Productivity" */
  category: string
  platform: string
  role: string
  /** design scope, from the case study */
  scope: string
  /** one-sentence project statement */
  summary: string
  overview: string[]
  /** My approach */
  approach: string[]
  /** Key user flows (from the prototype) */
  flows: CaseFlow[]
  /** Information architecture: top-level sections and what sits under them */
  ia: CaseItem[]
  /** UI / design system: the visual language, colours and type from the Figma file */
  design: { text: string; colors: { name: string; hex: string }[]; type: string; components: string[] }
  screens: CaseScreen[]
  /** The challenge */
  challenge: { headline: string; items: CaseItem[]; question: string }
  /** UX / product thinking: who it serves and what each role needs */
  users: CaseUser[]
  /** Design decisions */
  decisions: CaseItem[]
  /** the verified, clickable UI prototype in Figma (the product itself) — omitted when there isn't one */
  prototypeUrl?: string
  /** the verified Figma case-study presentation (the story behind the design) */
  caseStudyUrl: string
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

const I = (title: string, text: string): CaseItem => ({ title, text })
const FIGMA = 'https://www.figma.com/proto/i852L2XjU3cEM6LpoRVOWN/UI-UX-Web-Designs?page-id=914%3A60467'
const caseStudy = (node: string, sidebar = true) =>
  `${FIGMA}&node-id=${node}&viewport=276%2C308%2C0.06&t=YI4dKAPdPrQxEo1a-1&scaling=scale-down-width&content-scaling=fixed&starting-point-node-id=${node.replace('-', '%3A')}${sidebar ? '&show-proto-sidebar=1' : ''}`

export const PROJECT_CONTENT: ProjectContent[] = [
  {
    id: 'task',
    title: 'TASK',
    fullTitle: 'TASK — Ticketing & Project Management Platform',
    category: 'B2B SaaS · Productivity',
    platform: 'Web dashboards (desktop-first)',
    role: 'UI/UX Designer',
    scope: 'Tickets · milestones · profile & preferences',
    summary: 'Raise, track and resolve every ticket — in one calm workspace.',
    overview: [
      'TASK is an enterprise ticketing and project-management platform where teams log issues, collaborate on each ticket, track milestones and follow team workload through centralised dashboards.',
      'I designed the end-to-end experience — sign-in, personal and admin dashboards, ticket lists and filters, a rich ticket detail, milestones with a timeline, and profile and preference settings — plus the design system behind it.',
    ],
    approach: [
      'Reviewed the ticketing tools and workflows the team already relied on, to keep what worked and fix what slowed people down.',
      'Mapped two roles — team member and admin/lead — onto one shared structure.',
      'Organised the product around the life of a ticket, from creation to audit.',
      'Built a predictable sidebar IA and a reusable component set in Figma.',
      'Designed the states, not just the screens: empty states, confirmations and success feedback.',
    ],
    flows: [
      { title: 'Ticket lifecycle', steps: ['Create', 'Find', 'Collaborate', 'Link', 'Resolve', 'Audit'] },
      { title: 'Find & save a view', steps: ['Ticket list', 'Filter panel', 'Save quick filter', 'One-click view'] },
      { title: 'Plan a milestone', steps: ['Milestone list', 'Progress & dates', 'Timeline + calendar'] },
    ],
    ia: [
      I('Dashboard', 'My open tickets · status overview · activity & deadlines'),
      I('Tickets', 'View tickets · new ticket · saved filters · ticket detail (5 tabs)'),
      I('Milestones', 'Milestone list · progress & dates · timeline + calendar'),
      I('Work', 'Time tracking · repositories · reports · notifications'),
      I('Profile', 'Account & password · notification preferences · columns & views'),
    ],
    design: {
      text: 'Warm amber marks primary actions and the brand; neutral greys keep dense tables quiet; semantic green, blue and violet carry status and priority.',
      colors: [
        { name: 'Task amber', hex: '#F9B418' }, { name: 'Ink', hex: '#111827' }, { name: 'Slate', hex: '#6B7280' },
        { name: 'Success', hex: '#22C55E' }, { name: 'Info', hex: '#2563EB' }, { name: 'Violet', hex: '#8B5CF6' },
      ],
      type: 'Outfit — friendly, modern and readable at dense sizes',
      components: ['KPI cards', 'Priority & status chips', 'Data tables', 'Filter side panel', 'Multi-select dropdown', 'Tabs', 'Confirmation dialog', 'Empty state'],
    },
    screens: [
      { image: '/projects/task-dashboard.webp', caption: 'Personal dashboard', alt: 'TASK personal dashboard with KPI cards, My Work table, milestones, activity trend and timeline' },
      { image: '/projects/task-tickets.webp', caption: 'Tickets & filters', alt: 'TASK ticket list with filter side panel and saved quick filters' },
    ],
    challenge: {
      headline: 'Lots of tickets. Little clarity.',
      items: [
        I('Lists without hierarchy', 'Long ticket tables made it hard to see what’s urgent, what’s mine and what’s overdue.'),
        I('Context lives elsewhere', 'Comments, attachments, related tickets and history were scattered or buried.'),
        I('One-size-fits-all views', 'People couldn’t save filters, choose columns or tune notifications to how they work.'),
      ],
      question: 'How might we make every ticket easy to find, understand and act on — for every person on the team?',
    },
    users: [
      { name: 'Team member', who: 'Raises, works on and resolves tickets every day', needs: ['See what’s assigned and what’s due', 'Find any ticket fast with saved filters', 'Keep all context inside the ticket'] },
      { name: 'Admin / lead', who: 'Manages projects, queues and team workload', needs: ['A live picture of open, in-progress and resolved work', 'Spot overdue milestones early', 'Clear history and accountability'] },
    ],
    decisions: [
      I('Density needs hierarchy', 'KPI cards, consistent colour-coded chips and table rhythm keep data-heavy screens readable.'),
      I('Context beats navigation', 'Filters open in a side panel and ticket detail uses tabs, so people stay anchored instead of jumping between pages.'),
      I('Keep power-user speed', 'Bulk select, right-click actions and column control stay — but become visible.'),
      I('Let people tailor it', 'Saved filters, table columns and notification settings turn one product into personal workspaces.'),
    ],
    prototypeUrl:
      'https://www.figma.com/proto/vUIgk3l5i7TXJwCPXHq7xu/TASK-UI?node-id=152-19286&viewport=1484%2C-2898%2C0.11&t=SplDLtshCgBKTxhy-1&scaling=scale-down-width&content-scaling=fixed&starting-point-node-id=152%3A19286&page-id=0%3A1',
    caseStudyUrl: caseStudy('1067-1563'),
    aliases: ['ticketing', 'ticket'],
    accent: '#d9881a',
  },
  {
    id: 'kidpool',
    title: 'KidPool',
    fullTitle: 'KidPool — School Carpooling Mobile App',
    category: 'Community & Safety · School carpooling',
    platform: 'Mobile app · iOS & Android',
    role: 'UI/UX Designer',
    scope: 'Three roles · design system · animated prototype',
    summary: 'Safe, free school carpooling — built by parents, for parents.',
    overview: [
      'KidPool lets parents in the same school community share the school run, with verification, live tracking and school check-in built into every ride.',
      'Every user is a parent: nobody is a “driver” — they’re a Ride Partner helping a neighbour. The experience serves three roles — parents, Ride Partners and school staff — and had to feel as warm as a favour between friends and as safe as a school system.',
    ],
    approach: [
      'Role-based information architecture: one shared onboarding, then three focused journeys.',
      'Trust before the first ride — a guided verification hub for ID, selfie, driving record, background check and vehicle.',
      'Parental approval of every Ride Partner before a ride is confirmed.',
      'Live tracking with a school geofence, and QR-based check-in for staff.',
      'A token-based design system in Figma variables, and a connected prototype with micro-interactions.',
    ],
    flows: [
      { title: 'Parent', steps: ['Ask for a ride', 'Nearby parents notified', 'Approve partner', 'Live tracking', 'Checked in at school'] },
      { title: 'Ride Partner', steps: ['Requests inbox', 'Offer help', 'Approved', 'Pickup checklist', 'Drive mode', 'School pass'] },
      { title: 'School staff', steps: ['Arrivals dashboard', 'Scan pass', 'Partner verified', 'Confirm kids', 'Check-in complete'] },
    ],
    ia: [
      I('Shared', 'Welcome → sign up → role → verification → add kids → join school circle'),
      I('Parent', 'Home · ask for a ride · live tracking & SOS · my rides · community · profile & parental controls'),
      I('Ride Partner', 'Requests inbox · request details · pickup checklist · drive mode · school pass'),
      I('School staff', 'Arrivals dashboard · scan pass · confirm kids · mismatch alert'),
    ],
    design: {
      text: 'Black and electric lime give every screen one obvious action; pill shapes, rounded cards and circular controls stay friendly for one-handed use. Colours, spacing and radius are Figma variables.',
      colors: [
        { name: 'Electric lime', hex: '#C7FF2E' }, { name: 'Ink', hex: '#0F0F0F' }, { name: 'Charcoal', hex: '#2E2E2E' },
        { name: 'Surface', hex: '#F2F2F2' }, { name: 'SOS', hex: '#FF4D3D' },
      ],
      type: 'Hanken Grotesk — big, light headlines that feel reassuring',
      components: ['Status cards', 'Pill buttons', 'Circular controls', 'Bottom sheets', 'Verification steps', 'QR school pass'],
    },
    screens: [
      { image: '/projects/kidpool-ask.webp', caption: 'Ask for a ride', alt: 'KidPool screens: home, ask for a ride, finding parents, approve partner and all set' },
      { image: '/projects/kidpool-staff.webp', caption: 'School staff check-in', alt: 'KidPool school staff screens: arrivals dashboard, scan result, confirm kids, check-in complete and mismatch alert' },
    ],
    challenge: {
      headline: 'When a parent can’t make the school run, there’s no safe, simple way to ask for help.',
      items: [
        I('The last-minute scramble', 'Parents fall back on group chats and favours that may or may not come through.'),
        I('The trust gap', 'Parents can’t verify who is driving their child, or whether their child actually arrived.'),
        I('Schools in the dark', 'Teachers don’t know which adult is dropping off which child — no record, no accountability.'),
      ],
      question: 'How might we make asking a neighbour for a school ride feel as safe as a school bus and as easy as sending a text?',
    },
    users: [
      { name: 'Requesting parent', who: 'Needs help with the school run', needs: ['Get help on busy mornings', 'Approve exactly who drives their child', 'Know the moment their child is at school'] },
      { name: 'Ride Partner', who: 'A parent from the same school offering a seat', needs: ['See requests that fit their own route', 'Clear pickup details and a school pass', 'Few distractions while driving'] },
      { name: 'School staff', who: 'Teachers at the drop-off line', needs: ['Know who is dropping off whom, in advance', 'Verify the adult and the children quickly', 'A record of every check-in'] },
    ],
    decisions: [
      I('“Ride Partner”, not “driver”', 'The language reframes the product around neighbours helping neighbours.'),
      I('Status as reassurance', 'Verification, approvals and alerts are presented as calm status moments — not warnings.'),
      I('One obvious action per screen', 'A single lime action keeps safety-sensitive steps easy to follow.'),
      I('Each role gets what it needs, when it needs it', 'Parent, partner and teacher each see only their part of the ride, at the right moment.'),
    ],
    prototypeUrl:
      'https://www.figma.com/proto/UkougomRKZEjdNS0EC1Twf/CarPooling_For_Student?page-id=80%3A2&node-id=83-4852&starting-point-node-id=83%3A4852&scaling=scale-down&content-scaling=fixed&show-proto-sidebar=1',
    caseStudyUrl: caseStudy('1066-64859'),
    aliases: ['kid pool', 'carpool', 'carpooling'],
    accent: '#6f9a12',
  },
  {
    id: 'calmscient',
    title: 'Calmscient',
    fullTitle: 'Calmscient — Mental Health & Wellness Application',
    category: 'Healthcare · Mental health & wellness',
    platform: 'Mobile app (iOS & Android) + web admin panel',
    role: 'UI/UX Designer',
    scope: 'Mobile app · admin panel · Aug 2024 – Dec 2025',
    summary: 'A gentle companion for managing anxiety and emotional well-being.',
    overview: [
      'Calmscient is a mental health and wellness experience for people managing anxiety and emotional well-being. It brings daily check-ins, mood tracking, symptom logging, medications, screenings and guided lessons into one calm, private space.',
      'I designed the mobile application and the web admin panel — from user flows and wireframes to a soft, accessible visual language — and supported developers with HTML/CSS.',
    ],
    approach: [
      'Shaped flows from research inputs and stakeholder discussions.',
      'Kept the daily check-in tiny: mood, company, medication and a journal line.',
      'Simplified sensitive information into readable, uncluttered screens.',
      'Mobile-first interaction patterns, mirrored consistently in the admin panel.',
      'Accessible, low-stress typography and gentle confirmations throughout.',
    ],
    flows: [
      { title: 'Daily care loop', steps: ['Check in', 'Track meds', 'Screen', 'Learn', 'Practice', 'Reflect'] },
      { title: 'Daily check-in', steps: ['Sign in', 'Mood scale', 'Company & meds', 'Journal line', 'Saved'] },
      { title: 'Medication', steps: ['Medical records', 'Schedule', 'Add medication', 'Time & alarm', 'Added'] },
    ],
    ia: [
      I('Home', 'Daily check-in · medical records · weekly summary · trackers · talk with someone'),
      I('Discovery', 'Managing anxiety · changing your response to stress · taking control'),
      I('Exercises', 'Mindfulness · muscle relaxation · movement · breathing'),
      I('Records & settings', 'Medications & reminders · appointments · screenings · profile'),
    ],
    design: {
      text: 'A lavender primary for calm, a warm coral for feeling and emphasis, rounded cards and illustrations that feel human rather than clinical.',
      colors: [
        { name: 'Calm lavender', hex: '#6E6BB3' }, { name: 'Deep indigo', hex: '#2B2866' }, { name: 'Warm coral', hex: '#F48383' },
        { name: 'Mist', hex: '#F3F1FF' }, { name: 'Graphite', hex: '#424242' },
      ],
      type: 'Lexend — designed for effortless, low-stress reading',
      components: ['Emoji mood scale', 'Dose schedule', 'Screening result', 'Gentle confirmations', 'Lesson cards'],
    },
    screens: [
      { image: '/projects/calmscient-checkin.webp', caption: 'Onboarding & daily check-in', alt: 'Calmscient screens: splash, sign in, daily check-in, saved confirmation and home' },
      { image: '/projects/calmscient-screenings.webp', caption: 'Screenings & weekly insights', alt: 'Calmscient screens: screenings, results, weekly summary, mood summary and sleep journal' },
    ],
    challenge: {
      headline: 'Emotionally sensitive tasks need a calm, approachable experience.',
      items: [
        I('Patterns are easy to miss', 'Mood, sleep and triggers change day to day; without a simple habit they’re easy to forget.'),
        I('Care lives in many places', 'Medications, appointments, screenings and journals are spread across apps, paper and memory.'),
        I('Clinical tools can feel cold', 'Questionnaires and trackers can feel stressful — the opposite of what an anxious person needs.'),
      ],
      question: 'How might we help people understand their well-being through small, kind daily habits — consistently across app and admin?',
    },
    users: [
      { name: 'People managing anxiety', who: 'Using the mobile app day to day', needs: ['A quick, private way to log how they feel', 'Reminders for medications and appointments', 'Bite-sized help they can use right away'] },
      { name: 'Care teams', who: 'Using the web admin panel', needs: ['See screenings, mood trends and adherence', 'Share content with patients', 'A consistent experience with the app'] },
    ],
    decisions: [
      I('Tone is a feature', 'Soft colours, kind copy and gentle confirmations help sensitive tasks feel safe to complete.'),
      I('Make habits tiny', 'The daily check-in stays short — one question at a time, with a skip option.'),
      I('Help is one tap away', '“Need to talk with someone?” stays visible rather than buried in a menu.'),
      I('Calm by default', 'Uncluttered screens and readable type, so everyday information never feels alarming.'),
    ],
    prototypeUrl:
      'https://www.figma.com/proto/8JRaJprIyCtDy7zfMsOuSs/UI-UX-MOBILE-DESIGNS?node-id=48-5821&viewport=1583%2C-1322%2C0.2&t=xXUuRp9uhQlCeCK1-1&scaling=scale-down&content-scaling=fixed&starting-point-node-id=48%3A5821&show-proto-sidebar=1&page-id=0%3A1',
    caseStudyUrl: caseStudy('1066-68557'),
    aliases: ['calm scient', 'mental health', 'wellness'],
    accent: '#6e6bb3',
  },
  {
    id: 'inta',
    title: 'INTA',
    fullTitle: 'INTA — International Trademark Association Website',
    category: 'Association · Legal & IP',
    platform: 'Responsive website',
    role: 'UI/UX Designer',
    scope: 'Main site + Annual Meeting pages · Ask INTA AI assistant',
    summary: 'The home of the global brand community — events, resources and answers in one place.',
    overview: [
      'INTA, the International Trademark Association, is a global network of brand owners and intellectual-property professionals. Its website has to explain what the association does, promote its events and open a large library of resources — to members and newcomers alike.',
      'I designed the site experience — Home, About Us, Events, News and Resources, plus “Ask INTA”, an AI chat assistant — and the Annual Meeting pages: registration, program and speakers, exhibitors, partners, travel, news, store and FAQs.',
    ],
    approach: [
      'Mapped each audience to a clear path before designing any page.',
      'Separated the main association site from an Annual Meeting microsite.',
      'Built a small set of page templates — hub, listing, detail, table — to keep many pages consistent.',
      'Made “Ask INTA” and global search available everywhere, so no visitor hits a dead end.',
    ],
    flows: [
      { title: 'Newcomer', steps: ['Home', 'What INTA does', 'Resources', 'Ask INTA'] },
      { title: 'Annual Meeting attendee', steps: ['Meeting home', 'Registration & pricing', 'Program & speakers', 'Hotel & travel'] },
      { title: 'Exhibitor / partner', steps: ['Exhibitor information', 'Deadlines & checklists', 'Partners'] },
    ],
    ia: [
      I('About Us', 'Mission & leadership · policy & advocacy · anti-counterfeiting'),
      I('Events', 'Annual Meeting · TMAP Meeting · IP workshops'),
      I('News', 'INTA Daily News · press & media partners · bulletins'),
      I('Resources', 'Practice guides · webcasts · CLE/CPD · career centre · member directory'),
      I('Always available', 'Global search · Ask INTA AI assistant · member sign-in'),
    ],
    design: {
      text: 'Navy carries authority, INTA red marks every call to action and generous white space keeps dense, professional content readable.',
      colors: [
        { name: 'INTA navy', hex: '#2E4574' }, { name: 'INTA red', hex: '#EF3942' }, { name: 'Ice', hex: '#ECF3F5' },
        { name: 'Graphite', hex: '#414141' }, { name: 'Rule grey', hex: '#D9D9D9' },
      ],
      type: 'An editorial serif with Libre Franklin for clean body text, tables and forms',
      components: ['Utility bar & navigation', 'Pricing tables', 'Speaker cards', 'Event cards', 'Contact footer'],
    },
    screens: [
      { image: '/projects/inta-annual.webp', caption: 'Annual Meeting home', alt: 'INTA Annual Meeting home page with hero, quick links and editorial cards' },
      { image: '/projects/inta-program.webp', caption: 'Program, people & search', alt: 'INTA session detail with speaker cards, and search across sessions, people and organisations' },
    ],
    challenge: {
      headline: 'A large organisation, many audiences, one website.',
      items: [
        I('A deep content library', 'Practice guides, webcasts, CLE/CPD, a career centre and a member directory are easy to get lost in.'),
        I('Very different visitors', 'A seasoned practitioner, a newcomer, an exhibitor and a journalist each need a different path.'),
        I('Event logistics everywhere', 'Registration, programs, exhibitors, hotels, news and FAQs for the Annual Meeting needed one home.'),
      ],
      question: 'How might we give every visitor a clear first step — whether they’re joining, learning, exhibiting or attending?',
    },
    users: [
      { name: 'Members & practitioners', who: 'Existing members', needs: ['Find practice guides, CLE/CPD and the directory', 'Register for meetings quickly'] },
      { name: 'Newcomers & students', who: 'First-time visitors', needs: ['Understand what INTA does', 'Take a clear first step'] },
      { name: 'Exhibitors & partners', who: 'Event partners and press', needs: ['Clear deadlines and booking paths', 'News and partner details in one place'] },
    ],
    decisions: [
      I('Structure before style', 'Mapping audiences to paths first made a dense association site feel simple.'),
      I('Ask INTA as a front door', 'An AI assistant answers questions and points visitors to the right page or resource, instead of searching page by page.'),
      I('Every page has a next step', 'Red calls to action and a “Contact Member Operations” footer on every page.'),
      I('Templates scale content', 'Hub, listing, detail and table templates keep many pages consistent.'),
    ],
    prototypeUrl:
      'https://www.figma.com/proto/QCaAaghXmnuMOjWVpdXSUB/INTADesign?node-id=17616-105510&viewport=27096%2C-7560%2C0.3&t=AvpwDXISkSBHOWm3-1&scaling=scale-down-width&content-scaling=fixed&starting-point-node-id=17616%3A105510&page-id=0%3A1',
    caseStudyUrl: caseStudy('1066-69071'),
    aliases: ['trademark', 'international trademark association', 'ask inta'],
    accent: '#2e4574',
  },
  {
    id: 'intellistaff',
    title: 'IntelliStaff',
    // résumé: "IntelliStaff — Job Board & Applicant Tracking Platform · Recruitment / HR Tech · Enterprise SaaS · Web & Mobile".
    // The Figma case study (and its screens) covers the platform's client staffing app, presented here as part of it.
    fullTitle: 'IntelliStaff — Job Board & Applicant Tracking Platform',
    category: 'Recruitment / HR Tech · Enterprise SaaS',
    platform: 'Web & mobile · client app on iOS & Android',
    role: 'UI/UX Designer',
    scope: 'Job board · applicant tracking · client staffing app',
    summary: 'A job board and hiring platform for candidates and recruiters — and a mobile app for staffing clients.',
    overview: [
      'IntelliStaff is a job board and applicant tracking platform serving two user groups — candidates and recruiters. I designed the end-to-end UX: the information architecture for job listings, candidate profiles and application-tracking dashboards, and the user flows, wireframes and interactive prototypes for job search, application and recruiter shortlisting.',
      'This case study shows IntelliStaff Mobile, the platform’s client app: it lets a staffing agency’s clients request temporary workers, choose who they want, follow today’s assignments and approve timeslips — without a phone call.',
      'I designed the client mobile experience end to end: multi-division sign-in, a guided job-order flow, staff selection, order tracking with ratings, schedules and timeslip approvals.',
    ],
    approach: [
      'Defined the information architecture for job listings, candidate profiles and application-tracking dashboards.',
      'Created user flows, wireframes and interactive prototypes for job search, application and recruiter shortlisting.',
      'Partnered with stakeholders and developers in Agile sprints to validate feasibility and support implementation.',
      'Separated the client and employee entry points from the first screen.',
      'Broke a long job-order form into guided steps with smart pickers.',
      'Made staff selection visual — photo, hours worked, rating and favourites.',
      'Closed every loop with success states, ratings and timeslip approvals.',
      'Built the screens from reusable components and auto layout in Figma.',
    ],
    flows: [
      { title: 'Job order', steps: ['Position', 'Reason', 'Location', 'Report to', 'Headcount', 'Dates & schedule', 'Select staff', 'Order created'] },
      { title: 'After the order', steps: ['Orders', 'Filter', 'Order overview', 'Rate employee'] },
      { title: 'Timeslips', steps: ['Pending', 'Approve or decline', 'Approved'] },
    ],
    ia: [
      I('Home', 'Today’s assignments · date strip · quick actions'),
      I('Orders', 'Active · open · past · filters · order overview & rating'),
      I('+ New order', 'Quick order · order with shifts · order with assignment'),
      I('Timeslips', 'Pending · approved · billing & reports'),
      I('Profile', 'Divisions · change password · usage agreement'),
    ],
    design: {
      text: 'A single indigo brand colour carries every action, light lavender surfaces group information and amber is saved for ratings and highlights.',
      colors: [
        { name: 'Intelli indigo', hex: '#444EB2' }, { name: 'Night', hex: '#161B52' }, { name: 'Lavender mist', hex: '#EBECFE' },
        { name: 'Rating amber', hex: '#FFB547' }, { name: 'Charcoal', hex: '#414244' },
      ],
      type: 'Poppins — keeps forms legible at small sizes',
      components: ['Quick-action tiles', 'Staff picker cards', 'Order cards', 'Employee rating', 'Date strip'],
    },
    screens: [
      { image: '/projects/intellistaff-home.webp', caption: 'Sign in & home', alt: 'IntelliStaff screens: splash, choose your app, sign in, divisions and home with today’s assignments' },
      { image: '/projects/intellistaff-staffing.webp', caption: 'Staffing the order', alt: 'IntelliStaff screens: headcount keypad, dates and schedule, select staff and order created' },
    ],
    challenge: {
      headline: 'Staffing ran on phone calls, emails and guesswork.',
      items: [
        I('Slow, error-prone ordering', 'Each request — position, location, dates and supervisor — was phoned or emailed, and details were missed.'),
        I('No live view of the day', 'Managers couldn’t easily see who was assigned today, where, and for which position.'),
        I('Approvals & feedback lagged', 'Timeslips piled up, with no quick way to rate a worker after an order.'),
      ],
      question: 'How might we let a busy manager book the right temporary worker quickly — from anywhere?',
    },
    users: [
      { name: 'Candidates', who: 'People looking for work on the job board', needs: ['Search job listings', 'Apply for jobs', 'Keep a candidate profile'] },
      { name: 'Recruiters', who: 'Hiring teams working through applicants', needs: ['Review candidate profiles', 'Track applications on dashboards', 'Shortlist candidates'] },
      { name: 'Client managers', who: 'Hiring managers and supervisors across divisions', needs: ['Request staff from anywhere', 'Pick familiar, highly rated workers', 'Track orders, approve timeslips, rate work'] },
      { name: 'Front desk', who: 'Teams managing day-to-day schedules', needs: ['See today’s assignments at a glance', 'Check an employee’s schedule and location', 'Reach the right supervisor'] },
    ],
    decisions: [
      I('One question per step', 'Breaking the order form into steps suits mobile and keeps details complete.'),
      I('People pick people', 'Photos, hours and ratings turn “any worker” into “the right worker”.'),
      I('A home base and a big “+”', 'Clear tabs and one central action open every order type.'),
      I('Close every loop', 'Success states, ratings and timeslip approvals confirm the job is done.'),
    ],
    // no separate UI prototype link has been supplied for IntelliStaff
    caseStudyUrl: caseStudy('1066-63962', false),
    aliases: ['intelli staff', 'staffing', 'recruitment', 'job board', 'applicant tracking', 'ats', 'hiring platform'],
    accent: '#444eb2',
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
