/**
 * Projects — the single source of truth for every place a project appears:
 * the Project Studio screens inside NFC Solutions, the case-study
 * presentation, the menu and the /projects overview (street pavilions).
 *
 * Only facts you provide belong here. Anything unknown stays a
 * [BRACKETED PLACEHOLDER]; the UI highlights placeholders so they are easy to
 * find. To add a project, append an entry to PROJECT_CONTENT — a studio bay,
 * a screen, an interaction and a case study are created automatically.
 * Screenshots: put files in /public/projects/<id>/ and list them in `screens`.
 */
export interface CaseStudy {
  overview: string
  challenge: string
  /** UX process, one line per step */
  process: string[]
  ui: string
  designSystem: string
  prototype: string
  outcome: string
}

export interface ProjectContent {
  id: string
  title: string
  /** e.g. "Product design · Web app" */
  category: string
  description: string
  role: string
  /** leave empty when unknown (hidden in the UI) */
  year: string
  tools: string[]
  /** image URLs, e.g. '/projects/intellistaff/dashboard.png' */
  screens: string[]
  caseStudy: CaseStudy
  links: { label: string; url: string }[]
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

const todo = (what: string): CaseStudy => ({
  overview: `[ADD ${what} OVERVIEW]`,
  challenge: '[ADD PROBLEM / CHALLENGE]',
  process: ['[ADD UX PROCESS STEPS]'],
  ui: '[ADD UI DESIGN NOTES]',
  designSystem: '[ADD DESIGN SYSTEM NOTES]',
  prototype: '[ADD PROTOTYPE DETAILS]',
  outcome: '[ADD OUTCOME]',
})

export const PROJECT_CONTENT: ProjectContent[] = [
  {
    id: 'intellistaff', title: 'IntelliStaff', category: '[ADD PROJECT TYPE]',
    description: '[ADD PROJECT DESCRIPTION]', role: '[ADD ROLE]', year: '', tools: [], screens: [],
    caseStudy: todo('INTELLISTAFF'), links: [], accent: '#3f6fb5',
  },
  {
    id: 'calmscient', title: 'Calmscient', category: '[ADD PROJECT TYPE]',
    description: '[ADD PROJECT DESCRIPTION]', role: '[ADD ROLE]', year: '', tools: [], screens: [],
    caseStudy: todo('CALMSCIENT'), links: [], accent: '#4f9587',
  },
  {
    id: 'ebounti', title: 'Ebounti', category: '[ADD PROJECT TYPE]',
    description: '[ADD PROJECT DESCRIPTION]', role: '[ADD ROLE]', year: '', tools: [], screens: [],
    caseStudy: todo('EBOUNTI'), links: [], accent: '#c47f3a',
  },
  {
    id: 'task', title: 'TASK', category: '[ADD PROJECT TYPE]',
    description: '[ADD PROJECT DESCRIPTION]', role: '[ADD ROLE]', year: '', tools: [], screens: [],
    caseStudy: todo('TASK'), links: [], accent: '#7466ad',
  },
  {
    id: 'wastebeminerals', title: 'WasteBeMinerals', category: '[ADD PROJECT TYPE]',
    description: '[ADD PROJECT DESCRIPTION]', role: '[ADD ROLE]', year: '', tools: [], screens: [],
    caseStudy: todo('WASTEBEMINERALS'), links: [], accent: '#6b8c46',
  },
]

export const PLAZA_CENTER: [number, number] = [19, -25]

/** pavilion lots around the plaza (the /projects overview); extra projects reuse lots */
const PAVILIONS: [number, number, number][] = [
  [12.5, 0.15, -37.5], [19, 0.15, -39.5], [25.5, 0.15, -37.5], [13, 0.15, -12.5], [25, 0.15, -12.5],
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
