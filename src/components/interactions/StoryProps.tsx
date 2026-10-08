import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, type Group, type Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, TorusGeometry,
} from 'three'
import { playerRuntime } from '@/core/runtime'
import { AI_AREA, ACTIVITY_SPOTS, GALLERY_EASELS } from '@/data/locations'
import { AI_WORKFLOW, CERTIFICATION, EDUCATION, GALLERY, PROFILE, SKILL_GROUPS, TOOLS } from '@/data/portfolioContent'
import { asset } from '@/utils/basePath'
import { INTERIORS, roomToWorld, studioBay, type InteriorId } from '@/data/interiors'
import { PROJECTS, type ProjectDef } from '@/data/projects'
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

// ── Gallery park ────────────────────────────────────────────────────────────
/** a texture of a real image from /public, cropped to the given aspect (cover) */
const imageCache = new Map<string, CanvasTexture>()
function imageTexture(src: string, w: number, h: number) {
  const key = `${src}-${w}x${h}`
  const hit = imageCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#f2efe9'
  g.fillRect(0, 0, w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  const img = new Image()
  img.onload = () => {
    // top-aligned cover crop: the case-study frames lead with the UI
    const s = Math.max(w / img.width, h / img.height)
    g.drawImage(img, (w - img.width * s) / 2, 0, img.width * s, img.height * s)
    t.needsUpdate = true
  }
  img.src = asset(src)
  imageCache.set(key, t)
  return t
}

/** One easel per project on the path: its first UI screen, title underneath. */
function Easel({ index }: { index: number }) {
  const e = GALLERY_EASELS[index]
  const [x, z] = e.at
  const p = PROJECTS.find((q) => q.id === e.project)!
  const board = useRef<Group>(null!)
  const glow = useRef<Mesh>(null!)
  const st = useRef({ a: 0 })
  const shot = useMemo(() => textMat(imageTexture(GALLERY[e.index].image, 480, 300)), [e.index])
  const label = useMemo(
    () => textMat(textTexture({ w: 480, h: 72, bg: '#1f2328', pad: 18, lines: [{ text: `${p.title.toUpperCase()}  ·  ${p.category}`, size: 22, weight: 700, color: '#f7f4ef' }] })),
    [p],
  )
  const glowMat = useMemo(() => new MeshBasicMaterial({ color: new Color(p.accent), transparent: true, opacity: 0, depthWrite: false }), [p])
  useFrame((_, dt) => {
    const s = st.current
    s.a = easeTo(s.a, distTo(x, z) < 3.6 ? 1 : 0, dt, 4)
    board.current.position.y = 1.25 + s.a * 0.12
    glowMat.opacity = s.a * 0.45
    glow.current.scale.setScalar(1 + s.a * 0.15)
  })
  return (
    // easels face south-east, toward the park entrance
    <group position={[x, 0.25, z]} rotation-y={0.5}>
      {[-0.42, 0.42].map((dx) => (
        <mesh key={dx} geometry={G.cyl} material={mat('#8a6a4c')} position={[dx, 0.75, -0.05]} rotation-z={dx > 0 ? -0.08 : 0.08} scale={[0.05, 1.5, 0.05]} castShadow />
      ))}
      <mesh geometry={G.cyl} material={mat('#8a6a4c')} position={[0, 0.7, -0.4]} rotation-x={0.4} scale={[0.04, 1.4, 0.04]} />
      <group ref={board} rotation-x={-0.12}>
        <mesh geometry={G.box} material={mat('#2b2e34', 0.5)} scale={[1.28, 0.96, 0.04]} position={[0, -0.04, -0.03]} castShadow />
        <mesh geometry={G.plane} material={shot} position={[0, 0.06, 0]} scale={[1.2, 0.75, 1]} />
        <mesh geometry={G.plane} material={label} position={[0, -0.41, 0]} scale={[1.2, 0.18, 1]} />
      </group>
      <mesh ref={glow} geometry={G.cyl} material={glowMat} position={[0, 0.05, 0]} scale={[1.55, 0.02, 1.55]} />
    </group>
  )
}

function AIRing() {
  const panels = useRef<(Mesh | null)[]>([])
  const st = useRef({ inside: 0, t: 0 })
  const texes = useMemo(
    () => AI_WORKFLOW.map((step) => {
      const human = !!step.human
      return textTexture({
        w: 256, h: 150, bg: human ? '#f7f4ef' : '#fff5ec', border: human ? '#2b2e34' : '#ec7a2c', align: 'center', pad: 16,
        lines: [
          { text: step.n, size: 22, weight: 700, color: '#ec7a2c', gap: 0 },
          { text: step.title.toUpperCase(), size: step.title.length > 12 ? 20 : 25, weight: 700, color: '#1f2328', gap: 4 },
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
  const screenTex = useMemo(() => textTexture({ w: 256, h: 160, bg: '#f4f5f7', pad: 16, lines: [{ text: 'Wireframes → UI', size: 22, weight: 800, color: '#2f4a8a', gap: 6 }, { text: 'Flows · hierarchy · states', size: 16, weight: 600, color: '#5d6b82' }] }), [])
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

/** Education · west wall: the two degrees from the résumé, lifting toward you as you approach. */
function Timeline() {
  const plaques = useRef<(Group | null)[]>([])
  const base = useRoomPos('education', -11.9, 0, 0)
  const texes = useMemo(() => EDUCATION.map((e, i) => degreeTexture(e, i)), [])
  // first degree on the left as you face the wall
  const zs = [1.9, -1.9]
  useFrame((_, dt) => {
    const p = playerRuntime.position
    zs.forEach((z, i) => {
      const g = plaques.current[i]
      if (!g) return
      const d = Math.hypot(p.x - (base[0] + 1.6), p.z - (base[2] + z))
      const on = d < 2.6 ? 1 : 0
      g.position.z = easeTo(g.position.z, 0.06 + on * 0.1, dt, 6)
      g.scale.setScalar(easeTo(g.scale.x, 1 + on * 0.05, dt, 6))
    })
  })
  return (
    <group position={base} rotation-y={Math.PI / 2}>
      {zs.map((z, i) => (
        <group key={i} position={[-z, 1.7, 0.06]} ref={(g) => { plaques.current[i] = g }}>
          <mesh geometry={G.box} material={mat('#4f6b58')} position={[0, 0, -0.03]} scale={[2.66, 1.66, 0.04]} />
          <mesh geometry={G.plane} material={textMat(texes[i])} scale={[2.56, 1.56, 1]} />
        </group>
      ))}
    </group>
  )
}

function degreeTexture(e: (typeof EDUCATION)[number], i: number) {
  return textTexture({
    w: 640, h: 390, bg: '#faf6ef', border: '#4f6b58', pad: 34,
    lines: [
      { text: `0${i + 1} · ${e.years}`, size: 24, weight: 800, color: '#4f6b58', gap: 10 },
      { text: e.degree, size: 40, weight: 800, color: '#24262c', gap: 2 },
      { text: e.field, size: 32, weight: 600, color: '#24262c', gap: 18 },
      { text: `${e.institution} · ${e.place}`, size: 24, weight: 500, color: '#4b4f57', gap: 10 },
      { text: `CGPA ${e.cgpa}`, size: 26, weight: 700, color: '#b06a4c' },
    ],
  })
}

function certificateTexture() {
  return textTexture({
    w: 560, h: 400, bg: '#fbf7ee', border: '#c49a4e', align: 'center', pad: 40,
    lines: [
      { text: 'CERTIFICATION', size: 24, weight: 800, color: '#8a5a22', gap: 22 },
      { text: CERTIFICATION.title, size: 36, weight: 800, color: '#24262c', gap: 16 },
      { text: CERTIFICATION.issuer, size: 26, weight: 600, color: '#4b4f57', gap: 10 },
      { text: CERTIFICATION.year, size: 26, weight: 700, color: '#6e5140' },
    ],
  })
}

function Chalkboard() {
  const writing = useRef<Mesh>(null!)
  const pos = useRoomPos('education', 6, -8.83, 1.85)
  const st = useRef({ p: 0 })
  const tex = useMemo(() => {
    const t = textTexture({
      w: 640, h: 200, bg: '#2f3f38', pad: 22,
      lines: [
        { text: 'COMPUTER SCIENCE', size: 34, weight: 800, color: '#f1efe6', gap: 8 },
        { text: EDUCATION.map((e) => `${e.short} ${e.years}`).join('  ·  '), size: 26, weight: 500, color: '#dfe6d8', gap: 6 },
        { text: `${CERTIFICATION.title} · ${CERTIFICATION.year}`, size: 22, weight: 500, color: '#e3c28a' },
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

/** Education · the one certificate, framed in the middle of its wall. */
function Certificates() {
  const frame = useRef<Group>(null!)
  const base = useRoomPos('education', 11.92, 1.4, 0)
  const tex = useMemo(certificateTexture, [])
  useFrame((_, dt) => {
    const p = playerRuntime.position
    const on = Math.hypot(p.x - (base[0] - 1.8), p.z - base[2]) < 2.4 ? 1 : 0
    frame.current.scale.setScalar(easeTo(frame.current.scale.x, 1 + on * 0.06, dt, 6))
    frame.current.position.z = easeTo(frame.current.position.z, 0.05 + on * 0.1, dt, 6)
  })
  return (
    <group position={base} rotation-y={-Math.PI / 2}>
      <group position={[0, 1.75, 0.05]} ref={frame}>
        <mesh geometry={G.box} material={mat('#6e5140')} position={[0, 0, -0.03]} scale={[1.72, 1.26, 0.05]} />
        <mesh geometry={G.plane} material={textMat(tex)} scale={[1.6, 1.14, 1]} />
      </group>
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
  const aiBoard = useRef<Group>(null!)
  const gallery = useRef<Group>(null!)
  const st = useRef({ lid: 0, cur: 0, book: 0 })
  const hw = INTERIORS.home.width / 2
  const hd = INTERIORS.home.depth / 2
  const laptop = useRoomPos('home', 1.1, -hd + 0.8, 0.79)
  const win = useRoomPos('home', -4.8, -hd + 0.1, 1.9)
  const shelf = useRoomPos('home', -hw + 0.3, -0.4, 1.4)
  const aiWall = useRoomPos('home', hw - 0.08, -2.2, 1.75)
  const galleryPos = useRoomPos('home', 6.8, -hd + 0.09, 1.72)
  const hello = useRoomPos('home', 1.4, 3.9, 0.8)
  const helloTex = useMemo(() => textTexture({ w: 300, h: 220, bg: '#faf6ef', border: '#b06a4c', align: 'center', pad: 24, lines: [{ text: 'HELLO!', size: 34, weight: 800, color: '#b06a4c', gap: 6 }, { text: `I’m ${PROFILE.fullName}`, size: 30, weight: 700, color: '#24262c', gap: 4 }, { text: PROFILE.role, size: 17, weight: 600, color: '#5c4535', gap: 2 }, { text: `${PROFILE.experience} · ${PROFILE.location}`, size: 15, weight: 500, color: '#7a6250' }] }), [])
  const screenTex = useMemo(() => textTexture({ w: 256, h: 160, bg: '#1f2430', pad: 16, lines: [{ text: 'MY DESIGN TOOLS', size: 20, weight: 800, color: '#ffffff', gap: 8 }, { text: TOOLS.slice(0, 4).join(' · '), size: 17, weight: 600, color: '#e3c28a' }] }), [])
  const aiTex = useMemo(aiWorkflowTexture, [])
  const galleryTex = useMemo(() => textTexture({
    w: 480, h: 340, bg: '#1f2328', align: 'center', pad: 34,
    lines: [
      { text: 'GALLERY', size: 22, weight: 800, color: '#e3c28a', gap: 16 },
      { text: 'Selected UI work', size: 38, weight: 800, color: '#f7f4ef', gap: 4 },
      { text: '& interests', size: 38, weight: 800, color: '#f7f4ef', gap: 18 },
      { text: 'In the park  →', size: 20, weight: 600, color: '#c9ccd2' },
    ],
  }), [])
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
    const onAi = distTo(aiWall[0] - 1.6, aiWall[2]) < 2.2 ? 1 : 0
    aiBoard.current.scale.setScalar(easeTo(aiBoard.current.scale.x, 1 + onAi * 0.04, dt, 6))
    const onGallery = distTo(galleryPos[0], galleryPos[2] + 2) < 2.2 ? 1 : 0
    gallery.current.scale.setScalar(easeTo(gallery.current.scale.x, 1 + onGallery * 0.06, dt, 6))
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
      {/* AI-assisted design: five steps, the last one human */}
      <group position={aiWall} rotation-y={-Math.PI / 2}>
        <group ref={aiBoard} position={[0, 0, 0.04]}>
          <mesh geometry={G.box} material={mat('#2a2626')} position={[0, 0, -0.02]} scale={[3.06, 1.16, 0.03]} />
          <mesh geometry={G.plane} material={textMat(aiTex)} scale={[3.0, 1.1, 1]} />
        </group>
      </group>
      {/* Gallery entry */}
      <group position={galleryPos} ref={gallery}>
        <mesh geometry={G.box} material={mat('#6e5140')} position={[0, 0, -0.02]} scale={[1.5, 1.1, 0.03]} />
        <mesh geometry={G.plane} material={textMat(galleryTex)} scale={[1.4, 1.0, 1]} />
      </group>
      <group position={hello} rotation-y={Math.PI + 0.35}>
        <mesh geometry={G.box} material={mat('#6e5140')} position={[0, 0.2, -0.03]} rotation-x={-0.25} scale={[0.66, 0.5, 0.03]} />
        <mesh geometry={G.plane} material={textMat(helloTex)} position={[0, 0.2, 0]} rotation-x={-0.25} scale={[0.6, 0.44, 1]} />
      </group>
    </>
  )
}

/** Home · the AI-assisted design board: headline, then the five steps in a row */
function aiWorkflowTexture() {
  const W = 1200
  const H = 440
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#faf6ef'
  g.fillRect(0, 0, W, H)
  g.textBaseline = 'top'
  g.fillStyle = '#ec7a2c'
  g.font = `800 22px ${UI_FONT}`
  g.fillText('AI-ASSISTED DESIGN', 48, 40)
  g.fillStyle = '#24262c'
  g.font = `800 42px ${UI_FONT}`
  g.fillText(PROFILE.ai, 48, 76)
  const cw = (W - 96 - 4 * 16) / 5
  AI_WORKFLOW.forEach((st, i) => {
    const x = 48 + i * (cw + 16)
    g.fillStyle = st.human ? '#24262c' : '#ffffff'
    g.beginPath()
    g.roundRect(x, 160, cw, 200, 16)
    g.fill()
    g.fillStyle = '#ec7a2c'
    g.font = `800 22px ${UI_FONT}`
    g.fillText(st.n, x + 18, 180)
    g.fillStyle = st.human ? '#ffffff' : '#24262c'
    g.font = `800 ${st.title.length > 10 ? 22 : 26}px ${UI_FONT}`
    g.fillText(st.title, x + 18, 214)
    g.fillStyle = st.human ? '#d8d4cc' : '#5c5f66'
    g.font = `500 17px ${UI_FONT}`
    let y = 256
    let line = ''
    for (const w of st.text.split(' ')) {
      const t = line ? `${line} ${w}` : w
      if (g.measureText(t).width > cw - 36 && line) {
        g.fillText(line, x + 18, y)
        y += 22
        line = w
      } else line = t
    }
    g.fillText(line, x + 18, y)
  })
  g.fillStyle = '#7a6250'
  g.font = `600 19px ${UI_FONT}`
  g.fillText('AI accelerates exploration. Human judgment drives the final experience.', 48, 386)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

/**
 * Home · skill wall: one column per résumé group (UX, UI, Systems, Tools,
 * Front-end), a header tile on top. The wall brightens as you approach and
 * the column you stand in front of steps forward.
 */
const SKILL_COL = 0.62
const SKILL_ROW = 0.16
function SkillWall() {
  const hw = INTERIORS.home.width / 2
  const origin = useRoomPos('home', -hw + 0.12, 3.9, 0)
  const cols = useRef<(Group | null)[]>([])
  const res = useMemo(() => SKILL_GROUPS.map((grp) => {
    const head = new MeshBasicMaterial({ map: textTexture({ w: 256, h: 64, bg: '#ec7a2c', align: 'center', pad: 16, lines: [{ text: grp.short.toUpperCase(), size: 26, weight: 800, color: '#1f2328' }] }), color: new Color(0.8, 0.8, 0.8) })
    const items = grp.items.map((name) => new MeshBasicMaterial({
      map: textTexture({ w: 256, h: 60, bg: '#1f2328', align: 'center', pad: 18, lines: [{ text: name, size: name.length > 24 ? 15 : name.length > 18 ? 18 : 21, weight: 650, color: '#f7f4ef' }] }),
      color: new Color(0.8, 0.8, 0.8),
    }))
    return { head, items }
  }), [])
  useFrame((_, dt) => {
    const p = playerRuntime.position
    const near = Math.hypot(p.x - origin[0], p.z - origin[2]) < 3.4
    res.forEach((r, c) => {
      const tz = origin[2] + (c - (SKILL_GROUPS.length - 1) / 2) * SKILL_COL
      const focus = near && Math.abs(p.z - tz) < SKILL_COL / 2 ? 1 : 0
      const want = near ? 1 + focus * 0.18 : 0.8
      for (const m of [r.head, ...r.items]) m.color.setScalar(easeTo(m.color.r, want, dt, 5))
      const g = cols.current[c]
      if (g) g.position.z = easeTo(g.position.z, focus * 0.05, dt, 6)
    })
  })
  return (
    <group position={origin} rotation-y={Math.PI / 2}>
      {res.map((r, c) => (
        <group key={SKILL_GROUPS[c].group} position={[(c - (SKILL_GROUPS.length - 1) / 2) * SKILL_COL, 0, 0]} ref={(g) => { cols.current[c] = g }}>
          <mesh geometry={G.plane} material={r.head} position={[0, 2.42, 0]} scale={[0.58, 0.145, 1]} />
          {r.items.map((m, i) => (
            <mesh key={i} geometry={G.plane} material={m} position={[0, 2.26 - i * SKILL_ROW, 0]} scale={[0.58, 0.136, 1]} />
          ))}
        </group>
      ))}
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
  let cat = 24
  g.font = `500 ${cat}px ${UI_FONT}`
  while (g.measureText(p.category).width > 500 && cat > 16) g.font = `500 ${(cat -= 1)}px ${UI_FONT}`
  g.fillText(p.category, 64, 262)
  g.fillStyle = p.accent
  g.font = `650 22px ${UI_FONT}`
  g.fillText('Explore case study  →', 64, 380)
  g.fillStyle = 'rgba(247,244,239,0.45)'
  g.font = `600 14px ${UI_FONT}`
  g.fillText('OVERVIEW · CHALLENGES · PROTOTYPE', 64, 520)
  // right: the project's first real UI screen (from its Figma case study), drawn once loaded
  const card = (fill: string) => {
    g.fillStyle = fill
    g.beginPath()
    g.roundRect(580, 70, 400, 452, 20)
    g.fill()
  }
  card('rgba(247,244,239,0.94)')
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  const shot = p.screens[0]
  if (shot) {
    const img = new Image()
    img.onload = () => {
      g.save()
      g.beginPath()
      g.roundRect(580, 70, 400, 452, 20)
      g.clip()
      card('#f4f2ee')
      const s = Math.max(400 / img.width, 452 / img.height)
      g.drawImage(img, 580 + (400 - img.width * s) / 2, 70, img.width * s, img.height * s)
      g.restore()
      t.needsUpdate = true
    }
    img.src = asset(shot.image)
  }
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
          {GALLERY_EASELS.map((_, i) => <Easel key={i} index={i} />)}
          <AIRing />
          <ActivityObjects />
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
