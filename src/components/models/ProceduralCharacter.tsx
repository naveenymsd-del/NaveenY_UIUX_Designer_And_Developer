import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { CharacterAnim } from '@/core/runtime'
import type { CharacterDetail, CharacterLook } from './characterLook'
import { buildCharacterRig, HIP_Y, LEG_LENGTH } from './characterRig'

/**
 * Procedural animation for the stylised-realistic human rig.
 *
 * Locomotion is phase-driven: the controller advances anim.phase by distance
 * travelled / stride, and thigh swing amplitude is solved from that stride
 * (foot sweep = 4·L·sin A), so planted feet don't skate. The gait includes
 * heel strike → flat foot → toe-off roll, knee flexion in swing, pelvis drop,
 * rotation and lateral sway, counter-rotating chest, elbow-bent arm swing and
 * head stabilisation. Walk and run are distinct gaits (run adds a flight
 * phase, forward lean and high knees) blended by speed.
 *
 * Other states: idle (breathing, weight shift), turn-in-place steps, jump,
 * fall, land, sit, and overlays for talk / wave / work / read / coffee /
 * phone / look, plus a gaze target so people glance at who passes by.
 */

interface Pose {
  hipY: number; hipX: number; hipYaw: number; hipRoll: number
  spinePitch: number; spineYaw: number; chestPitch: number; chestYaw: number
  neckPitch: number; headPitch: number; headYaw: number; headRoll: number
  thighL: number; thighR: number; thighOutL: number; thighOutR: number
  kneeL: number; kneeR: number; footL: number; footR: number; toeL: number; toeR: number
  armL: number; armR: number; armOutL: number; armOutR: number
  elbowL: number; elbowR: number; elbowZL: number; elbowZR: number; handL: number; handR: number
}

const ZERO: Pose = {
  hipY: 0, hipX: 0, hipYaw: 0, hipRoll: 0, spinePitch: 0, spineYaw: 0, chestPitch: 0, chestYaw: 0,
  neckPitch: 0, headPitch: 0, headYaw: 0, headRoll: 0,
  thighL: 0, thighR: 0, thighOutL: 0, thighOutR: 0, kneeL: 0, kneeR: 0, footL: 0, footR: 0, toeL: 0, toeR: 0,
  armL: 0, armR: 0, armOutL: 0, armOutR: 0, elbowL: 0, elbowR: 0, elbowZL: 0, elbowZR: 0, handL: 0, handR: 0,
}
const KEYS = Object.keys(ZERO) as (keyof Pose)[]

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const pos = (v: number) => (v > 0 ? v : 0)

/** One leg of a gait cycle. ph = this leg's phase (sin ph = 1 → leg fully forward). */
function legCycle(ph: number, A: number, run: number, out: { thigh: number; knee: number; foot: number; toe: number }) {
  const s = Math.sin(ph)
  const c = Math.cos(ph)
  const thigh = A * s + run * 0.12
  // knee: small flex through stance, big flex in early/mid swing (thigh moving forward, c > 0)
  const swing = Math.pow(pos(Math.cos(ph - 0.45)), 1.6)
  const knee = 0.1 + run * 0.28 + swing * (1.0 + run * 0.85) + pos(Math.sin(ph - 1.2)) * 0.1 * (1 - run)
  // heel strike just after full reach, toe-off at full extension behind
  const heel = Math.pow(pos(s), 6) * (c < 0.2 ? 1 : 0.4)
  const pushOff = Math.pow(pos(-s), 5) * (c > -0.3 ? 1 : 0.35)
  // keep the foot level with the ground, then add the roll
  const level = thigh - knee
  const foot = level - heel * (0.32 - run * 0.1) + pushOff * (0.5 + run * 0.25) + swing * 0.12
  const toe = -pushOff * (0.55 + run * 0.2)
  out.thigh = thigh
  out.knee = knee
  out.foot = foot
  out.toe = toe
}

interface Props {
  anim: CharacterAnim
  look: CharacterLook
  castShadow?: boolean
  detail?: CharacterDetail
}

export function ProceduralCharacter({ anim, look, castShadow = true, detail = 'high' }: Props) {
  const rig = useMemo(() => buildCharacterRig(look, detail), [look, detail])
  useEffect(() => () => rig.dispose(), [rig])
  useEffect(() => {
    rig.mesh.castShadow = castShadow
  }, [rig, castShadow])

  const st = useRef({
    w: { idle: 1, loco: 0, air: 0, sit: 0 },
    run: 0,
    fall: 0,
    overlay: { talk: 0, look: 0, phone: 0, wave: 0, work: 0, read: 0, coffee: 0 },
    t: look.seed * 3.7,
    blinkIn: 1.5 + (look.seed % 5) * 0.4,
    blink: 0,
    lookYaw: 0,
    lookYawTarget: 0,
    lookTimer: 2,
    roll: 0,
    strafe: 0,
    gaze: 0,
    sipTimer: 3 + (look.seed % 4),
    sip: 0,
    pose: { ...ZERO },
    tmp: { ...ZERO },
    acc: { ...ZERO },
    legA: { thigh: 0, knee: 0, foot: 0, toe: 0 },
    legB: { thigh: 0, knee: 0, foot: 0, toe: 0 },
  })

  const skip = useRef({ n: 0, acc: 0 })
  useFrame((_, rawDt) => {
    if (!anim.active) return
    // distance LOD: mid-range people animate at a reduced rate (time is accumulated, so motion stays correct)
    const sk = skip.current
    sk.acc += rawDt
    if (++sk.n < (anim.every ?? 1)) return
    sk.n = 0
    const dt = Math.min(sk.acc, 1 / 12)
    sk.acc = 0
    const s = st.current
    const B = rig.bones
    s.t += dt
    const t = s.t
    const k = 1 - Math.exp(-9 * dt)
    const kSlow = 1 - Math.exp(-4 * dt)

    // ── weights ─────────────────────────────────────────────────────────
    const special = anim.pose
    const sitting = special === 'sit' || special === 'work' || special === 'sitTalk'
    const airborne = !sitting && (!anim.grounded || anim.state === 'jump' || anim.state === 'fall')
    const spd = anim.speed
    const locoAmt = sitting || airborne ? 0 : clamp(spd / 0.7, 0, 1)
    s.w.sit += ((sitting ? 1 : 0) - s.w.sit) * kSlow
    s.w.air += ((airborne ? 1 : 0) - s.w.air) * (airborne ? 1 - Math.exp(-16 * dt) : k)
    s.w.loco += (locoAmt - s.w.loco) * k
    s.w.idle += ((sitting || airborne ? 0 : 1 - locoAmt) - s.w.idle) * k
    const runT = clamp((spd - anim.walkSpeed * 1.05) / Math.max(0.1, anim.runSpeed - anim.walkSpeed * 1.05), 0, 1)
    s.run += (runT - s.run) * (1 - Math.exp(-5 * dt))
    s.fall += (clamp((-anim.vy + 0.5) / 4, 0, 1) - s.fall) * (1 - Math.exp(-8 * dt))
    const ov = s.overlay
    const target = (p: keyof typeof ov, on: boolean) => (ov[p] += ((on ? 1 : 0) - ov[p]) * kSlow)
    target('talk', special === 'talk' || special === 'sitTalk')
    target('look', special === 'look')
    target('phone', special === 'phone')
    target('wave', special === 'wave')
    target('work', special === 'work')
    target('read', special === 'read')
    target('coffee', special === 'coffee')
    s.strafe += (clamp(anim.strafe / 2.5, -1, 1) - s.strafe) * k
    const targetRoll = clamp(-anim.turnRate * 0.03 * clamp(spd / 3, 0, 1), -0.18, 0.18)
    s.roll += (targetRoll - s.roll) * (1 - Math.exp(-6 * dt))
    s.gaze += (anim.gaze * anim.gazeWeight - s.gaze) * (1 - Math.exp(-4 * dt))

    s.lookTimer -= dt
    if (s.lookTimer <= 0) {
      s.lookTimer = 3 + ((Math.sin(t * 13.1) + 1) / 2) * 4
      s.lookYawTarget = Math.sin(t * 7.3) * 0.45
    }
    s.lookYaw += (s.lookYawTarget - s.lookYaw) * (1 - Math.exp(-2 * dt))
    // coffee sips
    s.sipTimer -= dt
    if (s.sipTimer <= 0) {
      s.sipTimer = 5 + ((Math.sin(t * 3.3) + 1) / 2) * 5
      s.sip = 1.6
    }
    if (s.sip > 0) s.sip -= dt
    const sipAmt = s.sip > 0 ? Math.sin(clamp(s.sip / 1.6, 0, 1) * Math.PI) : 0

    // ── pose accumulation ──────────────────────────────────────────────
    const acc = s.acc
    for (const key of KEYS) acc[key] = 0
    let wsum = 0
    const addPose = (p: Pose, w: number) => {
      if (w < 0.001) return
      for (const key of KEYS) acc[key] += p[key] * w
      wsum += w
    }
    const p = s.tmp

    // idle: breathing, slow weight shifts, relaxed arms
    if (s.w.idle > 0.001) {
      Object.assign(p, ZERO)
      const breath = Math.sin(t * 1.5)
      const shift = Math.sin(t * 0.33 + look.seed)
      p.hipX = shift * 0.018
      p.hipRoll = shift * 0.035
      p.kneeL = 0.05 + pos(-shift) * 0.1
      p.kneeR = 0.05 + pos(shift) * 0.1
      p.thighL = pos(-shift) * 0.04
      p.thighR = pos(shift) * 0.04
      p.footL = p.thighL - p.kneeL
      p.footR = p.thighR - p.kneeR
      p.spinePitch = 0.02
      p.spineYaw = Math.sin(t * 0.21) * 0.03
      p.chestPitch = -0.02 + breath * 0.012
      // relaxed, not a mannequin: arms slightly forward and away from the hips,
      // elbows softly bent, hands loosely curled; the weight side's arm hangs a touch lower
      p.armL = 0.07 + breath * 0.01 + pos(shift) * 0.03
      p.armR = 0.07 - breath * 0.01 + pos(-shift) * 0.03
      p.armOutL = 0.11 + pos(-shift) * 0.02
      p.armOutR = -0.11 - pos(shift) * 0.02
      p.elbowL = 0.24 + pos(shift) * 0.05
      p.elbowR = 0.24 + pos(-shift) * 0.05
      p.handL = p.handR = 0.12
      p.headYaw = s.lookYaw * (1 - ov.talk * 0.6) * (1 - ov.work)
      p.headPitch = -0.02 + Math.sin(t * 0.7) * 0.02
      p.headRoll = -shift * 0.02
      addPose(p, s.w.idle)
    }

    // locomotion: walk ↔ run
    if (s.w.loco > 0.001) {
      Object.assign(p, ZERO)
      const r = s.run
      const stride = anim.walkStride + (anim.runStride - anim.walkStride) * r
      const L = LEG_LENGTH * look.height
      const A = Math.asin(clamp(stride / (4 * L), 0.08, 0.85))
      const ph = anim.phase
      legCycle(ph, A, r, s.legA)
      legCycle(ph + Math.PI, A, r, s.legB)
      p.thighL = s.legA.thigh
      p.kneeL = s.legA.knee
      p.footL = s.legA.foot
      p.toeL = s.legA.toe
      p.thighR = s.legB.thigh
      p.kneeR = s.legB.knee
      p.footR = s.legB.foot
      p.toeR = s.legB.toe
      const sn = Math.sin(ph)
      const cs = Math.cos(ph)
      // pelvis: walk dips at double support, run rises in flight
      const walkBob = -((1 - Math.cos(2 * ph)) / 2) * 0.035
      const runBob = ((1 - Math.cos(2 * ph)) / 2) * 0.07 - 0.07
      p.hipY = walkBob * (1 - r) + runBob * r
      p.hipYaw = sn * (0.12 - r * 0.02) + s.strafe * 0.3
      p.hipRoll = cs * 0.045 * (1 - r * 0.4)
      p.hipX = cs * 0.022 * (1 - r)
      p.spinePitch = 0.05 + r * 0.2
      p.chestYaw = -sn * (0.16 + r * 0.08)
      p.chestPitch = r * 0.06
      p.spineYaw = -p.hipYaw * 0.3
      // arms opposite the legs, elbows bend more when running
      const Aa = 0.32 + r * 0.55
      p.armL = -Aa * sn + r * 0.2
      p.armR = Aa * sn + r * 0.2
      p.armOutL = 0.07 + r * 0.06
      p.armOutR = -0.07 - r * 0.06
      p.elbowL = 0.22 + r * 1.2 + pos(-sn) * (0.15 + r * 0.2)
      p.elbowR = 0.22 + r * 1.2 + pos(sn) * (0.15 + r * 0.2)
      p.handL = p.handR = 0.1 + r * 0.2
      // head stays level and looks where we're going
      p.headPitch = -(p.spinePitch + p.chestPitch) * 0.75
      p.headYaw = -p.chestYaw * 0.5 - p.spineYaw
      p.thighOutL = s.strafe * 0.12 * sn
      p.thighOutR = -s.strafe * 0.12 * sn
      addPose(p, s.w.loco)
    }

    // airborne: take-off tuck ↔ falling
    if (s.w.air > 0.001) {
      Object.assign(p, ZERO)
      const f = s.fall
      p.thighL = 0.75 * (1 - f) + 0.3 * f
      p.kneeL = 1.1 * (1 - f) + 0.55 * f
      p.thighR = 0.05 * (1 - f) + 0.12 * f
      p.kneeR = 0.45 * (1 - f) + 0.4 * f
      p.footL = p.thighL - p.kneeL + 0.35
      p.footR = p.thighR - p.kneeR + 0.25
      p.armL = 0.7 * (1 - f) + 0.2 * f
      p.armR = 0.45 * (1 - f) + 0.2 * f
      p.armOutL = 0.25 + f * 0.45
      p.armOutR = -0.25 - f * 0.45
      p.elbowL = p.elbowR = 0.5 - f * 0.2
      p.spinePitch = 0.08 - f * 0.1
      p.headPitch = -0.08 + f * 0.1
      addPose(p, s.w.air)
    }

    // seated (bench, chair, desk)
    if (s.w.sit > 0.001) {
      Object.assign(p, ZERO)
      p.hipY = -(HIP_Y - 0.06)
      p.thighL = p.thighR = 1.45
      p.kneeL = p.kneeR = 1.5
      p.footL = p.thighL - p.kneeL
      p.footR = p.thighR - p.kneeR
      p.thighOutL = 0.08
      p.thighOutR = -0.08
      p.spinePitch = -0.08
      p.chestPitch = 0.04
      p.armL = p.armR = 0.45
      p.armOutL = 0.12
      p.armOutR = -0.12
      p.elbowL = p.elbowR = 0.75
      p.headYaw = s.lookYaw * 0.7
      p.headPitch = Math.sin(t * 0.6) * 0.03
      addPose(p, s.w.sit)
    }

    const pose = s.pose
    const inv = wsum > 0 ? 1 / wsum : 0
    for (const key of KEYS) pose[key] = acc[key] * inv

    // ── overlays (upper body gestures layered on top) ─────────────────────
    if (ov.talk > 0.01) {
      const tk = ov.talk
      pose.armR += tk * (0.35 + Math.sin(t * 2.7) * 0.2)
      pose.elbowR += tk * (0.9 + Math.sin(t * 2.1) * 0.3)
      pose.armL += tk * pos(Math.sin(t * 1.6 + 2)) * 0.35
      pose.elbowL += tk * 0.45
      pose.headPitch += tk * Math.sin(t * 3.8) * 0.05
      pose.headRoll += tk * Math.sin(t * 1.2) * 0.05
      pose.chestYaw += tk * Math.sin(t * 1.1) * 0.08
    }
    if (ov.look > 0.01) {
      const lp = ov.look
      pose.armL += lp * -0.28
      pose.armR += lp * -0.28
      pose.elbowL += lp * 0.85
      pose.elbowR += lp * 0.85
      pose.headPitch += lp * 0.1
    }
    if (ov.phone > 0.01) {
      const ph = ov.phone
      pose.armR += ph * 0.35
      pose.armOutR += -ph * 0.35
      pose.elbowR += ph * 2.2
      pose.headRoll += ph * 0.1
      pose.headPitch += ph * 0.08
    }
    if (ov.wave > 0.01) {
      const wv = ov.wave
      pose.armOutR += -wv * 1.25
      pose.armR += wv * 0.25
      pose.elbowZR += -wv * (1.35 + Math.sin(t * 9) * 0.32)
      pose.headPitch += -wv * 0.05
      pose.chestYaw += -wv * 0.08
    }
    if (ov.work > 0.01) {
      const wk = ov.work
      pose.armL += wk * 0.35
      pose.armR += wk * 0.35
      pose.elbowL += wk * (0.55 + Math.sin(t * 11) * 0.03)
      pose.elbowR += wk * (0.55 + Math.sin(t * 13 + 1) * 0.03)
      pose.handL += wk * Math.sin(t * 14) * 0.08
      pose.handR += wk * Math.sin(t * 12 + 2) * 0.08
      pose.spinePitch += wk * 0.12
      pose.headPitch += wk * (0.08 + (Math.sin(t * 0.25) > 0.8 ? -0.1 : 0))
      pose.headYaw += wk * (Math.sin(t * 0.25) > 0.8 ? 0.5 : 0)
    }
    if (ov.read > 0.01) {
      const rd = ov.read
      pose.armL += rd * 0.5
      pose.armR += rd * 0.55
      pose.armOutL += -rd * 0.05
      pose.armOutR += rd * 0.05
      pose.elbowL += rd * 1.5
      pose.elbowR += rd * 1.55
      pose.headPitch += rd * 0.42
    }
    if (ov.coffee > 0.01) {
      const cf = ov.coffee
      pose.armR += cf * (0.3 + sipAmt * 0.3)
      pose.elbowR += cf * (1.35 + sipAmt * 0.95)
      pose.armOutR += -cf * 0.08
      pose.headPitch += -cf * sipAmt * 0.12
    }
    // gaze toward something interesting (e.g. the player walking past)
    pose.headYaw += s.gaze * 0.75
    pose.chestYaw += s.gaze * 0.25

    // additive landing absorption
    const li = clamp(anim.landImpact, 0, 1)
    pose.kneeL += li * 0.55
    pose.kneeR += li * 0.55
    pose.thighL += li * 0.35
    pose.thighR += li * 0.35
    pose.footL -= li * 0.2
    pose.footR -= li * 0.2
    pose.hipY -= li * 0.12
    pose.spinePitch += li * 0.12
    pose.armOutL += li * 0.2
    pose.armOutR -= li * 0.2

    // ── apply ──────────────────────────────────────────────────────────
    B.body.position.set(pose.hipX, pose.hipY, 0)
    B.body.rotation.z = s.roll
    B.hips.rotation.set(0, pose.hipYaw, pose.hipRoll)
    B.spine.rotation.set(pose.spinePitch, pose.spineYaw, -pose.hipRoll * 0.6)
    B.chest.rotation.set(pose.chestPitch, pose.chestYaw, 0)
    B.neck.rotation.set(pose.neckPitch + pose.headPitch * 0.35, pose.headYaw * 0.35, 0)
    B.head.rotation.set(pose.headPitch * 0.65, pose.headYaw * 0.65, pose.headRoll)
    B.legL.rotation.set(-pose.thighL, -pose.hipYaw * 0.6, pose.thighOutL)
    B.legR.rotation.set(-pose.thighR, -pose.hipYaw * 0.6, pose.thighOutR)
    B.kneeL.rotation.x = pose.kneeL
    B.kneeR.rotation.x = pose.kneeR
    B.footL.rotation.x = pose.footL
    B.footR.rotation.x = pose.footR
    B.toeL.rotation.x = pose.toeL
    B.toeR.rotation.x = pose.toeR
    B.armL.rotation.set(-pose.armL, 0, pose.armOutL)
    B.armR.rotation.set(-pose.armR, 0, pose.armOutR)
    B.elbowL.rotation.set(-pose.elbowL, 0, pose.elbowZL)
    B.elbowR.rotation.set(-pose.elbowR, 0, pose.elbowZR)
    B.handL.rotation.x = -pose.handL
    B.handR.rotation.x = -pose.handR

    // blink
    s.blinkIn -= dt
    if (s.blinkIn <= 0) {
      s.blink = 0.12
      s.blinkIn = 2.5 + ((Math.sin(t * 5.1) + 1) / 2) * 3.5
    }
    if (s.blink > 0) s.blink -= dt
    const ey = s.blink > 0 ? 0.15 : 1
    B.eyeL.scale.y = B.eyeR.scale.y = ey
  })

  return (
    <group scale={look.height}>
      <primitive object={rig.mesh} />
    </group>
  )
}
