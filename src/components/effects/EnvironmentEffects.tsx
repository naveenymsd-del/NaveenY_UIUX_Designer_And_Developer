import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Group, InstancedMesh, type Mesh, MeshBasicMaterial, Object3D, Points, RingGeometry,
  ShaderMaterial, SphereGeometry, BoxGeometry,
} from 'three'
import { cameraRuntime, playerRuntime } from '@/core/runtime'
import { FOUNTAIN_POS, SIDEWALK_Y } from '@/data/cityLayout'
import { worldUniforms } from '@/utils/materials'
import { createRng } from '@/utils/rng'
import { softDotTexture } from '@/utils/textures'
import { getLocation } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'

/** Advances the shared shader clock (wind, water, screens). */
export function WorldClock() {
  useFrame(({ clock, camera }) => {
    worldUniforms.uTime.value = clock.elapsedTime
    worldUniforms.uCamPos.value.copy(camera.position)
  })
  return null
}

/** Floating petals / pollen motes drifting around the camera. */
export function AmbientParticles({ count = 160 }: { count?: number }) {
  const ref = useRef<Points>(null!)
  const { geo, mat } = useMemo(() => {
    const rng = createRng(4)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos.set([rng.range(-30, 30), rng.range(0.3, 9), rng.range(-30, 30)], i * 3)
      seed[i] = rng.next()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: worldUniforms.uTime, uCenter: { value: cameraRuntime.position }, uMap: { value: softDotTexture() } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform vec3 uCenter; varying float vSeed; varying float vFade;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.3 + aSeed * 40.0) * 2.0 + uTime * 0.35;
          p.z += cos(uTime * 0.25 + aSeed * 30.0) * 2.0;
          p.y += sin(uTime * 0.6 + aSeed * 12.0) * 0.6;
          // wrap inside a 60 m box that follows the camera
          vec3 rel = mod(p - uCenter + 30.0, 60.0) - 30.0;
          vec3 w = uCenter + rel;
          w.y = mod(p.y, 9.0) + 0.3;
          vec4 mv = viewMatrix * vec4(w, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (18.0 + aSeed * 22.0) / -mv.z;
          vSeed = aSeed;
          vFade = smoothstep(30.0, 18.0, length(rel.xz));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying float vSeed; varying float vFade;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          vec3 c = mix(vec3(1.0, 0.8, 0.9), vec3(1.0, 0.97, 0.8), step(0.5, vSeed));
          gl_FragColor = vec4(c, t.a * 0.55 * vFade);
        }
      `,
    })
    return { geo: g, mat: m }
  }, [count])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/** GPU fountain spray: parabolic droplets computed entirely in the vertex shader. */
export function FountainSpray() {
  const { geo, mat } = useMemo(() => {
    const rng = createRng(21)
    const n = 360
    const seeds = new Float32Array(n * 3)
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) seeds.set([rng.next(), rng.next(), rng.next()], i * 3)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seeds, 3))
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: worldUniforms.uTime, uMap: { value: softDotTexture() }, uOrigin: { value: [FOUNTAIN_POS[0], SIDEWALK_Y + 3.2, FOUNTAIN_POS[1]] } },
      vertexShader: /* glsl */ `
        attribute vec3 aSeed; uniform float uTime; uniform vec3 uOrigin; varying float vLife;
        void main() {
          float life = 1.6;
          float t = mod(uTime + aSeed.x * life, life);
          float a = aSeed.y * 6.2831;
          bool ring = aSeed.z > 0.6;
          float sp = ring ? 1.1 : 0.55 + aSeed.z * 0.5;
          float up = ring ? 3.2 : 4.2;
          vec3 origin = ring ? uOrigin + vec3(cos(a) * 1.3, -1.25, sin(a) * 1.3) : uOrigin;
          vec3 v = ring ? vec3(-cos(a) * 0.35, up * 0.7, -sin(a) * 0.35) : vec3(cos(a) * sp, up, sin(a) * sp);
          vec3 p = origin + v * t + vec3(0.0, -4.9, 0.0) * t * t;
          vLife = t / life;
          if (p.y < uOrigin.y - 2.75) p.y = -100.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 26.0 / -mv.z;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying float vLife;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(0.85, 0.95, 1.0), t.a * 0.75 * (1.0 - vLife * 0.5));
          #include <colorspace_fragment>
        }
      `,
    })
    return { geo: g, mat: m }
  }, [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

/** Dust puffs on jump and landing — a tiny pooled sprite system. */
export function DustPuffs() {
  const POOL = 24
  const mesh = useRef<InstancedMesh>(null!)
  const data = useMemo(() => Array.from({ length: POOL }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, s: 0 })), [])
  const dummy = useMemo(() => new Object3D(), [])
  const next = useRef(0)
  const geo = useMemo(() => new SphereGeometry(0.5, 8, 6), [])
  const mat = useMemo(() => new MeshBasicMaterial({ color: new Color('#fbeef6'), transparent: true, opacity: 0.38, depthWrite: false }), [])

  useEffect(() => {
    const spawn = (n: number, power: number) => {
      const p = playerRuntime.position
      for (let i = 0; i < n; i++) {
        const d = data[next.current++ % POOL]
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
        const sp = (0.8 + Math.random() * 0.8) * power
        d.life = 1
        d.x = p.x + Math.cos(a) * 0.2
        d.y = p.y + 0.08
        d.z = p.z + Math.sin(a) * 0.2
        d.vx = Math.cos(a) * sp
        d.vz = Math.sin(a) * sp
        d.s = 0.12 + Math.random() * 0.08
      }
    }
    const onJump = () => spawn(6, 1)
    const onLand = (impact: number) => spawn(Math.round(6 + impact * 8), 0.8 + impact * 1.4)
    playerRuntime.onJump.add(onJump)
    playerRuntime.onLand.add(onLand)
    return () => {
      playerRuntime.onJump.delete(onJump)
      playerRuntime.onLand.delete(onLand)
    }
  }, [data])

  useFrame((_, dt) => {
    let visible = 0
    for (let i = 0; i < POOL; i++) {
      const d = data[i]
      if (d.life <= 0) {
        dummy.scale.setScalar(0)
      } else {
        d.life -= dt * 2.6
        d.x += d.vx * dt
        d.z += d.vz * dt
        d.y += dt * 0.35
        d.vx *= 0.92
        d.vz *= 0.92
        const s = d.s * (1 + (1 - d.life) * 2.2) * Math.max(0, d.life) ** 0.5
        dummy.position.set(d.x, d.y, d.z)
        dummy.scale.setScalar(s)
        visible++
      }
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.visible = visible > 0
  })
  return <instancedMesh ref={mesh} args={[geo, mat, POOL]} frustumCulled={false} />
}

/** Soft expanding ring at the player's feet when an interaction comes into range. */
export function FeedbackPulse() {
  const mesh = useRef<Mesh>(null!)
  const st = useRef({ t: 1, color: new Color('#2f3fb8') })
  const geo = useMemo(() => {
    const g = new RingGeometry(0.85, 1, 48)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const mat = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), [])
  useEffect(
    () =>
      useGameStore.subscribe((s, prev) => {
        if (s.pulse && s.pulse !== prev.pulse && s.pulse.kind === 'enter') {
          st.current.t = 0
          const loc = getLocation(s.nearbyId)
          st.current.color.set(loc?.accent ?? '#2f3fb8')
        }
      }),
    [],
  )
  useFrame((_, dt) => {
    const s = st.current
    s.t = Math.min(1, s.t + dt * 1.4)
    const m = mesh.current
    m.visible = s.t < 1
    if (!m.visible) return
    const p = playerRuntime.position
    m.position.set(p.x, p.y + 0.04, p.z)
    const r = 0.4 + s.t * 2.2
    m.scale.set(r, 1, r)
    mat.color.copy(s.color).multiplyScalar(1 - s.t)
  })
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={5} visible={false} />
}

/** A few birds gliding and flapping high over the neighbourhood. */
export function Birds() {
  const group = useRef<Group>(null!)
  const birds = useMemo(() => {
    const rng = createRng(8)
    return Array.from({ length: 7 }, (_, i) => ({ r: rng.range(30, 60), h: rng.range(26, 40), speed: rng.range(0.08, 0.14) * (i % 2 ? 1 : -1), phase: rng.range(0, 6.28), cx: rng.range(-20, 20), cz: rng.range(-30, 40) }))
  }, [])
  const wing = useMemo(() => new BoxGeometry(0.9, 0.04, 0.35), [])
  const bodyGeo = useMemo(() => new BoxGeometry(0.22, 0.16, 0.5), [])
  const mat = useMemo(() => new MeshBasicMaterial({ color: '#4a3f6b' }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    group.current.children.forEach((b, i) => {
      const d = birds[i]
      const a = d.phase + t * d.speed
      b.position.set(d.cx + Math.cos(a) * d.r, d.h + Math.sin(t * 0.7 + i) * 1.2, d.cz + Math.sin(a) * d.r)
      b.rotation.y = -a + (d.speed > 0 ? 0 : Math.PI)
      const flap = Math.sin(t * 9 + i * 2) * 0.55
      b.children[0].rotation.z = flap
      b.children[1].rotation.z = -flap
    })
  })
  return (
    <group ref={group}>
      {birds.map((_, i) => (
        <group key={i}>
          <mesh geometry={wing} material={mat} position={[0.45, 0, 0]} />
          <mesh geometry={wing} material={mat} position={[-0.45, 0, 0]} />
          <mesh geometry={bodyGeo} material={mat} />
        </group>
      ))}
    </group>
  )
}
