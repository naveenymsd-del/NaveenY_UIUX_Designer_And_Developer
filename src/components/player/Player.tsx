import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { type Group, Vector3 } from 'three'
import { input, moveVector } from '@/core/input'
import { cameraRuntime, INTRO_FACING, playerRuntime, SPAWN } from '@/core/runtime'
import { WORLD_BOUNDS } from '@/data/cityLayout'
import { insideInterior } from '@/data/interiors'
import { controlsEnabled, useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { CharacterModel } from '@/components/models/CharacterModel'
import { PLAYER_LOOK } from '@/components/models/characterLook'
import { BlobShadow } from '@/components/effects/BlobShadow'
import { clamp, dampAngle, MOVE, wrapAngle } from '@/utils/movement'

const CAPSULE_HALF = 0.56
const CAPSULE_RADIUS = 0.28
const _desired = new Vector3()
const _next = new Vector3()

/**
 * Third-person player: a kinematic capsule moved by Rapier's character
 * controller (slopes, steps, snapping), with acceleration-based movement
 * relative to the camera, coyote time, jump buffering, landing detection and
 * out-of-bounds recovery. The visual model is a replaceable <CharacterModel>.
 */
export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)
  const visual = useRef<Group>(null!)
  const { world } = useRapier()

  // Created in an effect (not useMemo) so StrictMode's mount/unmount/remount
  // never leaves us holding a freed WASM controller.
  const controllerRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null)
  useEffect(() => {
    const c = world.createCharacterController(0.02)
    c.setUp({ x: 0, y: 1, z: 0 })
    c.enableAutostep(0.42, 0.05, true)
    c.enableSnapToGround(0.35)
    c.setMaxSlopeClimbAngle((52 * Math.PI) / 180)
    c.setMinSlopeSlideAngle((40 * Math.PI) / 180)
    c.setApplyImpulsesToDynamicBodies(true)
    c.setSlideEnabled(true)
    controllerRef.current = c
    return () => {
      controllerRef.current = null
      world.removeCharacterController(c)
    }
  }, [world])

  const st = useRef({
    vx: 0, vz: 0, vy: 0,
    grounded: true,
    lastGrounded: 0,
    airTime: 0,
    landTimer: 0,
    jumpedAt: -10,
    stepIndex: 0,
    safeTimer: 0,
    poseTimer: 0,
    time: 0,
    groundY: SPAWN.y,
  })
  const blob = useRef<Group>(null!)

  useFrame((_, rawDt) => {
    const rb = body.current
    const col = collider.current
    const controller = controllerRef.current
    if (!rb || !col || !controller) return
    const dt = Math.min(rawDt, 1 / 30)
    const s = st.current
    const rt = playerRuntime
    const anim = rt.anim
    s.time += dt

    // ── teleport requests (menu quick-travel, out-of-bounds recovery) ───
    if (rt.teleportRequest) {
      const { position, yaw } = rt.teleportRequest
      rb.setTranslation(position, true)
      rb.setNextKinematicTranslation(position)
      rt.position.copy(position)
      if (yaw !== undefined) {
        rt.yaw = yaw
        cameraRuntime.yaw = cameraRuntime.targetYaw = wrapAngle(yaw + Math.PI)
      }
      s.vx = s.vz = s.vy = 0
      rt.teleportRequest = null
      cameraRuntime.snap = true
      return
    }

    const game = useGameStore.getState()
    const enabled = controlsEnabled(game)
    const mv = enabled ? moveVector() : { x: 0, y: 0, magnitude: 0 }

    // camera-relative direction: forward = (-sinθ, -cosθ), right = (cosθ, -sinθ)
    const th = cameraRuntime.yaw
    const fx = -Math.sin(th)
    const fz = -Math.cos(th)
    const rx = Math.cos(th)
    const rz = -Math.sin(th)
    let dx = fx * mv.y + rx * mv.x
    let dz = fz * mv.y + rz * mv.x
    const dl = Math.hypot(dx, dz)
    if (dl > 0) {
      dx /= dl
      dz /= dl
    }
    const usingStick = input.stick.x !== 0 || input.stick.y !== 0
    const sprint = enabled && (input.sprint || (usingStick && mv.magnitude > 0.92))
    const targetSpeed = mv.magnitude * (sprint ? MOVE.runSpeed : MOVE.walkSpeed)
    const tvx = dx * targetSpeed
    const tvz = dz * targetSpeed

    // ── horizontal acceleration / deceleration ──────────────────────────
    const accelerating = targetSpeed > Math.hypot(s.vx, s.vz) - 0.01
    const k = s.grounded ? (mv.magnitude > 0 ? (accelerating ? MOVE.groundAccel : MOVE.groundDecel) : MOVE.groundDecel) : MOVE.airAccel
    const blend = 1 - Math.exp(-k * dt)
    s.vx += (tvx - s.vx) * blend
    s.vz += (tvz - s.vz) * blend
    if (Math.hypot(s.vx, s.vz) < 0.03 && targetSpeed === 0) s.vx = s.vz = 0

    // ── jumping: coyote time + input buffering ──────────────────────────
    const now = performance.now()
    const buffered = enabled && input.jumpPressedAt > 0 && now - input.jumpPressedAt < MOVE.jumpBuffer * 1000
    const canJump = s.grounded || s.time - s.lastGrounded < MOVE.coyoteTime
    if (buffered && canJump && s.time - s.jumpedAt > 0.25) {
      s.vy = MOVE.jumpVelocity
      s.jumpedAt = s.time
      s.grounded = false
      input.jumpPressedAt = -1
      rt.onJump.forEach((f) => f())
    }

    s.vy -= MOVE.gravity * dt
    if (s.vy < -MOVE.maxFall) s.vy = -MOVE.maxFall
    // small stick-down only: snap-to-ground keeps us planted; a large value fights slopes and steps at walking speed
    if (s.grounded && s.vy < 0) s.vy = -0.35

    if (s.vy > 0) controller.disableSnapToGround()
    else controller.enableSnapToGround(0.35)

    _desired.set(s.vx * dt, s.vy * dt, s.vz * dt)
    controller.computeColliderMovement(col, _desired, undefined, undefined, (c) => !c.isSensor())
    const moved = controller.computedMovement()
    const wasGrounded = s.grounded
    s.grounded = controller.computedGrounded()

    // hitting a wall kills the velocity into it (no sticky accumulation)
    // (not while climbing: on slopes and stairs the controller trades horizontal distance for height)
    const climbing = moved.y > _desired.y + 1e-4
    if (dt > 0 && !climbing) {
      if (Math.abs(moved.x) < Math.abs(_desired.x) - 1e-4) s.vx = moved.x / dt
      if (Math.abs(moved.z) < Math.abs(_desired.z) - 1e-4) s.vz = moved.z / dt
      if (s.vy > 0 && moved.y < _desired.y - 1e-4) s.vy = 0 // bumped a ceiling
    }

    const cur = rb.translation()
    _next.set(cur.x + moved.x, cur.y + moved.y, cur.z + moved.z)
    rb.setNextKinematicTranslation(_next)
    rt.position.copy(_next)

    // ── ground / air state ─────────────────────────────────────────────
    if (s.grounded) {
      if (!wasGrounded && s.airTime > 0.18) {
        const impact = clamp((-anim.vy - 2) / 10, 0.15, 1)
        anim.landImpact = impact
        s.landTimer = 0.14 + impact * 0.12
        rt.onLand.forEach((f) => f(impact))
      }
      s.lastGrounded = s.time
      s.airTime = 0
    } else s.airTime += dt
    anim.landImpact = Math.max(0, anim.landImpact - dt * 4.2)
    s.landTimer = Math.max(0, s.landTimer - dt)

    // ── facing: smooth, speed-limited turning toward the travel direction ──
    const hs = Math.hypot(s.vx, s.vz)
    const prevYaw = rt.yaw
    if (hs > 0.25 && mv.magnitude > 0) {
      rt.yaw = dampAngle(rt.yaw, Math.atan2(s.vx, s.vz), MOVE.turnLambda, dt, MOVE.maxTurnSpeed)
      rt.faceYaw = null
    } else if (rt.faceYaw !== null) {
      // scripted turn on the spot (intro hand-off): unhurried, with shuffle steps
      rt.yaw = dampAngle(rt.yaw, rt.faceYaw, 3.2, dt, 2.6)
      if (Math.abs(wrapAngle(rt.faceYaw - rt.yaw)) < 0.02) rt.faceYaw = null
    }
    const turnRate = wrapAngle(rt.yaw - prevYaw) / Math.max(dt, 1e-4)

    // ── animation data (model-agnostic) ────────────────────────────────
    // stride blends with the same walk→run weight the rig uses, so the phase
    // speed always matches the leg swing (no skating during transitions)
    const runT = Math.min(1, Math.max(0, (hs - MOVE.walkSpeed * 1.05) / (MOVE.runSpeed - MOVE.walkSpeed * 1.05)))
    const stride = anim.walkStride + (anim.runStride - anim.walkStride) * runT
    // turning on the spot: take small shuffle steps instead of spinning on planted feet
    const shuffle = s.grounded && hs < 0.35 && Math.abs(turnRate) > 1.2 ? Math.min(1, Math.abs(turnRate) / 5) : 0
    anim.phase += ((hs * dt) / stride) * Math.PI * 2 + shuffle * dt * 7
    anim.speed = s.grounded ? Math.max(hs, shuffle * 0.9) : anim.speed
    anim.vy = s.vy
    anim.grounded = s.grounded
    anim.turnRate = anim.turnRate + (turnRate - anim.turnRate) * (1 - Math.exp(-10 * dt))
    const fwdX = Math.sin(rt.yaw)
    const fwdZ = Math.cos(rt.yaw)
    anim.strafe = s.vx * -fwdZ + s.vz * fwdX
    anim.walkSpeed = MOVE.walkSpeed
    anim.runSpeed = MOVE.runSpeed
    let state = anim.state
    if (!s.grounded && s.airTime > 0.05) state = s.vy > 0.5 ? 'jump' : s.airTime > 0.16 ? 'fall' : state
    else if (s.grounded) state = s.landTimer > 0 && hs < 1.5 ? 'land' : hs < 0.2 ? 'idle' : hs > MOVE.walkSpeed + 0.4 ? 'run' : 'walk'
    anim.state = state

    // footsteps on each foot plant
    const stepIdx = Math.floor(anim.phase / Math.PI)
    if (stepIdx !== s.stepIndex) {
      s.stepIndex = stepIdx
      if (s.grounded && hs > 0.8) rt.onFootstep.forEach((f) => f(hs > MOVE.walkSpeed + 0.4))
    }

    rt.velocity.set(s.vx, s.vy, s.vz)
    rt.grounded = s.grounded

    // ── visual follow ──────────────────────────────────────────────────
    visual.current.position.copy(_next)
    visual.current.rotation.y = rt.yaw
    if (s.grounded) s.groundY = _next.y
    const height = Math.max(0, _next.y - s.groundY)
    blob.current.position.set(_next.x, s.groundY + 0.025, _next.z)
    blob.current.scale.setScalar(Math.max(0.45, 1 - height * 0.25))

    // ── safety: remember safe ground, recover if we ever leave the world ──
    s.safeTimer += dt
    const inBounds = (_next.x > WORLD_BOUNDS.minX - 2 && _next.x < WORLD_BOUNDS.maxX + 2 && _next.z > WORLD_BOUNDS.minZ - 2 && _next.z < WORLD_BOUNDS.maxZ + 2) || insideInterior(_next.x, _next.z) !== null
    if (s.grounded && inBounds && s.safeTimer > 0.5 && _next.y < 3) {
      rt.lastSafe.copy(_next)
      s.safeTimer = 0
    }
    if (_next.y < -6 || !inBounds) rt.teleportRequest = { position: rt.lastSafe.clone().setY(rt.lastSafe.y + 0.5) }

    // low-frequency UI store updates
    s.poseTimer += dt
    if (s.poseTimer > 0.12) {
      s.poseTimer = 0
      usePlayerStore.getState().setPose(_next.x, _next.z, rt.yaw)
    }
    usePlayerStore.getState().setMoveState(state)
  }, -3)

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[SPAWN.x, SPAWN.y, SPAWN.z]} enabledRotations={[false, false, false]} name="player">
        <CapsuleCollider ref={collider} args={[CAPSULE_HALF, CAPSULE_RADIUS]} position={[0, CAPSULE_HALF + CAPSULE_RADIUS + 0.02, 0]} />
      </RigidBody>
      <group ref={visual} position={[SPAWN.x, SPAWN.y, SPAWN.z]} rotation-y={INTRO_FACING}>
        <CharacterModel anim={playerRuntime.anim} look={PLAYER_LOOK} asset="character" />
      </group>
      <group ref={blob}>
        <BlobShadow size={1.15} opacity={0.4} />
      </group>
    </>
  )
}
