import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, type Group, type Mesh, MeshBasicMaterial, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { companion, emote, say, tickCompanion } from '@/core/companion'
import { expressionAt } from '@/ai/expression'
import { openGuide } from '@/ai/openGuide'
import { INTRO, introCompanion, introRuntime } from '@/core/intro'
import { tickJourney } from '@/core/journey'
import { playerRuntime } from '@/core/runtime'
import { sky } from '@/core/dayNight'
import type { PointLight } from 'three'
import { AI_AREA, PARK_PATH, getLocation } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { damp, dampAngle } from '@/utils/movement'

/** DOM bubble the companion writes into directly (registered by CompanionBubble). */
export const companionBubble: { anchor: HTMLElement | null; bubble: HTMLElement | null } = { anchor: null, bubble: null }

const _target = new Vector3()
const _proj = new Vector3()
const _look = new Vector3()
const _prev = new Vector3()

/**
 * The AI companion: a small, friendly robot — a glossy pearl-white head with
 * ice-blue ear pods and antennae, a black glass face with two cyan eyes, a
 * compact body with a blue collar and a cyan chest light, and rounded arms.
 * Built from smooth procedural shapes (no external model). It flies in during
 * the intro, then hovers at the visitor's shoulder, looks at what matters,
 * points the way, and its face follows the guide (ai/expression.ts):
 * listening, thinking, speaking, navigating, a celebration on arrival, a
 * questioning tilt, a concerned look — always subtly.
 */
export function AICompanion() {
  const root = useRef<Group>(null!)
  const body = useRef<Group>(null!)
  const head = useRef<Group>(null!)
  const eyeL = useRef<Mesh>(null!)
  const eyeR = useRef<Mesh>(null!)
  const mouth = useRef<Mesh>(null!)
  const ring = useRef<Mesh>(null!)
  const armL = useRef<Group>(null!)
  const armR = useRef<Group>(null!)
  const tip = useRef<Mesh>(null!)
  const shadow = useRef<Mesh>(null!)
  const glowLight = useRef<PointLight>(null!)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const res = useMemo(() => {
    // glossy pearl shell and ice-blue armour (clear-coated, like polished plastic)
    const shell = new MeshPhysicalMaterial({ color: '#f7f8fc', roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14, emissive: new Color('#3a4a7a'), emissiveIntensity: 0.04 })
    const armour = new MeshPhysicalMaterial({ color: '#8db4ff', roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1, emissive: new Color('#1d3f9a'), emissiveIntensity: 0.12 })
    return {
      head: new RoundedBoxGeometry(0.4, 0.3, 0.32, 5, 0.11),
      face: new RoundedBoxGeometry(0.3, 0.2, 0.04, 4, 0.065),
      eye: new SphereGeometry(0.034, 20, 14),
      mouth: new CapsuleGeometry(0.007, 0.03, 3, 8),
      ear: new CylinderGeometry(0.052, 0.052, 0.045, 28),
      earCap: new CircleGeometry(0.03, 20),
      antenna: new CapsuleGeometry(0.018, 0.085, 4, 10),
      torso: new SphereGeometry(0.12, 28, 20),
      collar: new SphereGeometry(0.128, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      shoulder: new SphereGeometry(0.038, 16, 12),
      forearm: new CapsuleGeometry(0.028, 0.06, 4, 12),
      tip: new SphereGeometry(0.024, 14, 10),
      ring: new TorusGeometry(0.29, 0.006, 6, 48),
      shadow: new CircleGeometry(0.22, 24),
      hit: new SphereGeometry(0.2, 12, 8),
      shell,
      armour,
      faceMat: new MeshPhysicalMaterial({ color: '#10131c', roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }),
      eyeMat: new MeshBasicMaterial({ color: new Color(0.62, 1.75, 1.95) }),
      tipMat: new MeshBasicMaterial({ color: new Color(0.62, 1.75, 1.95) }),
      ringMat: new MeshBasicMaterial({ color: new Color(0.55, 1.6, 1.8), transparent: true, opacity: 0, depthWrite: false }),
      shadowMat: new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false }),
      hitMat: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }
  }, [])

  const st = useRef({
    pos: new Vector3(0, 2, 80),
    vel: new Vector3(),
    yaw: 0,
    t: 0,
    blinkAt: 2,
    blink: 0,
    trailHint: false,
    aiHint: 0,
    introFired: 0,
    arrived: false,
    wake: 0,
  })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = st.current
    s.t += dt
    const now = performance.now()
    const g = useGameStore.getState()
    const p = playerRuntime.position
    const inIntro = g.phase === 'loading' || g.phase === 'intro'
    const hide = g.phase === 'loading' || g.mode === 'projects'

    // ── where to be ────────────────────────────────────────────────────
    let visible = !hide
    let wake = 1
    if (inIntro) {
      const c = introCompanion(introRuntime.t, _target)
      visible = visible && c.visible
      wake = c.wake
      // intro lines, in order, once the companion has arrived
      while (s.introFired < INTRO.messages.length && introRuntime.t >= INTRO.messages[s.introFired].at) {
        const m = INTRO.messages[s.introFired++]
        say(m.text, { ms: m.ms, emote: s.introFired === 1 ? 'wave' : 'explain' })
      }
      if (!s.arrived && introRuntime.t >= INTRO.aiArriveAt) {
        s.arrived = true
        emote('excited', 1400)
      }
    } else {
      const yaw = playerRuntime.yaw
      const fx = Math.sin(yaw)
      const fz = Math.cos(yaw)
      // hover a little ahead of the right shoulder, like a guide — away from the camera behind
      _target.set(p.x + fx * 0.45 - fz * 0.85, p.y + 1.9, p.z + fz * 0.45 + fx * 0.85)
      const dAI = Math.hypot(p.x - AI_AREA[0], p.z - AI_AREA[1])
      const near = g.nearbyId ? getLocation(g.nearbyId) : null
      if (!g.interior && dAI < 7) {
        const a = s.t * 0.5
        _target.set(AI_AREA[0] + Math.cos(a) * 0.6, 2.3, AI_AREA[1] + Math.sin(a) * 0.6)
        if (now - s.aiHint > 30000) {
          s.aiHint = now
          say('This is where I help him <b>explore possibilities</b>. He makes the decisions.', { emote: 'think' })
        }
      } else if (companion.point) {
        // step out to the side facing the destination, arm extended
        _look.copy(companion.point).sub(p).setY(0).normalize()
        _target.set(p.x + _look.x * 0.9 - _look.z * 0.5, p.y + 2.0, p.z + _look.z * 0.9 + _look.x * 0.5)
      } else if (near && (near.type === 'story' || near.type === 'project')) {
        _target.lerp(_proj.set(near.position[0], p.y + 1.7, near.position[2]), 0.35)
      }
      if (!g.interior && !s.trailHint && Math.hypot(p.x - PARK_PATH[0][0], p.z - PARK_PATH[0][1]) < 5) {
        s.trailHint = true
        say('Each easel holds <b>real screens</b> from one of his projects.', { emote: 'point' })
      }
      tickJourney(now)
    }
    s.wake = damp(s.wake, wake, 5, dt)
    // never crowd the lens: keep a comfortable distance from the camera (establishing shots, tight rooms)
    if (!inIntro) {
      _look.copy(_target).sub(camera.position)
      const dc = _look.length()
      const minD = g.interior ? 3.2 : 2.6
      if (dc < minD) _target.copy(camera.position).addScaledVector(_look.normalize(), minD)
    }

    // ── motion ─────────────────────────────────────────────────────────
    _prev.copy(s.pos)
    const teleported = s.pos.distanceTo(_target) > 25 && !inIntro
    if (teleported || (inIntro && introRuntime.t < INTRO.aiArriveAt)) s.pos.copy(_target)
    else {
      s.pos.x = damp(s.pos.x, _target.x, inIntro ? 6 : 2.6, dt)
      s.pos.y = damp(s.pos.y, _target.y, inIntro ? 6 : 2.2, dt)
      s.pos.z = damp(s.pos.z, _target.z, inIntro ? 6 : 2.6, dt)
    }
    s.vel.lerp(_proj.copy(s.pos).sub(_prev).divideScalar(Math.max(dt, 1e-4)), 1 - Math.exp(-6 * dt))

    const e = companion.emote
    const et = (now - companion.emoteSince) / 1000
    // one face for the whole guide (ai/expression.ts): chat, voice and walks all show here
    const ex = expressionAt(now)
    const happy = ex === 'welcome' || ex === 'success' || e === 'wave' || e === 'greet' || e === 'excited' || e === 'celebrate'
    let hop = 0
    if (e === 'excited') hop = Math.abs(Math.sin(et * 7)) * 0.07 * Math.max(0, 1 - et / 1.6)
    if (e === 'celebrate') hop = Math.abs(Math.sin(et * 5)) * 0.1 * Math.max(0, 1 - et / 2.4)
    // a confirmed arrival: a short, happy bounce (never a spin)
    if (ex === 'success') hop = Math.max(hop, Math.abs(Math.sin(s.t * 6)) * 0.07)
    const bob = Math.sin(s.t * 2.1) * 0.035
    root.current.visible = visible
    root.current.position.set(s.pos.x, s.pos.y + bob + hop, s.pos.z)
    // voice guide: a soft breathing pulse while listening, a livelier one while speaking
    const vs = companion.voice
    const pulse = vs === 'listening' ? 0.025 * (0.5 + 0.5 * Math.sin(s.t * 3.4)) : vs === 'speaking' ? 0.03 * Math.abs(Math.sin(s.t * 8.5)) : 0
    root.current.scale.setScalar((0.55 + 0.45 * Math.min(1, s.wake * 1.4)) * (1 + pulse))

    // facing: talk to the camera, look at pointed targets, otherwise watch the player
    const talking = now < companion.showUntil
    let faceX = p.x
    let faceZ = p.z
    if (inIntro || talking || ex === 'listening' || ex === 'speaking' || ex === 'welcome') {
      faceX = camera.position.x
      faceZ = camera.position.z
    }
    if (companion.point) {
      faceX = companion.point.x
      faceZ = companion.point.z
    }
    const want = Math.atan2(faceX - s.pos.x, faceZ - s.pos.z)
    s.yaw = dampAngle(s.yaw, want, 5, dt)
    root.current.rotation.y = s.yaw
    // lean into the direction of travel (body-local)
    const cy = Math.cos(s.yaw)
    const sy = Math.sin(s.yaw)
    const fwd = s.vel.x * sy + s.vel.z * cy
    const side = s.vel.x * cy - s.vel.z * sy
    body.current.rotation.x = damp(body.current.rotation.x, Math.max(-0.35, Math.min(0.35, fwd * 0.12)), 6, dt)
    body.current.rotation.z = damp(body.current.rotation.z, Math.max(-0.3, Math.min(0.3, -side * 0.12)) + Math.sin(s.t * 1.3) * 0.04, 6, dt)
    // the head: tilts to listen, to think, to ask; nods while explaining
    const tilt = ex === 'listening' ? -0.12 : ex === 'thinking' ? 0.16 : ex === 'confused' ? -0.24 : ex === 'navigating' ? 0.06 : ex === 'error' ? 0.08 : 0
    const nod = ex === 'explaining' || ex === 'speaking' ? Math.sin(s.t * 2.6) * 0.05 : 0
    head.current.rotation.z = damp(head.current.rotation.z, tilt, 5, dt)
    head.current.rotation.x = damp(head.current.rotation.x, nod + (ex === 'error' ? 0.12 : 0), 5, dt)

    // ── eyes: blink, look, and a face for each expression ──────────────────
    if (s.t > s.blinkAt) {
      s.blink = 1
      s.blinkAt = s.t + 2.8 + Math.random() * 3.8
    }
    s.blink = Math.max(0, s.blink - dt * 9)
    const open = s.wake < 0.5 ? 0.1 + s.wake : 1 - (s.blink > 0.5 ? (1 - s.blink) * 2 : s.blink * 2) * 0.9
    for (const [m, sx] of [[eyeL.current, -1], [eyeR.current, 1]] as const) {
      // height (squash), width, glance and rotation per expression
      let ey = open
      let ew = 1
      let gx = 0
      let gy = 0
      let rot = 0
      if (happy) {
        ey = 0.42
        rot = sx * -0.35
        gy = 0.006
      } else if (ex === 'listening') {
        ew = 1.1
      } else if (ex === 'thinking') {
        ey = 0.55
        gx = 0.012
        gy = 0.012
      } else if (ex === 'navigating') {
        ey = Math.min(open, 0.8)
        gx = 0.014
      } else if (ex === 'confused') {
        ey = sx < 0 ? 0.6 : Math.min(open, 1.12)
        ew = sx < 0 ? 1 : 1.1
      } else if (ex === 'error') {
        ey = 0.72
        rot = sx * 0.3
      }
      m.scale.y = damp(m.scale.y, ey * 1.2, 14, dt)
      m.scale.x = damp(m.scale.x, ew, 10, dt)
      m.position.y = damp(m.position.y, 0.07 + gy, 10, dt)
      m.position.x = damp(m.position.x, 0.058 * sx + gx, 10, dt)
      m.rotation.z = damp(m.rotation.z, rot, 10, dt)
    }
    // speaking: a small mouth bar moves under the eyes
    const speaking = ex === 'speaking'
    mouth.current.visible = speaking
    if (speaking) mouth.current.scale.set(1, 0.6 + Math.abs(Math.sin(s.t * 11)) * 0.9, 1)
    // listening: a soft cyan ring pulses around the head
    const rk = ex === 'listening' ? (s.t * 0.7) % 1 : -1
    res.ringMat.opacity = rk < 0 ? damp(res.ringMat.opacity, 0, 8, dt) : 0.55 * (1 - rk)
    ring.current.scale.setScalar(rk < 0 ? 1 : 0.85 + rk * 0.3)
    ring.current.visible = res.ringMat.opacity > 0.01

    // ── arms ────────────────────────────────────────────────────────────
    // z rotation: negative swings the left arm outward, positive the right
    let lz = -0.25
    let rz = 0.25
    let lx = 0
    let rx = 0
    const float = Math.sin(s.t * 2.1 + 0.6) * 0.08
    if (e === 'wave' || e === 'greet' || ex === 'welcome') {
      rz = 2.3 + Math.sin(s.t * 11) * 0.35
    } else if ((e === 'point' && companion.point) || ex === 'navigating') {
      // right arm extends toward the target (along body-forward)
      rx = -1.35
      rz = 0.2
    } else if (e === 'think' || ex === 'thinking') {
      lx = -1.9
      lz = 0.6
    } else if (ex === 'confused') {
      rx = -1.2
      rz = 1.4
    } else if (e === 'explain' || ex === 'explaining' || ex === 'speaking') {
      lx = -0.8 + Math.sin(s.t * 3.2) * 0.35
      rx = -0.8 + Math.sin(s.t * 3.2 + 1.8) * 0.35
      lz = -0.5
      rz = 0.5
    } else if (e === 'excited' || e === 'celebrate' || ex === 'success') {
      lz = -2.3 - Math.sin(s.t * 12) * 0.2
      rz = 2.3 + Math.sin(s.t * 12) * 0.2
    }
    armL.current.rotation.z = damp(armL.current.rotation.z, lz - float, 9, dt)
    armR.current.rotation.z = damp(armR.current.rotation.z, rz + float, 9, dt)
    armL.current.rotation.x = damp(armL.current.rotation.x, lx, 9, dt)
    armR.current.rotation.x = damp(armR.current.rotation.x, rx, 9, dt)

    // after dark: the shell catches a little of its own light, and a small cyan light glows
    res.shell.emissiveIntensity = 0.04 + sky.lights * 0.22
    glowLight.current.intensity = visible ? sky.lights * 1.3 : 0
    // the chest light breathes; brighter while talking or listening, a quick shimmer while thinking
    const glow = 0.75 + Math.sin(s.t * 2.4) * 0.15 + (talking || speaking ? 0.3 : 0) + (ex === 'listening' ? 0.35 : ex === 'thinking' ? 0.2 + Math.sin(s.t * 9) * 0.2 : 0)
    ;(tip.current.material as MeshBasicMaterial).color.setRGB(0.62 * glow, 1.75 * glow, 1.95 * glow)

    // soft contact shadow on the floor below
    const floorY = inIntro ? 0.17 : p.y + 0.02
    const h = Math.max(0.1, root.current.position.y - floorY)
    shadow.current.position.set(s.pos.x, floorY, s.pos.z)
    shadow.current.visible = visible && h < 4
    res.shadowMat.opacity = Math.max(0, 0.24 - h * 0.06)

    // ── speech bubble ────────────────────────────────────────────────────
    // on touch screens the controls tip card comes first; lines wait their turn
    const hold = g.tipsOpen && useUIStore.getState().isTouch
    const msg = visible && !hold ? tickCompanion(now) : null
    if (msg && companionBubble.anchor) {
      _proj.copy(root.current.position).setY(root.current.position.y + 0.36).project(camera)
      if (_proj.z < 1 && Math.abs(_proj.x) < 1.1 && Math.abs(_proj.y) < 1.1) {
        const x = (_proj.x * 0.5 + 0.5) * size.width
        const y = (-_proj.y * 0.5 + 0.5) * size.height
        const cx = Math.min(size.width - 300, Math.max(12, x + 16))
        // lift clear of an interaction prompt above the player's head
        const cyy = Math.max(196, y - 8 - (g.nearbyId ? 70 : 0))
        companionBubble.anchor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cyy.toFixed(1)}px, 0) translate(0, -100%)`
        setBubble(msg)
      } else setBubble(msg, true)
    } else setBubble(null)
  })

  return (
    <>
      <group
        ref={root}
        onClick={(e) => {
          e.stopPropagation()
          if (useGameStore.getState().phase !== 'playing') return
          openGuide()
          emote('greet', 1400)
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = '' }}
      >
        {/* generous invisible hit area so the small companion is easy to click */}
        <mesh geometry={res.hit} scale={2.4} material={res.hitMat} />
        <pointLight ref={glowLight} color="#7fe8ff" intensity={0} distance={2.8} decay={2} position={[0, -0.1, 0.2]} />
        <group ref={body}>
          <group ref={head} position={[0, 0.07, 0]}>
            {/* pearl head, black glass face, cyan eyes */}
            <mesh geometry={res.head} material={res.shell} castShadow />
            <mesh geometry={res.face} material={res.faceMat} position={[0, -0.005, 0.15]} />
            <mesh ref={eyeL} geometry={res.eye} material={res.eyeMat} position={[-0.058, 0.07, 0.17]} scale={[1, 1.2, 0.35]} />
            <mesh ref={eyeR} geometry={res.eye} material={res.eyeMat} position={[0.058, 0.07, 0.17]} scale={[1, 1.2, 0.35]} />
            <mesh ref={mouth} geometry={res.mouth} material={res.eyeMat} position={[0, -0.04, 0.17]} rotation-z={Math.PI / 2} visible={false} />
            {/* ice-blue ear pods with cyan caps, and two antennae */}
            <mesh geometry={res.ear} material={res.armour} position={[-0.212, 0, 0]} rotation-z={Math.PI / 2} />
            <mesh geometry={res.ear} material={res.armour} position={[0.212, 0, 0]} rotation-z={Math.PI / 2} />
            <mesh geometry={res.earCap} material={res.tipMat} position={[-0.236, 0, 0]} rotation-y={-Math.PI / 2} />
            <mesh geometry={res.earCap} material={res.tipMat} position={[0.236, 0, 0]} rotation-y={Math.PI / 2} />
            <mesh geometry={res.antenna} material={res.armour} position={[-0.12, 0.2, -0.02]} rotation-z={0.45} />
            <mesh geometry={res.antenna} material={res.armour} position={[0.12, 0.2, -0.02]} rotation-z={-0.45} />
            {/* listening ring */}
            <mesh ref={ring} geometry={res.ring} material={res.ringMat} visible={false} />
          </group>
          {/* compact body: pearl torso, blue collar, cyan chest light */}
          <mesh geometry={res.torso} material={res.shell} position={[0, -0.18, 0]} scale={[1, 0.95, 0.9]} castShadow />
          <mesh geometry={res.collar} material={res.armour} position={[0, -0.155, 0]} scale={[1.02, 0.8, 0.95]} />
          <mesh ref={tip} geometry={res.tip} material={res.tipMat} position={[0, -0.15, 0.115]} scale={[1, 1, 0.4]} />
          {/* rounded arms on blue shoulders */}
          <group ref={armL} position={[-0.15, -0.13, 0]}>
            <mesh geometry={res.shoulder} material={res.armour} />
            <mesh geometry={res.forearm} material={res.shell} position={[0, -0.065, 0]} />
          </group>
          <group ref={armR} position={[0.15, -0.13, 0]}>
            <mesh geometry={res.shoulder} material={res.armour} />
            <mesh geometry={res.forearm} material={res.shell} position={[0, -0.065, 0]} />
          </group>
        </group>
      </group>
      <mesh ref={shadow} geometry={res.shadow} material={res.shadowMat} rotation-x={-Math.PI / 2} renderOrder={2} />
    </>
  )
}

let lastHtml = ''
function setBubble(html: string | null, offscreen = false) {
  const el = companionBubble.bubble
  if (!el) return
  if (html === null || offscreen) {
    el.classList.remove('is-visible')
    return
  }
  if (html !== lastHtml) {
    el.innerHTML = html
    lastHtml = html
  }
  el.classList.add('is-visible')
}
