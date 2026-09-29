import { useFrame, useThree } from '@react-three/fiber'
import { interactionGroups, useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { type PerspectiveCamera, Vector3 } from 'three'
import { CAMERA_DEFAULTS, cameraRuntime, cinematicRuntime, playerRuntime } from '@/core/runtime'
import { INTRO, introCamera, introRuntime } from '@/core/intro'
import { getLocation } from '@/data/locations'
import { INTERIORS, roomToWorld, type InteriorId } from '@/data/interiors'
import { getProject, PROJECTS_OVERVIEW_CAMERA } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'
import { clamp, damp, dampAngle, easeInOutCubic, smoothstep, wrapAngle } from '@/utils/movement'

/** Camera ray only hits static geometry in group 0 (walls live in group 1). */
export const CAMERA_RAY_GROUPS = interactionGroups(0, [0])

interface CamPose {
  pos: Vector3
  target: Vector3
}

function shotKey(): string {
  const g = useGameStore.getState()
  if (g.shotOverride) return 'override'
  if (g.phase === 'loading' || g.phase === 'intro') return introRuntime.t >= INTRO.heroAt ? 'hero' : 'intro'
  if (g.establishing) return `establish:${g.establishing}:${g.establishSpot ?? ''}`
  if (g.cameraShot) return `loc:${g.cameraShot}`
  if (g.activeProjectId) return `project:${g.activeProjectId}`
  if (g.activeLocationId) return `loc:${g.activeLocationId}`
  if (g.mode === 'projects') return g.focusedProjectId ? `project:${g.focusedProjectId}` : 'projects'
  return 'follow'
}

function durationFor(from: string, to: string) {
  // cut instantly into a room (we are behind a fade), then ease out of the establishing shot
  if (to.startsWith('establish')) return 0.001
  if (from.startsWith('establish')) return 1.8
  // the flight lands exactly on the hero pose; a skip glides there instead of cutting
  if (from === 'intro' && to === 'hero') return introRuntime.skipped ? 1.7 : 0.001
  if ((from === 'intro' || from === 'hero') && to === 'follow') return 3.2
  if (to === 'follow') return 1.35
  if (from === 'follow') return 1.6
  if (to === 'projects' || from === 'projects') return 1.8
  return 1.4
}

const _dir = new Vector3()
const _tmp = new Vector3()

/**
 * Camera director. Every frame it evaluates the "live" pose for the current
 * shot (intro orbit, third-person follow, location / project shots) and eases
 * from the pose the camera had when the shot changed. The follow pose is
 * always simulated so returning to gameplay is seamless.
 */
export function GameCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const { world, rapier } = useRapier()
  const portrait = size.height > size.width

  useEffect(() => {
    camera.fov = portrait ? 62 : size.width < 1100 ? 56 : 52
    camera.near = 0.2
    camera.far = 1100
    camera.updateProjectionMatrix()
  }, [camera, portrait, size.width])

  const st = useRef({
    key: '',
    t: 1,
    duration: 1,
    from: { pos: new Vector3(90, 70, 130), target: new Vector3(0, 0, 0) } as CamPose,
    cur: { pos: new Vector3(90, 70, 130), target: new Vector3(0, 0, 0) } as CamPose,
    live: { pos: new Vector3(), target: new Vector3() } as CamPose,
    follow: { pos: new Vector3(), target: new Vector3(), init: false, dist: CAMERA_DEFAULTS.distance, look: new Vector3() },
    time: 0,
  })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = st.current
    s.time += dt
    const game = useGameStore.getState()
    if (game.phase === 'intro') {
      introRuntime.running = true
      introRuntime.t += dt
    }

    // ── follow camera simulation ───────────────────────────────────────
    const f = s.follow
    const p = playerRuntime.position
    const v = playerRuntime.velocity
    const speed = Math.hypot(v.x, v.z)
    if (!f.init || cameraRuntime.snap) {
      f.target.set(p.x, p.y + CAMERA_DEFAULTS.targetHeight, p.z)
      cameraRuntime.yaw = cameraRuntime.targetYaw
      f.init = true
    }
    // gentle auto-align behind the player while walking forward-ish
    const sinceInput = (performance.now() - cameraRuntime.lastUserInput) / 1000
    if (game.phase === 'playing' && speed > 1.2 && sinceInput > 1.4) {
      const behind = Math.atan2(-v.x, -v.z)
      const diff = Math.abs(wrapAngle(behind - cameraRuntime.targetYaw))
      if (diff < 1.25) cameraRuntime.targetYaw = dampAngle(cameraRuntime.targetYaw, behind, 0.9 * clamp(speed / 5, 0.3, 1), dt)
    }
    cameraRuntime.yaw = dampAngle(cameraRuntime.yaw, cameraRuntime.targetYaw, 14, dt)
    cameraRuntime.pitch = damp(cameraRuntime.pitch, cameraRuntime.targetPitch, 14, dt)

    // target lag: tighter horizontally, looser vertically (jumps feel airy)
    f.target.x = damp(f.target.x, p.x, 12, dt)
    f.target.z = damp(f.target.z, p.z, 12, dt)
    f.target.y = damp(f.target.y, p.y + CAMERA_DEFAULTS.targetHeight, playerRuntime.grounded ? 8 : 3.5, dt)
    f.look.x = damp(f.look.x, clamp(v.x * 0.14, -1.2, 1.2), 3, dt)
    f.look.z = damp(f.look.z, clamp(v.z * 0.14, -1.2, 1.2), 3, dt)

    // cinematic reveal envelope (player keeps control)
    let cw = 0
    if (cinematicRuntime.active) {
      const ct = s.time - cinematicRuntime.start
      cw = smoothstep(0, 0.9, ct) * (1 - smoothstep(2.6, 3.8, ct))
      if (ct > 3.8) cinematicRuntime.active = false
    }
    const yaw = cameraRuntime.yaw
    const pitch = cameraRuntime.pitch + cw * 0.2
    const portraitBoost = portrait ? 1.2 : 0
    const want = cameraRuntime.distance + portraitBoost + cw * 2.8
    _dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    // collision: ray from the look target toward the desired camera position
    let allowed = want
    const ray = new rapier.Ray(f.target, _dir)
    const hit = world.castRay(
      ray, want + 0.4, true,
      rapier.QueryFilterFlags.EXCLUDE_KINEMATIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_DYNAMIC,
      CAMERA_RAY_GROUPS,
    )
    if (hit) allowed = Math.max(1.3, hit.timeOfImpact - 0.4)
    f.dist = allowed < f.dist ? damp(f.dist, allowed, 22, dt) : damp(f.dist, allowed, 2.6, dt)
    f.pos.copy(f.target).addScaledVector(_dir, f.dist)
    if (f.pos.y < 0.55) f.pos.y = 0.55
    const followTarget = _tmp.set(f.target.x + f.look.x, f.target.y - 0.05, f.target.z + f.look.z)
    if (cw > 0) followTarget.lerp(cinematicRuntime.reveal, cw * 0.32)

    // ── live pose for the active shot ───────────────────────────────────
    const key = shotKey()
    if (key !== s.key) {
      s.duration = s.key === '' ? 0.001 : durationFor(s.key, key)
      s.from.pos.copy(s.cur.pos)
      s.from.target.copy(s.cur.target)
      s.t = 0
      s.key = key
    }
    const live = s.live
    if (key === 'override' && game.shotOverride) {
      live.pos.set(...game.shotOverride.position)
      live.target.set(...game.shotOverride.target)
    } else if (key === 'intro' || key === 'hero') {
      introCamera(introRuntime.t, live.pos, live.target, portrait)
    } else if (key === 'follow') {
      live.pos.copy(f.pos)
      live.target.copy(followTarget)
    } else if (key === 'projects') {
      const a = Math.sin(s.time * 0.12) * 0.12
      const c = PROJECTS_OVERVIEW_CAMERA
      const ox = c.position[0] - c.target[0]
      const oz = c.position[2] - c.target[2]
      live.pos.set(c.target[0] + ox * Math.cos(a) - oz * Math.sin(a), c.position[1], c.target[2] + ox * Math.sin(a) + oz * Math.cos(a))
      live.target.set(...c.target)
    } else if (key.startsWith('establish:')) {
      const [, id, spot] = key.split(':') as [string, InteriorId, string]
      const e = (spot && INTERIORS[id].spots?.[spot]?.establish) || INTERIORS[id].establish
      const drift = Math.sin(s.time * 0.3) * 0.15
      live.pos.set(...roomToWorld(id, e.position[0] + drift, e.position[2], e.position[1]))
      live.target.set(...roomToWorld(id, e.target[0], e.target[2], e.target[1]))
    } else {
      const [kind, id] = key.split(':')
      const proj = kind === 'project' ? getProject(id) : null
      // inside the office a project is framed on its studio screen; on the street, at its pavilion
      const shot = proj ? (game.interior === 'office' ? getLocation(`studio-${proj.id}`)?.cameraTarget : proj.camera) : getLocation(id)?.cameraTarget
      if (shot) {
        const sway = Math.sin(s.time * 0.5) * 0.12
        live.pos.set(shot.position[0] + sway, shot.position[1] + Math.sin(s.time * 0.37) * 0.06, shot.position[2])
        live.target.set(...shot.target)
      }
    }

    s.t = Math.min(1, s.t + dt / s.duration)
    const e = easeInOutCubic(s.t)
    if (cameraRuntime.snap && key === 'follow') {
      s.t = 1
      cameraRuntime.snap = false
      s.cur.pos.copy(live.pos)
      s.cur.target.copy(live.target)
    } else {
      s.cur.pos.lerpVectors(s.from.pos, live.pos, e)
      s.cur.target.lerpVectors(s.from.target, live.target, e)
      // lift the camera through the middle of long transitions so it never clips through buildings
      if (s.t < 1 && s.duration > 1.2) s.cur.pos.y += Math.sin(Math.PI * e) * Math.min(6, s.from.pos.distanceTo(live.pos) * 0.12)
    }
    cameraRuntime.snap = false

    camera.position.copy(s.cur.pos)
    camera.lookAt(s.cur.target)
    cameraRuntime.position.copy(camera.position)

    if (game.phase === 'transition' && key === 'follow' && s.t >= 1) {
      game.setPhase('playing')
      game.setTipsOpen(true)
    }
  }, -1)

  return null
}
