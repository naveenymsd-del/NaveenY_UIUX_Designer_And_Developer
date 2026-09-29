import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { CharacterAnim } from '@/core/runtime'
import type { CharacterLook } from './characterLook'
import { buildCharacterRig, HIP_Y } from './characterRig'

/**
 * Original stylised chibi character (one skinned draw call) with a fully
 * procedural animation system. Locomotion is phase-driven: the controller
 * advances anim.phase by distance travelled / stride length and the leg
 * swing amplitude is derived from that same stride, so feet plant instead of
 * skating at any speed.
 *
 * Blended states: idle · walk · run · air (jump ↔ fall) · land (additive
 * squash) · sit · overlays for talk / look / phone · turn lean · strafe.
 */

const LEG = 0.52 // hip → ankle

interface Pose {
  hipY: number; lean: number; twist: number; hipYaw: number
  thighL: number; thighR: number; kneeL: number; kneeR: number; footL: number; footR: number
  legLOut: number; legROut: number
  armL: number; armR: number; armLOut: number; armROut: number; elbowL: number; elbowR: number
  headPitch: number; headYaw: number; headRoll: number
}

const ZERO: Pose = {
  hipY: 0, lean: 0, twist: 0, hipYaw: 0, thighL: 0, thighR: 0, kneeL: 0, kneeR: 0, footL: 0, footR: 0,
  legLOut: 0, legROut: 0, armL: 0, armR: 0, armLOut: 0, armROut: 0, elbowL: 0, elbowR: 0,
  headPitch: 0, headYaw: 0, headRoll: 0,
}
const KEYS = Object.keys(ZERO) as (keyof Pose)[]

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

interface Props {
  anim: CharacterAnim
  look: CharacterLook
  castShadow?: boolean
}

export function ProceduralCharacter({ anim, look, castShadow = true }: Props) {
  const rig = useMemo(() => buildCharacterRig(look), [look])
  useEffect(() => () => rig.dispose(), [rig])
  useEffect(() => {
    rig.mesh.castShadow = castShadow
  }, [rig, castShadow])

  const st = useRef({
    w: { idle: 1, loco: 0, air: 0, sit: 0 },
    run: 0,
    fall: 0,
    talk: 0,
    lookPose: 0,
    phone: 0,
    t: look.seed * 3.7,
    blinkIn: 1.5 + (look.seed % 5) * 0.4,
    blink: 0,
    lookYaw: 0,
    lookYawTarget: 0,
    lookTimer: 2,
    roll: 0,
    strafe: 0,
    pose: { ...ZERO },
    tmp: { ...ZERO },
    acc: { ...ZERO },
  })

  useFrame((_, rawDt) => {
    if (!anim.active) return
    const dt = Math.min(rawDt, 1 / 20)
    const s = st.current
    const B = rig.bones
    s.t += dt
    const t = s.t
    const k = 1 - Math.exp(-11 * dt)
    const kSlow = 1 - Math.exp(-5 * dt)

    // ── weights ─────────────────────────────────────────────────────────
    const special = anim.pose
    const sitting = special === 'sit'
    const airborne = !sitting && (!anim.grounded || anim.state === 'jump' || anim.state === 'fall')
    const spd = anim.speed
    const locoAmt = sitting || airborne ? 0 : clamp(spd / 0.9, 0, 1)
    s.w.sit += ((sitting ? 1 : 0) - s.w.sit) * (sitting ? kSlow : k)
    s.w.air += ((airborne ? 1 : 0) - s.w.air) * (airborne ? 1 - Math.exp(-18 * dt) : k)
    s.w.loco += (locoAmt - s.w.loco) * k
    s.w.idle += ((sitting || airborne ? 0 : 1 - locoAmt) - s.w.idle) * k
    const runT = clamp((spd - anim.walkSpeed * 0.95) / Math.max(0.1, anim.runSpeed - anim.walkSpeed * 0.95), 0, 1)
    s.run += (runT - s.run) * k
    s.fall += (clamp((-anim.vy + 0.5) / 4, 0, 1) - s.fall) * (1 - Math.exp(-8 * dt))
    s.talk += ((special === 'talk' ? 1 : 0) - s.talk) * kSlow
    s.lookPose += ((special === 'look' ? 1 : 0) - s.lookPose) * kSlow
    s.phone += ((special === 'phone' ? 1 : 0) - s.phone) * kSlow
    s.strafe += (clamp(anim.strafe / 3, -1, 1) - s.strafe) * k
    const targetRoll = clamp(-anim.turnRate * 0.045 * clamp(spd / 3, 0, 1), -0.28, 0.28)
    s.roll += (targetRoll - s.roll) * (1 - Math.exp(-7 * dt))

    s.lookTimer -= dt
    if (s.lookTimer <= 0) {
      s.lookTimer = 2.5 + ((Math.sin(t * 13.1) + 1) / 2) * 4
      s.lookYawTarget = Math.sin(t * 7.3) * 0.55
    }
    s.lookYaw += (s.lookYawTarget - s.lookYaw) * (1 - Math.exp(-2.5 * dt))

    // ── individual poses ───────────────────────────────────────────────
    const acc = s.acc
    for (const key of KEYS) acc[key] = 0
    let wsum = 0
    const addPose = (p: Pose, w: number) => {
      if (w < 0.001) return
      for (const key of KEYS) acc[key] += p[key] * w
      wsum += w
    }
    const p = s.tmp

    if (s.w.idle > 0.001) {
      Object.assign(p, ZERO)
      const breath = Math.sin(t * 1.7)
      p.lean = 0.02 + breath * 0.01
      p.armL = 0.04 + Math.sin(t * 1.1) * 0.03
      p.armR = 0.04 + Math.sin(t * 1.1 + 1) * 0.03
      p.armLOut = 0.13 + breath * 0.02
      p.armROut = -0.13 - breath * 0.02
      p.elbowL = p.elbowR = 0.22
      p.headYaw = s.lookYaw * (1 - s.talk * 0.6)
      p.headPitch = -0.03 + Math.sin(t * 0.9) * 0.02
      p.hipYaw = Math.sin(t * 0.5) * 0.03
      p.twist = Math.sin(t * 0.5) * 0.03
      if (s.talk > 0.01) {
        const tk = s.talk
        p.armR += tk * (0.55 + Math.sin(t * 3.1) * 0.35)
        p.elbowR += tk * (1.0 + Math.sin(t * 2.3) * 0.3)
        p.armROut += -tk * 0.15
        p.armL += tk * Math.max(0, Math.sin(t * 1.7 + 2)) * 0.5
        p.elbowL += tk * 0.6
        p.headPitch += tk * Math.sin(t * 4.2) * 0.07
        p.headRoll = tk * Math.sin(t * 1.3) * 0.08
        p.twist += tk * Math.sin(t * 1.2) * 0.1
      }
      if (s.lookPose > 0.01) {
        const lp = s.lookPose
        p.armL += lp * -0.35
        p.armR += lp * -0.35
        p.elbowL += lp * 0.9
        p.elbowR += lp * 0.9
        p.headPitch += lp * 0.12
        p.headYaw = p.headYaw * (1 - lp) + lp * Math.sin(t * 0.4) * 0.25
      }
      if (s.phone > 0.01) {
        const ph = s.phone
        p.armR += ph * 0.5
        p.armROut += -ph * 0.45
        p.elbowR += ph * 2.1
        p.headRoll += ph * 0.12
        p.headPitch += ph * 0.1
      }
      addPose(p, s.w.idle)
    }

    if (s.w.loco > 0.001) {
      Object.assign(p, ZERO)
      const r = s.run
      const stride = anim.walkStride + (anim.runStride - anim.walkStride) * r
      // leg swing amplitude matching the stride: foot sweep 4·L·sin(A) = stride
      const A = Math.asin(clamp(stride / (4 * LEG * look.height), 0.1, 0.92))
      const ph = anim.phase
      const sn = Math.sin(ph)
      const cs = Math.cos(ph)
      const K = 0.85 + r * 0.9
      const k0 = 0.08 + r * 0.35
      p.thighL = A * sn
      p.thighR = -A * sn
      p.kneeL = K * Math.max(0, cs) + k0
      p.kneeR = K * Math.max(0, -cs) + k0
      p.footL = p.thighL * 0.45 - (p.kneeL - k0) * 0.35
      p.footR = p.thighR * 0.45 - (p.kneeR - k0) * 0.35
      const Aa = 0.45 + r * 0.55
      p.armL = -Aa * sn + r * 0.15
      p.armR = Aa * sn + r * 0.15
      p.armLOut = 0.1 + r * 0.08
      p.armROut = -0.1 - r * 0.08
      p.elbowL = 0.35 + r * 1.05 + Math.max(0, -sn) * 0.25
      p.elbowR = 0.35 + r * 1.05 + Math.max(0, sn) * 0.25
      p.lean = 0.08 + r * 0.22
      const bob = 0.035 + r * 0.05
      p.hipY = ((Math.cos(2 * ph) - 1) / 2) * bob
      p.twist = sn * (0.12 + r * 0.08)
      p.hipYaw = -sn * (0.1 + r * 0.05) + s.strafe * 0.35
      p.headPitch = -p.lean * 0.55
      p.headYaw = -p.twist * 0.6
      p.legLOut = s.strafe * 0.14 * sn
      p.legROut = -s.strafe * 0.14 * sn
      addPose(p, s.w.loco)
    }

    if (s.w.air > 0.001) {
      Object.assign(p, ZERO)
      const f = s.fall
      const flail = Math.sin(t * 11) * 0.18 * f
      p.thighL = 1.0 * (1 - f) + 0.35 * f
      p.kneeL = 1.5 * (1 - f) + 0.7 * f
      p.thighR = -0.25 * (1 - f) + 0.12 * f
      p.kneeR = 0.5 * (1 - f) + 0.5 * f
      p.footL = 0.3
      p.footR = -0.2
      p.legLOut = 0.08 * f
      p.legROut = -0.08 * f
      p.armL = 0.25 * (1 - f) - 0.25 * f
      p.armR = 0.25 * (1 - f) - 0.25 * f
      p.armLOut = 1.25 * (1 - f) + (1.75 + flail) * f
      p.armROut = -1.25 * (1 - f) - (1.75 - flail) * f
      p.elbowL = p.elbowR = 0.3
      p.lean = 0.06 - f * 0.12
      p.headPitch = -0.12 * (1 - f) + 0.08 * f
      addPose(p, s.w.air)
    }

    if (s.w.sit > 0.001) {
      Object.assign(p, ZERO)
      p.hipY = -(HIP_Y - 0.06)
      p.thighL = p.thighR = 1.5
      p.kneeL = p.kneeR = 1.5
      p.footL = p.footR = -0.1
      p.legLOut = 0.06
      p.legROut = -0.06
      p.armL = p.armR = 0.55
      p.armLOut = 0.18
      p.armROut = -0.18
      p.elbowL = p.elbowR = 0.85
      p.lean = -0.06
      p.headYaw = s.lookYaw * 0.8
      p.headPitch = Math.sin(t * 0.7) * 0.04
      if (s.talk > 0.01) {
        p.armR += s.talk * (0.3 + Math.sin(t * 3) * 0.25)
        p.elbowR += s.talk * 0.5
        p.headPitch += s.talk * Math.sin(t * 4) * 0.06
      }
      addPose(p, s.w.sit)
    }

    const pose = s.pose
    const inv = wsum > 0 ? 1 / wsum : 0
    for (const key of KEYS) pose[key] = acc[key] * inv

    // additive landing squash
    const li = clamp(anim.landImpact, 0, 1)
    pose.kneeL += li * 0.7
    pose.kneeR += li * 0.7
    pose.thighL += li * 0.45
    pose.thighR += li * 0.45
    pose.hipY -= li * 0.11
    pose.armLOut += li * 0.35
    pose.armROut -= li * 0.35
    pose.lean += li * 0.15

    // ── apply to bones ─────────────────────────────────────────────────
    B.body.position.y = pose.hipY
    B.body.rotation.z = s.roll
    const squashY = 1 - li * 0.1 + s.w.air * (1 - s.fall) * 0.04
    B.body.scale.set(1 + li * 0.06, squashY, 1 + li * 0.06)
    B.hips.rotation.y = pose.hipYaw
    B.spine.rotation.set(pose.lean, pose.twist, 0)
    B.legL.rotation.set(-pose.thighL, 0, pose.legLOut)
    B.legR.rotation.set(-pose.thighR, 0, pose.legROut)
    B.kneeL.rotation.x = pose.kneeL
    B.kneeR.rotation.x = pose.kneeR
    B.footL.rotation.x = -pose.footL
    B.footR.rotation.x = -pose.footR
    B.armL.rotation.set(-pose.armL, 0, pose.armLOut)
    B.armR.rotation.set(-pose.armR, 0, pose.armROut)
    B.elbowL.rotation.x = -pose.elbowL
    B.elbowR.rotation.x = -pose.elbowR
    B.head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll)

    s.blinkIn -= dt
    if (s.blinkIn <= 0) {
      s.blink = 0.14
      s.blinkIn = 2 + ((Math.sin(t * 5.1) + 1) / 2) * 3.5
    }
    if (s.blink > 0) s.blink -= dt
    const ey = s.blink > 0 ? 0.12 : 1
    B.eyeL.scale.y = B.eyeR.scale.y = ey
  })

  return (
    <group scale={look.height}>
      <primitive object={rig.mesh} />
    </group>
  )
}
