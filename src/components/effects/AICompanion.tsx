import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  CapsuleGeometry, CircleGeometry, Color, type Group, type Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3,
} from 'three'
import { companion, emote, say, tickCompanion } from '@/core/companion'
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
 * The AI companion: a small orange character, not a robot and not a clock.
 * A soft pebble body with a glossy face visor, two expressive eyes, little
 * floating hands and a warm glow on top. It flies in during the intro, then
 * hovers at the visitor's shoulder, looks at what matters, points the way,
 * and reacts (wave, think, explain, excited, celebrate) — always subtly.
 */
export function AICompanion() {
  const root = useRef<Group>(null!)
  const body = useRef<Group>(null!)
  const eyeL = useRef<Mesh>(null!)
  const eyeR = useRef<Mesh>(null!)
  const armL = useRef<Group>(null!)
  const armR = useRef<Group>(null!)
  const tip = useRef<Mesh>(null!)
  const shadow = useRef<Mesh>(null!)
  const glowLight = useRef<PointLight>(null!)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const res = useMemo(() => {
    const shell = new MeshStandardMaterial({ color: '#ec7a2c', roughness: 0.36, metalness: 0.02, emissive: new Color('#6a2606'), emissiveIntensity: 0.18 })
    const shellLight = new MeshStandardMaterial({ color: '#f7a765', roughness: 0.42, metalness: 0 })
    return {
      body: new SphereGeometry(0.2, 32, 24),
      visor: new SphereGeometry(0.2, 28, 18),
      eye: new CapsuleGeometry(0.021, 0.026, 4, 12),
      hand: new SphereGeometry(0.045, 16, 12),
      tip: new SphereGeometry(0.026, 12, 10),
      stem: new CapsuleGeometry(0.009, 0.05, 3, 6),
      shadow: new CircleGeometry(0.22, 24),
      shell,
      shellLight,
      visorMat: new MeshStandardMaterial({ color: '#1b1511', roughness: 0.12, metalness: 0.35 }),
      eyeMat: new MeshBasicMaterial({ color: new Color(1.55, 1.3, 1.05) }),
      tipMat: new MeshBasicMaterial({ color: new Color(1.7, 1.2, 0.75) }),
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
    let hop = 0
    let spin = 0
    if (e === 'excited') hop = Math.abs(Math.sin(et * 7)) * 0.07 * Math.max(0, 1 - et / 1.6)
    if (e === 'celebrate') {
      hop = Math.abs(Math.sin(et * 5)) * 0.1 * Math.max(0, 1 - et / 2.4)
      spin = Math.min(1, et / 0.9) * Math.PI * 2
    }
    const bob = Math.sin(s.t * 2.1) * 0.035
    root.current.visible = visible
    root.current.position.set(s.pos.x, s.pos.y + bob + hop, s.pos.z)
    // voice guide: a soft breathing pulse while listening, a livelier one while speaking
    const vs = companion.voice
    const pulse = vs === 'listening' ? 0.035 * (0.5 + 0.5 * Math.sin(s.t * 3.4)) : vs === 'speaking' ? 0.05 * Math.abs(Math.sin(s.t * 8.5)) : 0
    root.current.scale.setScalar((0.55 + 0.45 * Math.min(1, s.wake * 1.4)) * (1 + pulse))

    // facing: talk to the camera, look at pointed targets, otherwise watch the player
    const talking = now < companion.showUntil
    let faceX = p.x
    let faceZ = p.z
    if (inIntro || talking) {
      faceX = camera.position.x
      faceZ = camera.position.z
    }
    if (companion.point) {
      faceX = companion.point.x
      faceZ = companion.point.z
    }
    const want = Math.atan2(faceX - s.pos.x, faceZ - s.pos.z)
    s.yaw = dampAngle(s.yaw, want, 5, dt)
    root.current.rotation.y = s.yaw + spin
    // lean into the direction of travel (body-local)
    const cy = Math.cos(s.yaw)
    const sy = Math.sin(s.yaw)
    const fwd = s.vel.x * sy + s.vel.z * cy
    const side = s.vel.x * cy - s.vel.z * sy
    body.current.rotation.x = damp(body.current.rotation.x, Math.max(-0.35, Math.min(0.35, fwd * 0.12)), 6, dt)
    body.current.rotation.z = damp(body.current.rotation.z, Math.max(-0.3, Math.min(0.3, -side * 0.12)) + Math.sin(s.t * 1.3) * 0.04, 6, dt)
    if (e === 'think' || companion.voice === 'thinking') body.current.rotation.z = damp(body.current.rotation.z, 0.16, 4, dt)

    // ── eyes: blink, look, squint-smile ──────────────────────────────────
    if (s.t > s.blinkAt) {
      s.blink = 1
      s.blinkAt = s.t + 2.6 + Math.random() * 3.6
    }
    s.blink = Math.max(0, s.blink - dt * 9)
    const happy = e === 'wave' || e === 'greet' || e === 'excited' || e === 'celebrate'
    const open = s.wake < 0.5 ? 0.1 + s.wake : 1 - (s.blink > 0.5 ? (1 - s.blink) * 2 : s.blink * 2) * 0.9
    const eyeScaleY = happy ? 0.42 : open
    const lookUp = e === 'think' ? 0.012 : 0
    const lookSide = e === 'think' ? -0.01 : 0
    for (const [m, sx] of [[eyeL.current, -1], [eyeR.current, 1]] as const) {
      m.scale.y = damp(m.scale.y, eyeScaleY, 14, dt)
      m.position.y = damp(m.position.y, 0.02 + lookUp + (happy ? 0.006 : 0), 10, dt)
      m.position.x = 0.046 * sx + lookSide
      m.rotation.z = happy ? sx * -0.35 : 0
    }

    // ── hands ───────────────────────────────────────────────────────────
    // z rotation: negative swings the left hand outward, positive the right
    let lz = -0.25
    let rz = 0.25
    let lx = 0
    let rx = 0
    const float = Math.sin(s.t * 2.1 + 0.6) * 0.08
    if (e === 'wave' || e === 'greet') {
      rz = 2.3 + Math.sin(et * 11) * 0.35
    } else if (e === 'point' && companion.point) {
      // right hand extends toward the target (arm points along body-forward)
      rx = -1.35
      rz = 0.2
    } else if (e === 'think') {
      lx = -1.9
      lz = 0.6
    } else if (e === 'explain') {
      lx = -0.8 + Math.sin(et * 3.2) * 0.35
      rx = -0.8 + Math.sin(et * 3.2 + 1.8) * 0.35
      lz = -0.5
      rz = 0.5
    } else if (e === 'excited' || e === 'celebrate') {
      lz = -2.3 - Math.sin(et * 12) * 0.2
      rz = 2.3 + Math.sin(et * 12) * 0.2
    }
    armL.current.rotation.z = damp(armL.current.rotation.z, lz - float, 9, dt)
    armR.current.rotation.z = damp(armR.current.rotation.z, rz + float, 9, dt)
    armL.current.rotation.x = damp(armL.current.rotation.x, lx, 9, dt)
    armR.current.rotation.x = damp(armR.current.rotation.x, rx, 9, dt)

    // after dark: a slightly warmer body and a small warm light — it stays a physical character
    res.shell.emissiveIntensity = 0.18 + sky.lights * 0.46
    glowLight.current.intensity = visible ? sky.lights * 1.3 : 0
    // glow tip breathes; brighter while speaking
    const glow = 0.75 + Math.sin(s.t * 2.4) * 0.15 + (talking ? 0.35 : 0) + (vs === 'listening' ? 0.3 : vs === 'thinking' ? 0.2 + Math.sin(s.t * 9) * 0.2 : 0)
    ;(tip.current.material as MeshBasicMaterial).color.setRGB(1.7 * glow, 1.2 * glow, 0.75 * glow)

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
          useUIStore.getState().setGuideOpen(true)
          emote('greet', 1400)
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = '' }}
      >
        {/* generous invisible hit area so the small companion is easy to click */}
        <mesh geometry={res.body} scale={2.4} material={res.hitMat} />
        <pointLight ref={glowLight} color="#ffb070" intensity={0} distance={2.8} decay={2} position={[0.05, 0.36, 0.05]} />
        <group ref={body}>
          <mesh geometry={res.body} material={res.shell} scale={[1, 1.1, 0.94]} castShadow />
          {/* lighter crown so the shape reads as soft and warm, not a flat ball */}
          <mesh geometry={res.body} material={res.shellLight} scale={[0.86, 0.5, 0.8]} position={[0, 0.1, -0.005]} />
          {/* a rounded face screen (not a mask band) */}
          <mesh geometry={res.visor} material={res.visorMat} scale={[0.56, 0.56, 0.52]} position={[0, 0.01, 0.098]} />
          <mesh ref={eyeL} geometry={res.eye} material={res.eyeMat} position={[-0.046, 0.02, 0.206]} />
          <mesh ref={eyeR} geometry={res.eye} material={res.eyeMat} position={[0.046, 0.02, 0.206]} />
          <mesh geometry={res.stem} material={res.shell} position={[0, 0.235, -0.01]} />
          <mesh ref={tip} geometry={res.tip} material={res.tipMat} position={[0, 0.278, -0.01]} />
          {/* floating hands on invisible shoulders */}
          <group ref={armL} position={[-0.215, -0.02, 0]}>
            <mesh geometry={res.hand} material={res.shell} position={[0, -0.075, 0]} scale={[0.9, 1.15, 0.9]} />
          </group>
          <group ref={armR} position={[0.215, -0.02, 0]}>
            <mesh geometry={res.hand} material={res.shell} position={[0, -0.075, 0]} scale={[0.9, 1.15, 0.9]} />
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
