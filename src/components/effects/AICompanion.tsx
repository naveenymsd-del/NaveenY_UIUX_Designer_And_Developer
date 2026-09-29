import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type Group, type Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { playerRuntime } from '@/core/runtime'
import { AI_AREA, PROCESS_STATIONS, getLocation } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'
import { damp } from '@/utils/movement'

/** DOM bubble the companion writes into directly (registered by CompanionBubble). */
export const companionBubble: { anchor: HTMLElement | null; bubble: HTMLElement | null } = { anchor: null, bubble: null }

const _target = new Vector3()
const _proj = new Vector3()

/**
 * The orange AI companion: a small floating orb, not a humanoid robot. It
 * trails the player at shoulder height, leans toward nearby story objects,
 * glides to the AI area and speaks through a small bubble. Hidden indoors.
 */
export function AICompanion() {
  const group = useRef<Group>(null!)
  const body = useRef<Mesh>(null!)
  const halo = useRef<Mesh>(null!)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const res = useMemo(
    () => ({
      body: new SphereGeometry(0.2, 24, 16),
      eye: new SphereGeometry(0.03, 10, 8),
      halo: new TorusGeometry(0.27, 0.012, 6, 40),
      shell: new MeshStandardMaterial({ color: '#e8792e', roughness: 0.28, metalness: 0.1, emissive: new Color('#7a2f08'), emissiveIntensity: 0.25 }),
      visor: new MeshStandardMaterial({ color: '#2a1c14', roughness: 0.15, metalness: 0.2 }),
      eyeMat: new MeshBasicMaterial({ color: new Color(1.6, 1.4, 1.1) }),
      haloMat: new MeshBasicMaterial({ color: '#ffd9b3', transparent: true, opacity: 0.7 }),
    }),
    [],
  )
  const st = useRef({ pos: new Vector3(0, 2, 80), t: 0, message: '', showUntil: 0, greeted: false, trailHint: false, aiHint: 0 })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = st.current
    s.t += dt
    const g = useGameStore.getState()
    const hide = !!g.interior || g.phase === 'loading' || g.phase === 'intro' || g.mode === 'projects'
    group.current.visible = !hide
    const p = playerRuntime.position
    if (hide) {
      s.pos.set(p.x, p.y + 2, p.z)
      setBubble(null)
      return
    }
    const yaw = playerRuntime.yaw
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    // default: trail behind-right of the player
    _target.set(p.x - fz * -0.85 - fx * 0.7, p.y + 1.95, p.z + fx * -0.85 - fz * 0.7)
    const now = performance.now()
    const dAI = Math.hypot(p.x - AI_AREA[0], p.z - AI_AREA[1])
    const near = g.nearbyId ? getLocation(g.nearbyId) : null
    if (dAI < 7) {
      // glide to the heart of the AI area and circle slowly
      const a = s.t * 0.6
      _target.set(AI_AREA[0] + Math.cos(a) * 0.6, 2.35, AI_AREA[1] + Math.sin(a) * 0.6)
      if (now - s.aiHint > 9000) {
        s.aiHint = now
        say(s, 'Let’s explore how <b>I use AI</b> — as a design partner, never the decision-maker.', 6500)
      }
    } else if (near && near.type === 'story') {
      // lean toward the object being looked at
      _target.lerp(_proj.set(near.position[0], near.position[1] + 1.5, near.position[2]), 0.45)
    }
    if (!s.greeted && g.phase === 'playing') {
      s.greeted = true
      say(s, 'Hi! I’m your AI companion. Explore <b>Naveen’s</b> neighbourhood — go anywhere.', 6000)
    }
    if (!s.trailHint && Math.hypot(p.x - PROCESS_STATIONS[0][0], p.z - PROCESS_STATIONS[0][1]) < 5) {
      s.trailHint = true
      say(s, 'Follow the stepping stones — each board is a step of the <b>design process</b>.', 6000)
    }
    s.pos.x = damp(s.pos.x, _target.x, 2.4, dt)
    s.pos.y = damp(s.pos.y, _target.y, 2.0, dt)
    s.pos.z = damp(s.pos.z, _target.z, 2.4, dt)
    group.current.position.set(s.pos.x, s.pos.y + Math.sin(s.t * 2.1) * 0.06, s.pos.z)
    // face the player (or the camera when talking)
    const lookX = (now < s.showUntil ? camera.position.x : p.x) - s.pos.x
    const lookZ = (now < s.showUntil ? camera.position.z : p.z) - s.pos.z
    group.current.rotation.y = Math.atan2(lookX, lookZ)
    body.current.rotation.z = Math.sin(s.t * 1.3) * 0.08
    halo.current.rotation.x = Math.PI / 2 + Math.sin(s.t * 1.7) * 0.25
    halo.current.rotation.y = s.t * 0.8

    // speech bubble
    if (now < s.showUntil && companionBubble.anchor) {
      _proj.copy(group.current.position).setY(group.current.position.y + 0.4).project(camera)
      if (_proj.z < 1) {
        const x = (_proj.x * 0.5 + 0.5) * size.width
        const y = (-_proj.y * 0.5 + 0.5) * size.height
        companionBubble.anchor.style.transform = `translate3d(${(x + 14).toFixed(1)}px, ${(y - 10).toFixed(1)}px, 0) translate(0, -100%)`
        setBubble(s.message)
      } else setBubble(null)
    } else setBubble(null)
  })

  return (
    <group ref={group}>
      <mesh ref={body} geometry={res.body} material={res.shell} castShadow />
      <mesh geometry={res.body} material={res.visor} position={[0, 0.015, 0.105]} scale={[0.72, 0.42, 0.5]} />
      <mesh geometry={res.eye} material={res.eyeMat} position={[0.055, 0.025, 0.2]} />
      <mesh geometry={res.eye} material={res.eyeMat} position={[-0.055, 0.025, 0.2]} />
      <mesh ref={halo} geometry={res.halo} material={res.haloMat} />
    </group>
  )
}

function say(s: { message: string; showUntil: number }, msg: string, ms: number) {
  s.message = msg
  s.showUntil = performance.now() + ms
}

let lastHtml = ''
function setBubble(html: string | null) {
  const el = companionBubble.bubble
  if (!el) return
  if (html === null) {
    el.classList.remove('is-visible')
    return
  }
  if (html !== lastHtml) {
    el.innerHTML = html
    lastHtml = html
  }
  el.classList.add('is-visible')
}
