import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, type Group, type Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, TorusGeometry,
} from 'three'
import { playerRuntime } from '@/core/runtime'
import { AI_AREA, ACTIVITY_SPOTS, GROWTH_WALK, GROWTH_YAW, PROCESS_STATIONS } from '@/data/locations'
import { AI_HUMAN_STEPS, AI_WORKFLOW, CAREER_STAGES, DESIGN_PROCESS, EDUCATION_TIMELINE, PROFILE, TOOLS } from '@/data/portfolioContent'
import { INTERIORS, roomToWorld, studioBay, type InteriorId } from '@/data/interiors'
import { isPlaceholder, PROJECTS, type ProjectDef } from '@/data/projects'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { damp } from '@/utils/movement'
import { UI_FONT } from '@/utils/textures'
import { storyEvents } from './InteractionManager'

/**
 * Environmental storytelling objects. They react to the player's presence
 * (boards rise, books open, plaques light up, the chalkboard writes itself)
 * so information is discovered in the world before any UI appears.
 */

// ── shared resources ────────────────────────────────────────────────────────
const G = {
  box: new BoxGeometry(1, 1, 1),
  plane: new PlaneGeometry(1, 1),
  cyl: new CylinderGeometry(0.5, 0.5, 1, 16),
  torus: new TorusGeometry(0.5, 0.06, 6, 32),
}
const matCache = new Map<string, MeshStandardMaterial>()
function mat(color: string | number, rough = 0.8) {
  const k = `${color}-${rough}`
  let m = matCache.get(k)
  if (!m) matCache.set(k, (m = new MeshStandardMaterial({ color, roughness: rough })))
  return m
}

interface TextSpec {
  w: number
  h: number
  bg: string
  lines: { text: string; size: number; weight?: number; color: string; gap?: number }[]
  align?: 'left' | 'center'
  pad?: number
  border?: string
}
const texCache = new Map<string, CanvasTexture>()
function textTexture(spec: TextSpec) {
  const key = JSON.stringify(spec)
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = spec.w
  c.height = spec.h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = spec.bg
  ctx.fillRect(0, 0, spec.w, spec.h)
  if (spec.border) {
    ctx.strokeStyle = spec.border
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, spec.w - 6, spec.h - 6)
  }
  const pad = spec.pad ?? 24
  let y = pad
  for (const l of spec.lines) {
    ctx.font = `${l.weight ?? 600} ${l.size}px ${UI_FONT}`
    ctx.fillStyle = l.color
    ctx.textBaseline = 'top'
    ctx.textAlign = spec.align === 'center' ? 'center' : 'left'
    const x = spec.align === 'center' ? spec.w / 2 : pad
    // simple word wrap
    const words = l.text.split(' ')
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > spec.w - pad * 2 && line) {
        ctx.fillText(line, x, y)
        y += l.size * 1.2
        line = w
      } else line = test
    }
    ctx.fillText(line, x, y)
    y += l.size * 1.2 + (l.gap ?? 8)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  texCache.set(key, t)
  return t
}
const basicCache = new Map<CanvasTexture, MeshBasicMaterial>()
function textMat(t: CanvasTexture) {
  let m = basicCache.get(t)
  if (!m) basicCache.set(t, (m = new MeshBasicMaterial({ map: t, toneMapped: true, side: DoubleSide })))
  return m
}

function distTo(x: number, z: number) {
  const p = playerRuntime.position
  return Math.hypot(p.x - x, p.z - z)
}
const easeTo = (v: number, t: number, dt: number, l = 5) => damp(v, t, l, dt)

// ── Design Park ─────────────────────────────────────────────────────────────
function ProcessBoard({ index }: { index: number }) {
  const [x, z] = PROCESS_STATIONS[index]
  const step = DESIGN_PROCESS[index]
  const board = useRef<Group>(null!)
  const glow = useRef<Mesh>(null!)
  const st = useRef({ a: 0 })
  const tex = useMemo(
    () => textTexture({
      w: 320, h: 220, bg: '#f4efe4', border: '#6f9a4c',
      lines: [
        { text: step.n, size: 34, weight: 800, color: '#6f9a4c', gap: 0 },
        { text: step.title.toUpperCase(), size: 40, weight: 800, color: '#2c3a2a', gap: 10 },
        { text: step.text, size: 22, weight: 500, color: '#4b5646' },
      ],
    }),
    [step],
  )
  const glowMat = useMemo(() => new MeshBasicMaterial({ color: new Color('#b8d98c'), transparent: true, opacity: 0, depthWrite: false }), [])
  // face the path direction toward the next station
  const next = PROCESS_STATIONS[Math.min(index + 1, PROCESS_STATIONS.length - 1)]
  const prev = PROCESS_STATIONS[Math.max(index - 1, 0)]
  const yaw = Math.atan2(next[0] - prev[0], next[1] - prev[1]) + Math.PI / 2
  useFrame((_, dt) => {
    const d = distTo(x, z)
    const s = st.current
    s.a = easeTo(s.a, d < 3.6 ? 1 : 0, dt, 4)
    board.current.position.y = 0.95 + s.a * 0.35
    board.current.rotation.x = -0.35 + s.a * 0.3
    glowMat.opacity = s.a * 0.55
    glow.current.scale.setScalar(1 + s.a * 0.15)
  })
  return (
    <group position={[x, 0.25, z]} rotation-y={yaw}>
      <mesh geometry={G.cyl} material={mat('#8a6a4c')} position={[0, 0.55, -0.02]} scale={[0.08, 1.1, 0.08]} castShadow />
      <group ref={board}>
        <mesh geometry={G.box} material={mat('#6e5140')} scale={[1.14, 0.8, 0.05]} position={[0, 0, -0.03]} castShadow />
        <mesh geometry={G.plane} material={textMat(tex)} scale={[1.06, 0.72, 1]} />
      </group>
      <mesh ref={glow} geometry={G.cyl} material={glowMat} position={[0, 0.05, 0]} scale={[1.55, 0.02, 1.55]} />
    </group>
  )
}

function AIRing() {
  const panels = useRef<(Mesh | null)[]>([])
  const st = useRef({ inside: 0, t: 0 })
  const texes = useMemo(
    () => AI_WORKFLOW.map((label, i) => {
      const human = AI_HUMAN_STEPS.has(label)
      return textTexture({
        w: 256, h: 150, bg: human ? '#f7f4ef' : '#fff5ec', border: human ? '#2b2e34' : '#ec7a2c', align: 'center', pad: 18,
        lines: [
          { text: String(i + 1).padStart(2, '0'), size: 24, weight: 700, color: '#ec7a2c', gap: 2 },
          { text: label.toUpperCase(), size: label.length > 13 ? 21 : 25, weight: 700, color: '#1f2328', gap: 4 },
          { text: human ? 'HUMAN DECIDES' : 'AI ASSISTS', size: 15, weight: 650, color: human ? '#2b2e34' : '#b85a1c' },
        ],
      })
    }),
    [],
  )
  const glowMats = useMemo(() => AI_WORKFLOW.map(() => new MeshBasicMaterial({ color: '#ffb570', transparent: true, opacity: 0, depthWrite: false })), [])
  useFrame((_, dt) => {
    const s = st.current
    const d = distTo(AI_AREA[0], AI_AREA[1])
    s.inside = easeTo(s.inside, d < 6.5 ? 1 : 0, dt, 3)
    s.t += dt
    const active = Math.floor(s.t * 0.8) % AI_WORKFLOW.length
    glowMats.forEach((m, i) => {
      const on = i === active ? 1 : i === (active + AI_WORKFLOW.length - 1) % AI_WORKFLOW.length ? 0.35 : 0
      m.opacity = easeTo(m.opacity, on * s.inside * 0.8, dt, 6)
      const p = panels.current[i]
      if (p) p.position.y = 1.55 + (i === active ? 0.06 : 0) * s.inside
    })
  })
  return (
    <group position={[AI_AREA[0], 0.4, AI_AREA[1]]}>
      {AI_WORKFLOW.map((_, i) => {
        // panels sit between the gazebo posts, facing the centre
        const a = (i / AI_WORKFLOW.length) * Math.PI * 2 + Math.PI / 4
        const r = 2.25
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation-y={Math.atan2(-Math.cos(a), -Math.sin(a))}>
            <mesh ref={(m) => { panels.current[i] = m }} geometry={G.plane} material={textMat(texes[i])} position={[0, 1.55, 0]} scale={[0.82, 0.48, 1]} />
            <mesh geometry={G.box} material={mat('#2b2e34', 0.5)} position={[0, 1.55, -0.03]} scale={[0.86, 0.52, 0.03]} />
            <mesh geometry={G.plane} material={glowMats[i]} position={[0, 1.55, -0.05]} scale={[1.2, 0.8, 1]} />
          </group>
        )
      })}
      <mesh geometry={G.cyl} material={mat('#f6ecdc', 0.6)} position={[0, 0.5, 0]} scale={[0.6, 1.0, 0.6]} castShadow />
      <mesh geometry={G.plane} material={textMat(textTexture({ w: 300, h: 120, bg: '#2a1c14', align: 'center', pad: 18, lines: [{ text: 'AI HELPS ME EXPLORE', size: 20, weight: 700, color: '#ffd9b3', gap: 2 }, { text: 'I MAKE THE DECISIONS', size: 24, weight: 800, color: '#ffffff' }] }))} position={[0, 1.05, 0.305]} scale={[0.56, 0.22, 1]} />
    </group>
  )
}

function ActivityObjects() {
  const cover = useRef<Mesh>(null!)
  const lid = useRef<Group>(null!)
  const screen = useRef<MeshBasicMaterial>(null!)
  const sculpt = useRef<Group>(null!)
  const flash = useRef<MeshBasicMaterial>(null!)
  const st = useRef({ book: 0, lid: 0, spin: 0, flashT: 0 })
  const L = ACTIVITY_SPOTS
  useFrame((_, dt) => {
    const s = st.current
    s.book = easeTo(s.book, distTo(L.learning.pos[0], L.learning.pos[2]) < 2.6 ? 1 : 0, dt, 3)
    cover.current.rotation.z = -s.book * 2.9
    s.lid = easeTo(s.lid, distTo(L.uiux.pos[0], L.uiux.pos[2]) < 2.8 ? 1 : 0, dt, 3)
    lid.current.rotation.x = -0.1 - s.lid * 1.75
    screen.current.opacity = s.lid
    const near3d = distTo(L.interactive.pos[0], L.interactive.pos[2]) < 3.5
    s.spin += dt * (near3d ? 1.6 : 0.3)
    sculpt.current.rotation.y = s.spin
    sculpt.current.rotation.x = Math.sin(s.spin * 0.7) * 0.4
    if (distTo(L.visual.pos[0], L.visual.pos[2]) < 2.6) s.flashT += dt
    flash.current.opacity = s.flashT > 0 && s.flashT % 3.2 < 0.12 ? 0.95 : 0
  })
  const screenTex = useMemo(() => textTexture({ w: 256, h: 160, bg: '#f4f5f7', pad: 16, lines: [{ text: 'Wireframes → UI', size: 22, weight: 800, color: '#2f4a8a', gap: 6 }, { text: 'Hierarchy · spacing · states', size: 16, weight: 600, color: '#5d6b82' }] }), [])
  return (
    <>
      {/* learning: a book on the bench */}
      <group position={[L.learning.pos[0] + 0.3, 0.73, 22.35]}>
        <mesh geometry={G.box} material={mat('#f6f1e8')} scale={[0.34, 0.03, 0.24]} castShadow />
        <mesh ref={cover} geometry={G.box} material={mat('#7a3f3a')} position={[0, 0.02, 0]} scale={[0.36, 0.02, 0.25]} />
      </group>
      {/* visual exploration: camera on a tripod by the pond */}
      <group position={L.visual.pos} rotation-y={L.visual.yaw}>
        {[-0.5, 0.5, 0].map((a, i) => (
          <mesh key={i} geometry={G.cyl} material={mat('#3b3e44')} position={[Math.sin(a * 4) * 0.2, 0.6, i === 2 ? -0.22 : 0.12]} rotation={[i === 2 ? 0.3 : -0.15, 0, a * 0.5]} scale={[0.03, 1.2, 0.03]} />
        ))}
        <mesh geometry={G.box} material={mat('#2a2626', 0.4)} position={[0, 1.28, 0]} scale={[0.26, 0.17, 0.12]} castShadow />
        <mesh geometry={G.cyl} material={mat('#1f1f22', 0.3)} position={[0, 1.28, 0.1]} rotation-x={Math.PI / 2} scale={[0.1, 0.1, 0.1]} />
        <mesh geometry={G.plane} position={[0.08, 1.37, 0.07]} scale={[0.07, 0.04, 1]}>
          <meshBasicMaterial ref={flash} color={new Color(3, 3, 3)} transparent opacity={0} />
        </mesh>
      </group>
      {/* UI/UX design: laptop on the picnic table */}
      <group position={[L.uiux.pos[0], 0.99, L.uiux.pos[2]]}>
        <mesh geometry={G.box} material={mat('#c9ccd2', 0.35)} scale={[0.4, 0.02, 0.28]} castShadow />
        <group ref={lid} position={[0, 0.01, -0.14]}>
          <mesh geometry={G.box} material={mat('#c9ccd2', 0.35)} position={[0, 0.14, 0]} scale={[0.4, 0.28, 0.015]} />
          <mesh geometry={G.plane} position={[0, 0.14, 0.009]} scale={[0.36, 0.24, 1]}>
            <meshBasicMaterial ref={screen} map={screenTex} transparent opacity={0} toneMapped />
          </mesh>
        </group>
      </group>
      {/* interactive design: a slowly turning sculpture on the lookout deck */}
      <group position={[L.interactive.pos[0], L.interactive.pos[1], L.interactive.pos[2]]}>
        <mesh geometry={G.cyl} material={mat('#e9e0cf', 0.7)} position={[0, 0.35, 0]} scale={[0.6, 0.7, 0.6]} castShadow />
        <group ref={sculpt} position={[0, 1.15, 0]}>
          <mesh geometry={G.torus} material={mat('#2f4a8a', 0.35)} scale={0.7} castShadow />
          <mesh geometry={G.torus} material={mat('#c27a60', 0.35)} rotation-x={Math.PI / 2} scale={0.55} castShadow />
          <mesh geometry={G.box} material={mat('#c49a4e', 0.35)} rotation={[0.6, 0.6, 0]} scale={0.22} castShadow />
        </group>
      </group>
    </>
  )
}

// ── Interiors ───────────────────────────────────────────────────────────────
function useRoomPos(room: InteriorId, x: number, z: number, y = 0) {
  return useMemo(() => roomToWorld(room, x, z, y), [room, x, z, y])
}

function Timeline() {
  const plaques = useRef<(Group | null)[]>([])
  const base = useRoomPos('education', -11.9, 0, 0)
  const texes = useMemo(
    () => EDUCATION_TIMELINE.map((it, i) => textTexture({
      w: 300, h: 260, bg: '#faf6ef', border: '#4f6b58', pad: 20,
      lines: [
        { text: `STEP ${i + 1}`, size: 22, weight: 800, color: '#4f6b58', gap: 2 },
        { text: it.label.toUpperCase(), size: 28, weight: 800, color: '#24262c', gap: 10 },
        { text: it.text, size: 19, weight: 500, color: it.placeholder ? '#8a5a22' : '#4b4f57' },
      ],
    })),
    [],
  )
  const zs = [-5.6, -2.8, 0, 2.8, 5.6]
  useFrame((_, dt) => {
    const p = playerRuntime.position
    zs.forEach((z, i) => {
      const g = plaques.current[i]
      if (!g) return
      const d = Math.hypot(p.x - (base[0] + 1.6), p.z - (base[2] + z))
      const on = d < 2.4 ? 1 : 0
      g.position.z = easeTo(g.position.z, 0.06 + on * 0.12, dt, 6)
      g.scale.setScalar(easeTo(g.scale.x, 1 + on * 0.08, dt, 6))
    })
  })
  return (
    <group position={base} rotation-y={Math.PI / 2}>
      {zs.map((z, i) => (
        <group key={i} position={[-z, 1.75, 0.06]} ref={(g) => { plaques.current[i] = g }}>
          <mesh geometry={G.box} material={mat('#4f6b58')} position={[0, 0, -0.03]} scale={[1.36, 1.2, 0.04]} />
          <mesh geometry={G.plane} material={textMat(texes[i])} scale={[1.28, 1.11, 1]} />
          <mesh geometry={G.cyl} material={mat('#c49a4e', 0.4)} position={[0, 0.8, -0.02]} rotation-x={Math.PI / 2} scale={[0.14, 0.04, 0.14]} />
        </group>
      ))}
    </group>
  )
}

function Chalkboard() {
  const writing = useRef<Mesh>(null!)
  const pos = useRoomPos('education', 6, -8.83, 1.85)
  const st = useRef({ p: 0 })
  const tex = useMemo(() => {
    const t = textTexture({
      w: 640, h: 200, bg: '#2f3f38', pad: 22,
      lines: [
        { text: 'DESIGN FOUNDATIONS', size: 34, weight: 800, color: '#f1efe6', gap: 8 },
        { text: 'Hierarchy · Typography · Colour · Layout · Usability', size: 24, weight: 500, color: '#dfe6d8', gap: 6 },
        { text: '[ADD WHAT YOU STUDIED]', size: 22, weight: 500, color: '#e3c28a' },
      ],
    })
    return t
  }, [])
  const m = useMemo(() => new MeshBasicMaterial({ map: tex.clone(), toneMapped: true }), [tex])
  useFrame((_, dt) => {
    const s = st.current
    const d = distTo(pos[0], pos[2] + 3.5)
    s.p = easeTo(s.p, d < 4.2 ? 1 : 0, dt, 1.4)
    const p = Math.max(0.001, s.p)
    // wipe-reveal: the text "writes" from left to right
    m.map!.repeat.set(p, 1)
    writing.current.scale.set(6 * p, 1.85, 1)
    writing.current.position.x = pos[0] - 3 + 3 * p
  })
  return <mesh ref={writing} geometry={G.plane} material={m} position={[pos[0], pos[1], pos[2]]} />
}

function OpenBook({ room, x, z, y, color = '#7a3f3a' }: { room: InteriorId; x: number; z: number; y: number; color?: string }) {
  const pos = useRoomPos(room, x, z, y)
  const cover = useRef<Mesh>(null!)
  const st = useRef({ a: 0 })
  useFrame((_, dt) => {
    st.current.a = easeTo(st.current.a, distTo(pos[0], pos[2]) < 2.4 ? 1 : 0, dt, 3)
    cover.current.rotation.z = -st.current.a * 2.95
  })
  return (
    <group position={pos}>
      <mesh geometry={G.box} material={mat('#f6f1e8')} scale={[0.36, 0.04, 0.26]} castShadow />
      <group>
        <mesh ref={cover} geometry={G.box} material={mat(color)} position={[0, 0.025, 0]} scale={[0.38, 0.02, 0.27]} />
      </group>
    </group>
  )
}

function Certificates() {
  const frames = useRef<(Group | null)[]>([])
  const base = useRoomPos('education', 11.92, 1.4, 0)
  const tex = useMemo(() => textTexture({ w: 256, h: 190, bg: '#fbf7ee', border: '#c49a4e', align: 'center', pad: 26, lines: [{ text: 'CERTIFICATE', size: 26, weight: 800, color: '#6e5140', gap: 12 }, { text: '[ADD CERTIFICATION]', size: 18, weight: 600, color: '#8a5a22' }] }), [])
  useFrame((_, dt) => {
    const p = playerRuntime.position
    ;[-1.6, 0, 1.6].forEach((dz, i) => {
      const g = frames.current[i]
      if (!g) return
      const on = Math.hypot(p.x - (base[0] - 1.8), p.z - (base[2] + dz)) < 2 ? 1 : 0
      g.scale.setScalar(easeTo(g.scale.x, 1 + on * 0.12, dt, 6))
      g.position.z = easeTo(g.position.z, 0.05 + on * 0.12, dt, 6)
    })
  })
  return (
    <group position={base} rotation-y={-Math.PI / 2}>
      {[-1.6, 0, 1.6].map((dz, i) => (
        <group key={i} position={[dz, 1.75, 0.05]} ref={(g) => { frames.current[i] = g }}>
          <mesh geometry={G.box} material={mat('#6e5140')} position={[0, 0, -0.03]} scale={[1.12, 0.86, 0.04]} />
          <mesh geometry={G.plane} material={textMat(tex)} scale={[1.02, 0.76, 1]} />
        </group>
      ))}
    </group>
  )
}

function Bell() {
  const pos = useRoomPos('education', -3.2, 8.8, 2.2)
  const bell = useRef<Group>(null!)
  useFrame(() => {
    const t = (performance.now() - storyEvents.bellAt) / 1000
    bell.current.rotation.x = t < 2.5 ? Math.sin(t * 14) * 0.6 * Math.exp(-t * 1.6) : 0
  })
  return (
    <group position={pos} rotation-y={Math.PI}>
      <mesh geometry={G.box} material={mat('#6e5140')} position={[0, 0.15, 0.1]} scale={[0.08, 0.4, 0.2]} />
      <group ref={bell} position={[0, 0.3, 0.25]}>
        <mesh geometry={G.cyl} material={mat('#c49a4e', 0.3)} position={[0, -0.18, 0]} scale={[0.3, 0.3, 0.3]} castShadow />
        <mesh geometry={G.cyl} material={mat('#c49a4e', 0.3)} position={[0, -0.34, 0]} scale={[0.38, 0.04, 0.38]} />
      </group>
    </group>
  )
}

function HomeProps() {
  const lid = useRef<Group>(null!)
  const screen = useRef<MeshBasicMaterial>(null!)
  const curtainL = useRef<Mesh>(null!)
  const curtainR = useRef<Mesh>(null!)
  const book = useRef<Mesh>(null!)
  const frames = useRef<(Group | null)[]>([])
  const st = useRef({ lid: 0, cur: 0, book: 0 })
  const hw = INTERIORS.home.width / 2
  const hd = INTERIORS.home.depth / 2
  const laptop = useRoomPos('home', 1.1, -hd + 0.8, 0.79)
  const win = useRoomPos('home', -4.8, -hd + 0.1, 1.9)
  const shelf = useRoomPos('home', -hw + 0.3, -0.4, 1.4)
  const journey = useRoomPos('home', hw - 0.08, -2.2, 1.7)
  const hello = useRoomPos('home', 1.4, 3.9, 0.8)
  const helloTex = useMemo(() => textTexture({ w: 300, h: 220, bg: '#faf6ef', border: '#b06a4c', align: 'center', pad: 26, lines: [{ text: 'HELLO!', size: 34, weight: 800, color: '#b06a4c', gap: 6 }, { text: `I’m ${PROFILE.name}`, size: 30, weight: 700, color: '#24262c', gap: 4 }, { text: `${PROFILE.role} · ${PROFILE.experience}`, size: 18, weight: 600, color: '#5c4535' }] }), [])
  const screenTex = useMemo(() => textTexture({ w: 256, h: 160, bg: '#1f2430', pad: 16, lines: [{ text: 'MY DESIGN TOOLS', size: 20, weight: 800, color: '#ffffff', gap: 8 }, { text: '[ADD YOUR TOOLS]', size: 18, weight: 600, color: '#e3c28a' }] }), [])
  const journeyTex = useMemo(() => ['Now · ' + PROFILE.company, '[ADD EARLIER ROLE]', '[ADD FIRST STEP]'].map((t, i) => textTexture({ w: 220, h: 160, bg: '#faf6ef', border: '#5c4535', align: 'center', pad: 22, lines: [{ text: `0${3 - i}`, size: 26, weight: 800, color: '#b06a4c', gap: 6 }, { text: t, size: 18, weight: 600, color: /\[/.test(t) ? '#8a5a22' : '#24262c' }] })), [])
  useFrame((_, dt) => {
    const s = st.current
    s.lid = easeTo(s.lid, distTo(laptop[0], laptop[2] + 1.6) < 2.2 ? 1 : 0, dt, 3)
    lid.current.rotation.x = -0.12 - s.lid * 1.7
    screen.current.opacity = s.lid
    s.cur = easeTo(s.cur, distTo(win[0], win[2] + 1.8) < 2.4 ? 1 : 0, dt, 2)
    curtainL.current.position.x = win[0] - 0.55 - s.cur * 0.55
    curtainR.current.position.x = win[0] + 0.55 + s.cur * 0.55
    s.book = easeTo(s.book, distTo(shelf[0] + 1.3, shelf[2]) < 2.3 ? 1 : 0, dt, 4)
    book.current.position.x = shelf[0] + s.book * 0.2
    const p = playerRuntime.position
    frames.current.forEach((g, i) => {
      if (!g) return
      const on = Math.hypot(p.x - (journey[0] - 1.6), p.z - (journey[2] + (i - 1) * 1.1)) < 1.6 ? 1 : 0
      g.scale.setScalar(easeTo(g.scale.x, 1 + on * 0.12, dt, 6))
    })
  })
  return (
    <>
      <group position={laptop}>
        <mesh geometry={G.box} material={mat('#c9ccd2', 0.35)} scale={[0.36, 0.018, 0.25]} castShadow />
        <group ref={lid} position={[0, 0.01, -0.125]}>
          <mesh geometry={G.box} material={mat('#c9ccd2', 0.35)} position={[0, 0.125, 0]} scale={[0.36, 0.25, 0.012]} />
          <mesh geometry={G.plane} position={[0, 0.125, 0.008]} scale={[0.33, 0.21, 1]}>
            <meshBasicMaterial ref={screen} map={screenTex} transparent opacity={0} />
          </mesh>
        </group>
      </group>
      <mesh ref={curtainL} geometry={G.box} material={mat('#ece2d2', 0.95)} position={[win[0] - 0.55, win[1], win[2] + 0.12]} scale={[1.0, 1.9, 0.03]} />
      <mesh ref={curtainR} geometry={G.box} material={mat('#ece2d2', 0.95)} position={[win[0] + 0.55, win[1], win[2] + 0.12]} scale={[1.0, 1.9, 0.03]} />
      <mesh ref={book} geometry={G.box} material={mat('#2f4a8a')} position={[shelf[0], shelf[1], shelf[2]]} scale={[0.26, 0.3, 0.07]} />
      <group position={journey} rotation-y={-Math.PI / 2}>
        {journeyTex.map((t, i) => (
          <group key={i} position={[(i - 1) * 1.1, 0, 0.04]} ref={(g) => { frames.current[i] = g }}>
            <mesh geometry={G.box} material={mat('#2a2626')} position={[0, 0, -0.02]} scale={[0.92, 0.7, 0.03]} />
            <mesh geometry={G.plane} material={textMat(t)} scale={[0.86, 0.63, 1]} />
          </group>
        ))}
      </group>
      <group position={hello} rotation-y={Math.PI + 0.35}>
        <mesh geometry={G.box} material={mat('#6e5140')} position={[0, 0.2, -0.03]} rotation-x={-0.25} scale={[0.66, 0.5, 0.03]} />
        <mesh geometry={G.plane} material={textMat(helloTex)} position={[0, 0.2, 0]} rotation-x={-0.25} scale={[0.6, 0.44, 1]} />
      </group>
    </>
  )
}

/** one board of the Growth Walk: the drawing matures from pencil sketch to polished product */
function stageArt(i: number) {
  const st = CAREER_STAGES[i]
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 380
  const g = c.getContext('2d')!
  const dark = i >= 5
  g.fillStyle = i === 0 ? '#f3eee2' : dark ? '#1c1f25' : '#f7f4ef'
  g.fillRect(0, 0, 512, 380)
  const ink = dark ? '#f3efe7' : '#1f2328'
  const soft = dark ? 'rgba(243,239,231,0.55)' : 'rgba(31,35,40,0.45)'
  const accent = '#ec7a2c'
  const rr = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    g.fillStyle = fill
    g.beginPath()
    g.roundRect(x, y, w, h, r)
    g.fill()
  }
  // a fixed wobble so the sketch never changes between visits
  let seed = 11 + i
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // header
  g.fillStyle = accent
  g.font = `700 22px ${UI_FONT}`
  g.fillText(st.n, 28, 44)
  g.fillStyle = ink
  g.font = `640 30px ${UI_FONT}`
  g.fillText(st.title.toUpperCase(), 68, 44)
  const X = 28
  const Y = 70
  g.lineCap = 'round'
  g.lineJoin = 'round'
  switch (i) {
    case 0: {
      // pencil sketch: wobbly frames and scribbles
      g.strokeStyle = 'rgba(60,60,60,0.7)'
      g.lineWidth = 2
      const wob = (x: number, y: number, w: number, h: number) => {
        g.beginPath()
        g.moveTo(x + rnd() * 3, y)
        g.lineTo(x + w, y + rnd() * 4)
        g.lineTo(x + w - rnd() * 3, y + h)
        g.lineTo(x, y + h - rnd() * 4)
        g.closePath()
        g.stroke()
      }
      wob(X + 20, Y + 20, 200, 220)
      wob(X + 250, Y + 20, 180, 100)
      wob(X + 250, Y + 140, 180, 100)
      for (let k = 0; k < 5; k++) {
        g.beginPath()
        g.moveTo(X + 40, Y + 60 + k * 30)
        g.bezierCurveTo(X + 90, Y + 50 + k * 30, X + 130, Y + 75 + k * 30, X + 190, Y + 60 + k * 30)
        g.stroke()
      }
      break
    }
    case 1: {
      // first UI: plain grey boxes
      rr(X + 20, Y + 10, 440, 36, 2, '#c9c6bf')
      rr(X + 20, Y + 60, 140, 180, 2, '#d8d5ce')
      for (let k = 0; k < 4; k++) rr(X + 180, Y + 60 + k * 46, 280, 34, 2, '#e1ded7')
      break
    }
    case 2: {
      // UX thinking: a person, a journey, insight points
      g.fillStyle = ink
      g.beginPath()
      g.arc(X + 70, Y + 80, 26, 0, Math.PI * 2)
      g.fill()
      rr(X + 38, Y + 112, 64, 70, 30, ink)
      g.strokeStyle = accent
      g.lineWidth = 4
      g.setLineDash([10, 10])
      g.beginPath()
      g.moveTo(X + 130, Y + 130)
      g.bezierCurveTo(X + 220, Y + 40, X + 300, Y + 220, X + 440, Y + 110)
      g.stroke()
      g.setLineDash([])
      for (const [px, py] of [[X + 200, Y + 90], [X + 300, Y + 160], [X + 420, Y + 115]]) {
        g.fillStyle = '#f7f4ef'
        g.beginPath()
        g.arc(px, py, 12, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = ink
        g.lineWidth = 3
        g.stroke()
      }
      break
    }
    case 3: {
      // systems: a tidy component sheet on a grid
      const cols = ['#25365a', '#ec7a2c', '#9cb88a', '#d8c9a8']
      cols.forEach((col, k) => rr(X + 20 + k * 60, Y + 10, 48, 48, 10, col))
      rr(X + 20, Y + 80, 150, 40, 20, '#25365a')
      rr(X + 185, Y + 80, 150, 40, 20, 'rgba(37,54,90,0.12)')
      rr(X + 20, Y + 140, 315, 40, 8, 'rgba(31,35,40,0.08)')
      rr(X + 20, Y + 195, 96, 40, 8, 'rgba(31,35,40,0.08)')
      rr(X + 128, Y + 195, 96, 40, 8, 'rgba(31,35,40,0.08)')
      rr(X + 236, Y + 195, 99, 40, 8, 'rgba(31,35,40,0.08)')
      g.strokeStyle = soft
      g.lineWidth = 1
      for (let gx = X + 360; gx < X + 460; gx += 16) {
        g.beginPath()
        g.moveTo(gx, Y + 10)
        g.lineTo(gx, Y + 235)
        g.stroke()
      }
      break
    }
    case 4: {
      // real product: a polished app screen
      rr(X + 20, Y + 5, 440, 240, 16, '#ffffff')
      rr(X + 20, Y + 5, 440, 44, 16, '#25365a')
      rr(X + 40, Y + 66, 190, 110, 12, 'rgba(236,122,44,0.16)')
      rr(X + 250, Y + 66, 190, 50, 12, 'rgba(31,35,40,0.07)')
      rr(X + 250, Y + 126, 190, 50, 12, 'rgba(31,35,40,0.07)')
      rr(X + 40, Y + 192, 400, 36, 10, '#ec7a2c')
      break
    }
    case 5: {
      // interaction: a phone with motion arcs
      rr(X + 150, Y, 150, 250, 26, '#f3efe7')
      rr(X + 165, Y + 30, 120, 70, 12, accent)
      rr(X + 165, Y + 112, 120, 30, 8, 'rgba(31,35,40,0.14)')
      rr(X + 165, Y + 150, 120, 30, 8, 'rgba(31,35,40,0.14)')
      g.strokeStyle = accent
      g.lineWidth = 3
      for (const r of [40, 62, 84]) {
        g.globalAlpha = 1 - r / 110
        g.beginPath()
        g.arc(X + 340, Y + 70, r, -0.8, 0.8)
        g.stroke()
      }
      g.globalAlpha = 1
      break
    }
    case 6: {
      // AI-assisted: variations fanned out, one chosen by a human
      for (let k = 0; k < 5; k++) {
        g.save()
        g.translate(X + 230, Y + 250)
        g.rotate((k - 2) * 0.22)
        rr(-60, -210, 120, 160, 12, k === 2 ? '#f3efe7' : 'rgba(243,239,231,0.18)')
        g.restore()
      }
      g.fillStyle = accent
      g.beginPath()
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        const r = k % 2 ? 10 : 28
        g.lineTo(X + 400 + Math.cos(a) * r, Y + 50 + Math.sin(a) * r)
      }
      g.fill()
      break
    }
    default: {
      // today: the signature
      g.fillStyle = ink
      g.font = `640 64px ${UI_FONT}`
      g.fillText(PROFILE.name, X + 12, Y + 110)
      g.fillStyle = accent
      g.fillRect(X + 14, Y + 132, 60, 4)
      g.fillStyle = soft
      g.font = `600 22px ${UI_FONT}`
      g.fillText(PROFILE.role.toUpperCase(), X + 14, Y + 176)
      g.fillText(PROFILE.experience.toUpperCase(), X + 14, Y + 208)
    }
  }
  g.fillStyle = soft
  g.font = `500 21px ${UI_FONT}`
  g.fillText(st.line, 28, 352)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Growth Walk boards: they brighten and turn slightly toward you as you walk up. */
function GrowthWalk() {
  const boards = useRef<(Group | null)[]>([])
  const mats = useMemo(() => CAREER_STAGES.map((_, i) => new MeshBasicMaterial({ map: stageArt(i), color: new Color(0.86, 0.86, 0.86) })), [])
  useFrame((_, dt) => {
    GROWTH_WALK.forEach(([x, z], i) => {
      const b = boards.current[i]
      if (!b) return
      const near = distTo(x, z) < 3.6 ? 1 : 0
      mats[i].color.setScalar(easeTo(mats[i].color.r, 0.86 + near * 0.16, dt, 4))
      b.rotation.x = easeTo(b.rotation.x, -near * 0.06, dt, 4)
      b.position.y = easeTo(b.position.y, 1.2 + near * 0.04, dt, 4)
    })
  })
  return (
    <>
      {GROWTH_WALK.map(([x, z], i) => (
        <group key={i} position={[x, 0.15, z]} rotation-y={GROWTH_YAW}>
          <group ref={(g) => { boards.current[i] = g }} position={[0, 1.2, i >= 5 ? 0.0 : 0.09]}>
            <mesh geometry={G.plane} material={mats[i]} scale={[1.22, 0.9, 1]} />
          </group>
        </group>
      ))}
    </>
  )
}

/**
 * Home · skill wall: one tile per tool / practice (TOOLS). The wall brightens
 * as you approach and the column you stand in front of steps forward.
 */
function SkillWall() {
  const hw = INTERIORS.home.width / 2
  const origin = useRoomPos('home', -hw + 0.12, 3.9, 0)
  const tiles = useRef<(Mesh | null)[]>([])
  const res = useMemo(() => {
    const dot = { tool: '#ec7a2c', code: '#7fa3d6', practice: '#9cb88a' }
    return TOOLS.map((t) => {
      const tex = textTexture({
        w: 256, h: 120, bg: '#1f2328', align: 'center', pad: 14,
        lines: [
          { text: t.name.toUpperCase(), size: t.name.length > 14 ? 22 : 26, weight: 700, color: '#f7f4ef', gap: 6 },
          { text: t.group === 'tool' ? 'TOOL' : t.group === 'code' ? 'CODE' : 'PRACTICE', size: 14, weight: 700, color: dot[t.group] },
        ],
      })
      return new MeshBasicMaterial({ map: tex, color: new Color(0.8, 0.8, 0.8) })
    })
  }, [])
  useFrame((_, dt) => {
    const p = playerRuntime.position
    const d = Math.hypot(p.x - origin[0], p.z - origin[2])
    const near = d < 3.4
    TOOLS.forEach((_, i) => {
      const m = tiles.current[i]
      if (!m) return
      const col = i % 4
      const tz = origin[2] + (col - 1.5) * 0.72
      const focus = near && Math.abs(p.z - tz) < 0.45 ? 1 : 0
      const mat = res[i]
      const want = near ? 1 + focus * 0.18 : 0.8
      mat.color.setScalar(easeTo(mat.color.r, want, dt, 5))
      m.position.z = easeTo(m.position.z, focus * 0.05, dt, 6)
    })
  })
  return (
    <group position={origin} rotation-y={Math.PI / 2}>
      {TOOLS.map((t, i) => {
        const col = i % 4
        const row = Math.floor(i / 4)
        return (
          <group key={t.name} position={[(col - 1.5) * 0.72, 2.1 - row * 0.38, 0]}>
            <mesh ref={(m) => { tiles.current[i] = m }} geometry={G.plane} material={res[i]} scale={[0.66, 0.31, 1]} />
          </group>
        )
      })}
    </group>
  )
}

function OfficeProps() {
  const plate = useRoomPos('office', 11, 2.72, 0.8)
  const tex = useMemo(() => textTexture({ w: 256, h: 80, bg: '#2e3035', align: 'center', pad: 18, lines: [{ text: PROFILE.name.toUpperCase(), size: 30, weight: 800, color: '#ffffff' }] }), [])
  return (
    <group position={plate} rotation-y={Math.PI}>
      <mesh geometry={G.box} material={mat('#2e3035')} rotation-x={-0.5} scale={[0.34, 0.1, 0.02]} />
      <mesh geometry={G.plane} material={textMat(tex)} position={[0, 0.004, 0.011]} rotation-x={-0.5} scale={[0.32, 0.09, 1]} />
    </group>
  )
}

/** Canvas for a studio screen: title card + an abstract interface sketch (no invented content). */
function screenTexture(p: ProjectDef) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 592
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 1024, 592)
  grad.addColorStop(0, '#111317')
  grad.addColorStop(1, p.accent + '55')
  g.fillStyle = '#111317'
  g.fillRect(0, 0, 1024, 592)
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 592)
  // left: the title card
  g.fillStyle = p.accent
  g.fillRect(64, 72, 44, 4)
  g.fillStyle = 'rgba(247,244,239,0.6)'
  g.font = `600 22px ${UI_FONT}`
  g.fillText(`PROJECT ${p.number}`, 64, 122)
  g.fillStyle = '#f7f4ef'
  let size = 84
  g.font = `640 ${size}px ${UI_FONT}`
  while (g.measureText(p.title).width > 470 && size > 40) g.font = `640 ${(size -= 4)}px ${UI_FONT}`
  g.fillText(p.title, 60, 214)
  g.fillStyle = 'rgba(247,244,239,0.7)'
  g.font = `500 24px ${UI_FONT}`
  g.fillText(isPlaceholder(p.category) ? 'Case study' : p.category, 64, 262)
  g.fillStyle = 'rgba(247,244,239,0.45)'
  g.font = `600 18px ${UI_FONT}`
  g.fillText('OVERVIEW · CHALLENGE · PROCESS · UI · PROTOTYPE · OUTCOME', 64, 520)
  // right: an abstract product frame in the project accent
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath()
    g.roundRect(x, y, w, h, r)
    g.fill()
  }
  g.fillStyle = 'rgba(247,244,239,0.94)'
  rr(600, 70, 360, 440, 22)
  g.fillStyle = p.accent
  rr(624, 96, 312, 64, 12)
  g.fillStyle = 'rgba(17,19,23,0.1)'
  for (let i = 0; i < 3; i++) rr(624, 180 + i * 72, 312, 56, 10)
  g.fillStyle = p.accent + '88'
  rr(624, 400, 148, 84, 10)
  g.fillStyle = 'rgba(17,19,23,0.16)'
  rr(788, 400, 148, 84, 10)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * Project Studio screens: dark until you walk up, then they wake with a soft
 * fade (and a faint hum); the open project's screen glows a touch brighter.
 */
function StudioScreens() {
  const mats = useMemo(() => PROJECTS.map((p) => new MeshBasicMaterial({ map: screenTexture(p), color: new Color(0.06, 0.06, 0.07) })), [])
  const st = useRef(PROJECTS.map(() => ({ on: 0, woke: false })))
  const bays = useMemo(() => PROJECTS.map((_, i) => {
    const b = studioBay(i)
    return { ...b, world: roomToWorld('office', b.screen[0], b.screen[1], 1.62), stand: roomToWorld('office', b.stand[0], b.stand[1]) }
  }), [])
  useFrame((_, dt) => {
    const active = useGameStore.getState().activeProjectId
    PROJECTS.forEach((p, i) => {
      const s = st.current[i]
      const d = distTo(bays[i].stand[0], bays[i].stand[2])
      const want = active === p.id ? 1.12 : d < 4.4 ? 1 : 0.06
      if (want >= 1 && !s.woke) {
        s.woke = true
        soundManager.play('screen', { volume: 0.7 })
      }
      if (want < 1 && d > 6) s.woke = false
      s.on = easeTo(s.on, want, dt, want > s.on ? 2.6 : 1.6)
      mats[i].color.setScalar(Math.max(0.06, s.on))
    })
  })
  return (
    <>
      {bays.map((b, i) => (
        <group key={PROJECTS[i].id} position={b.world} rotation-y={b.yaw}>
          <mesh geometry={G.plane} material={mats[i]} position={[0, 0, 0.018]} scale={[2.6, 1.5, 1]} />
        </group>
      ))}
    </>
  )
}

/**
 * All story objects. Interior props only mount while the player is inside
 * that room (they're far away otherwise), keeping per-frame work minimal.
 */
export function StoryProps() {
  const interior = useGameStore((s) => s.interior)
  return (
    <>
      {!interior && (
        <>
          {PROCESS_STATIONS.map((_, i) => <ProcessBoard key={i} index={i} />)}
          <AIRing />
          <ActivityObjects />
          <GrowthWalk />
        </>
      )}
      {interior === 'education' && (
        <>
          <Timeline />
          <Chalkboard />
          <OpenBook room="education" x={-6} z={-4.8} y={0.79} />
          <Certificates />
          <Bell />
        </>
      )}
      {interior === 'home' && (
        <>
          <HomeProps />
          <SkillWall />
        </>
      )}
      {interior === 'office' && (
        <>
          <OfficeProps />
          <StudioScreens />
        </>
      )}
    </>
  )
}
