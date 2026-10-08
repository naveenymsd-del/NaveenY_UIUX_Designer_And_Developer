import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { type Group, Vector3 } from 'three'
import { input, moveVector } from '@/core/input'
import { agentPositions, cameraRuntime, INTRO_FACING, playerRuntime, SPAWN, vehiclePositions } from '@/core/runtime'
import { STANDERS } from '@/data/npcPaths'
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
  const { world, rapier } = useRapier()

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
    let scripted = 0
    // ── guided walk (AI guide): steer along the route; any manual input takes over ──
    let autoSpeed = 0
    const aw = rt.autoWalk
    if (aw && enabled) {
      if (mv.magnitude > 0) {
        rt.autoWalk = null
        aw.done('manual')
      } else {
        const [tx, tz] = aw.points[aw.i]
        const wx = tx - rt.position.x
        const wz = tz - rt.position.z
        const wd = Math.hypot(wx, wz)
        const last = aw.i === aw.points.length - 1
        if (wd < (last ? 0.3 : 0.95)) {
          if (last) {
            rt.autoWalk = null
            if (aw.face !== undefined) rt.faceYaw = aw.face
            aw.done('arrived')
          } else {
            aw.i++
            aw.onAdvance?.(aw.i)
          }
        } else if (s.time < aw.holdUntil) {
          // giving way to a car: step back toward the curb, then wait for it to pass
          if (s.time < aw.backUntil) {
            const bx = aw.backX - rt.position.x
            const bz = aw.backZ - rt.position.z
            const bl = Math.hypot(bx, bz)
            if (bl > 0.2) {
              dx = bx / bl
              dz = bz / bl
              autoSpeed = MOVE.walkSpeed * 0.8
            }
          }
          aw.checkAt = s.time + 0.8
          aw.checkX = rt.position.x
          aw.checkZ = rt.position.z
        } else {
          // distance still to go along the route decides walk vs. jog; ease in on the final mark
          let remaining = wd
          for (let k = aw.i; k < aw.points.length - 1; k++) remaining += Math.hypot(aw.points[k + 1][0] - aw.points[k][0], aw.points[k + 1][1] - aw.points[k][1])
          autoSpeed = aw.run && remaining > 14 ? MOVE.runSpeed * 0.9 : MOVE.walkSpeed
          if (last) autoSpeed *= Math.min(1, 0.35 + wd / 1.6)
          dx = wx / wd
          dz = wz / wd
          // walk around people on the way: passers-by, and the groups standing on the sidewalks
          let px = 0
          let pz = 0
          const avoid = (ox: number, oz: number) => {
            const rx = ox - rt.position.x
            const rz = oz - rt.position.z
            const d = Math.hypot(rx, rz)
            if (d > 2.4 || d < 0.01) return
            const along = rx * dx + rz * dz
            if (along < 0.15 * d) return // only what's ahead
            // push away from the side the person is on (the part of r across our heading)
            const cx = rx - along * dx
            const cz = rz - along * dz
            const cl = Math.hypot(cx, cz) || 1
            const w = ((2.4 - d) / 2.4) * (along / d)
            px -= (cx / cl) * w
            pz -= (cz / cl) * w
          }
          if (!game.interior) {
            for (const [id, a] of agentPositions) if (id !== 'player') avoid(a.x, a.z)
            for (const st of STANDERS) avoid(st.pos[0], st.pos[1])
          }
          dx += px * 1.8
          dz += pz * 1.8
          // stuck on furniture or a lamp post: side-step left, then right, then give up
          if (s.time > aw.checkAt) {
            const moved = Math.hypot(rt.position.x - aw.checkX, rt.position.z - aw.checkZ)
            aw.stuck = moved < 0.3 ? aw.stuck + 1 : 0
            aw.checkAt = s.time + 0.8
            aw.checkX = rt.position.x
            aw.checkZ = rt.position.z
            // a car is what's in the way (it stops for us, we can't pass it): back off and let it go
            let car = Infinity
            for (const v of vehiclePositions.values()) car = Math.min(car, Math.hypot(v.x - rt.position.x, v.z - rt.position.z))
            if (aw.stuck > 0 && car < 5 && aw.yields < 6) {
              aw.yields++
              aw.stuck = 0
              // back to the curb we came from (the previous waypoint is on the sidewalk), not into the next lane
              const [bx, bz] = aw.i > 0 ? aw.points[aw.i - 1] : [rt.position.x - dx * 2.6, rt.position.z - dz * 2.6]
              aw.backX = bx
              aw.backZ = bz
              aw.backUntil = s.time + 3.2
              aw.holdUntil = s.time + 5.0
            }
            if (aw.stuck >= 3 && !last && aw.stuck % 3 === 0) {
              // something is in the way of this waypoint (a passer-by, a bench): aim for the next one
              aw.i++
            }
            if (aw.stuck >= 9) {
              if (import.meta.env.DEV) {
                const near = (m: Map<string, { x: number; z: number }>) => Math.min(Infinity, ...[...m.entries()].filter(([k]) => k !== 'player').map(([, v]) => Math.hypot(v.x - rt.position.x, v.z - rt.position.z)))
                // what's physically in the way: cast toward the waypoint and report the shape hit
                const hit = world.castRay(new rapier.Ray({ x: rt.position.x, y: rt.position.y + 0.9, z: rt.position.z }, { x: wx / wd, y: 0, z: wz / wd }), 3, true, undefined, undefined, col)
                const hc = hit?.collider
                const what = hc ? `${hc.shapeType()} at ${hc.translation().x.toFixed(1)}, ${hc.translation().z.toFixed(1)} (${hit!.timeOfImpact.toFixed(2)} m, ${hc.parent()?.isKinematic() ? 'kinematic' : 'fixed'})` : 'nothing within 3 m'
                const close: string[] = []
                world.forEachCollider((c) => {
                  if (c.handle === col.handle) return
                  const t = c.translation()
                  const d = Math.hypot(t.x - rt.position.x, t.z - rt.position.z)
                  if (d < 1.6) close.push(`shape ${c.shapeType()} @${t.x.toFixed(2)},${t.y.toFixed(2)},${t.z.toFixed(2)} ${c.parent()?.isKinematic() ? 'kinematic' : 'fixed'} d=${d.toFixed(2)}`)
                })
                console.info(`[guide] colliders within 1.6 m: ${close.join(' | ') || 'none'}`)
                console.info(`[guide] walk blocked near ${rt.position.x.toFixed(1)}, ${rt.position.z.toFixed(1)} → ${tx}, ${tz} · hit ${what} · nearest car ${near(vehiclePositions).toFixed(1)} m · nearest walker ${near(agentPositions).toFixed(1)} m`)
              }
              rt.autoWalk = null
              aw.done('stuck')
            } else if (aw.stuck > 0) {
              aw.side = aw.stuck % 2 ? 1 : -1
              aw.sideUntil = s.time + 0.8
              // snagged on something thin (a pole, a counter's corner): slide along it and away from it,
              // on the side that keeps us closest to the route
              aw.escX = 0
              aw.escZ = 0
              if (col) {
                const at = { x: rt.position.x, y: rt.position.y + 0.9, z: rt.position.z }
                const pr = world.projectPoint(at, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, col)
                if (pr) {
                  const nx = at.x - pr.point.x
                  const nz = at.z - pr.point.z
                  const nl = Math.hypot(nx, nz)
                  if (nl > 0.01 && nl < 0.9) {
                    const ux = nx / nl
                    const uz = nz / nl
                    let sx = -uz
                    let sz = ux
                    const toward = sx * wx + sz * wz
                    if (Math.abs(toward) > 0.05 * wd ? toward < 0 : aw.side < 0) {
                      sx = -sx
                      sz = -sz
                    }
                    aw.escX = sx + ux * 0.7
                    aw.escZ = sz + uz * 0.7
                  }
                }
              }
            }
          }
          if (s.time < aw.sideUntil) {
            if (aw.escX || aw.escZ) {
              dx = aw.escX
              dz = aw.escZ
            } else {
              dx += -dz * aw.side * 0.9
              dz += (wx / wd) * aw.side * 0.9
            }
          }
        }
      }
    }
    if (rt.walkTo && !enabled) {
      // a calm walk-in to a mark (the intro); stops cleanly on arrival
      const wx = rt.walkTo.x - rt.position.x
      const wz = rt.walkTo.z - rt.position.z
      const wd = Math.hypot(wx, wz)
      if (wd < 0.12) {
        if (rt.walkTo.face !== undefined) rt.faceYaw = rt.walkTo.face
        rt.walkTo = null
      }
      else {
        dx = wx
        dz = wz
        scripted = Math.min(1, wd / 0.9)
      }
    }
    const dl = Math.hypot(dx, dz)
    if (dl > 0) {
      dx /= dl
      dz /= dl
    }
    const usingStick = input.stick.x !== 0 || input.stick.y !== 0
    const sprint = enabled && (input.sprint || (usingStick && mv.magnitude > 0.92))
    const targetSpeed = autoSpeed || (scripted ? scripted * MOVE.walkSpeed * 0.62 : mv.magnitude * (sprint ? MOVE.runSpeed : MOVE.walkSpeed))
    const tvx = dx * targetSpeed
    const tvz = dz * targetSpeed

    // ── horizontal acceleration / deceleration ──────────────────────────
    const accelerating = targetSpeed > Math.hypot(s.vx, s.vz) - 0.01
    const k = s.grounded ? (mv.magnitude > 0 || autoSpeed > 0 ? (accelerating ? MOVE.groundAccel : MOVE.groundDecel) : MOVE.groundDecel) : MOVE.airAccel
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
    if (hs > 0.25 && (mv.magnitude > 0 || scripted > 0 || autoSpeed > 0)) {
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
    // seated: stand up as soon as the conversation is closed
    if (rt.seated && !game.activeLocationId) rt.seated = false
    anim.pose = rt.seated ? 'sit' : anim.pose === 'sit' ? 'none' : anim.pose
    visual.current.position.copy(_next)
    if (rt.seated) visual.current.position.y += 0.47
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
