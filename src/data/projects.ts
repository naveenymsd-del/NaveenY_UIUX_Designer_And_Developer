export interface ProjectDef {
  id: string
  number: string
  title: string
  category: string
  description: string
  role: string
  year: string
  tools: string[]
  color: number
  accent: string
  /** pavilion ground position */
  position: [number, number, number]
  /** yaw of the pavilion front */
  yaw: number
  camera: { position: [number, number, number]; target: [number, number, number] }
  caseStudyUrl: string
}

export const PLAZA_CENTER: [number, number] = [19, -25]

const raw: Omit<ProjectDef, 'yaw' | 'camera'>[] = [
  {
    id: 'p01', number: '01', title: 'Lumen Identity',
    category: 'Brand System · Web',
    description:
      'A living brand system for a neighbourhood café group: adaptive logo, warm type pairing and a web presence that shifts palette with the time of day.',
    role: 'Lead Designer', year: '2025', tools: ['Figma', 'After Effects', 'React'],
    color: 0xef8a78, accent: '#ef8a78', position: [12.5, 0.15, -37.5], caseStudyUrl: '#case-p01',
  },
  {
    id: 'p02', number: '02', title: 'Tidal Mobile',
    category: 'Product Design · iOS / Android',
    description:
      'A calm banking companion that turns spending into readable tides. Research-led flows, a motion language for money, and an accessible component kit.',
    role: 'Product Designer', year: '2025', tools: ['Figma', 'Principle', 'SwiftUI'],
    color: 0x4fb3a9, accent: '#4fb3a9', position: [19, 0.15, -39.5], caseStudyUrl: '#case-p02',
  },
  {
    id: 'p03', number: '03', title: 'Kiln Commerce',
    category: 'E-commerce · Art Direction',
    description:
      'Storefront for a ceramics studio. Tactile product photography, a slow-shopping checkout and a CMS the makers actually enjoy using.',
    role: 'Art Director', year: '2024', tools: ['Shopify', 'Blender', 'Lightroom'],
    color: 0xf5dd92, accent: '#e9b949', position: [25.5, 0.15, -37.5], caseStudyUrl: '#case-p03',
  },
  {
    id: 'p04', number: '04', title: 'Orbit Workflow',
    category: 'AI Tooling · Dashboard',
    description:
      'An AI-assisted design operations dashboard: prompt libraries, review queues and generated asset lineage, designed for trust and legibility.',
    role: 'UX Lead', year: '2026', tools: ['Figma', 'TypeScript', 'Claude'],
    color: 0x9fb2e6, accent: '#7d93dc', position: [13, 0.15, -12.5], caseStudyUrl: '#case-p04',
  },
  {
    id: 'p05', number: '05', title: 'Echo Street',
    category: 'Interactive 3D · Web Experience',
    description:
      'This very neighbourhood: a playable 3D portfolio built with React Three Fiber, Rapier physics and a data-driven interaction system.',
    role: 'Creative Developer', year: '2026', tools: ['Three.js', 'R3F', 'Rapier', 'Blender'],
    color: 0xa996d4, accent: '#a996d4', position: [25, 0.15, -12.5], caseStudyUrl: '#case-p05',
  },
]

export const PROJECTS: ProjectDef[] = raw.map((p) => {
  const dx = PLAZA_CENTER[0] - p.position[0]
  const dz = PLAZA_CENTER[1] - p.position[2]
  const yaw = Math.atan2(dx, dz)
  const len = Math.hypot(dx, dz)
  const nx = dx / len
  const nz = dz / len
  // Camera sits on the fountain side looking back at the pavilion. The look
  // target is shifted to screen-right so the pavilion frames to the left of
  // the project panel. Screen-right for a camera looking along -n is (n.z, -n.x).
  const right = { x: nz, z: -nx }
  return {
    ...p,
    yaw,
    camera: {
      position: [p.position[0] + nx * 9.2 + right.x * 1.2, 3.9, p.position[2] + nz * 9.2 + right.z * 1.2],
      target: [p.position[0] + right.x * 2.1, 1.8, p.position[2] + right.z * 2.1],
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
