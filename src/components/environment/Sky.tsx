import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, type Group, MeshBasicMaterial, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { createRng } from '@/utils/rng'
import { worldUniforms } from '@/utils/materials'
import { sky } from '@/core/dayNight'
import { INTRO, introRuntime } from '@/core/intro'
import { useGameStore } from '@/stores/gameStore'

/**
 * Sky dome driven by the time of day: zenith → horizon gradient, sun glow,
 * and after dusk a deep indigo sky with sparse, softly twinkling stars and a
 * gentle moon. Clouds take the colour of the hour.
 */
export const SUN_DIRECTION = new Vector3(-0.5, 0.62, -0.48).normalize()

export function Sky() {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color('#4f86cf') },
          uMid: { value: new Color('#9ec2e6') },
          uHorizon: { value: new Color('#e9e2d8') },
          uGlow: { value: new Color('#fff0d6') },
          uSun: { value: SUN_DIRECTION.clone() },
          uGlowI: { value: 0.55 },
          uStars: { value: 0 },
          uFog: { value: new Color('#dcdad4') },
          uFogBlend: { value: 0 },
          // placed in the north-east sky so it appears in the usual up-the-avenue views
          uMoonDir: { value: new Vector3(0.45, 0.42, -0.78).normalize() },
          uTime: worldUniforms.uTime,
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * p;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun;
          uniform float uGlowI; uniform float uStars; uniform vec3 uMoonDir; uniform float uTime; uniform vec3 uFog; uniform float uFogBlend;
          varying vec3 vDir;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main() {
            vec3 d = normalize(vDir);
            float h = clamp(d.y, -0.2, 1.0);
            vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
            col = mix(col, uTop, smoothstep(0.25, 0.85, h));
            float s = max(dot(d, uSun), 0.0);
            col += uGlow * pow(s, 8.0) * uGlowI;
            col += vec3(1.0, 0.93, 0.85) * pow(s, 400.0) * 1.2 * step(0.0, uSun.y);
            if (uStars > 0.001) {
              // sparse, small stars — fewer near the hazy horizon
              vec2 uv = vec2(atan(d.z, d.x) * 95.0, asin(clamp(d.y, -1.0, 1.0)) * 95.0);
              vec2 cell = floor(uv);
              float r = hash(cell);
              vec2 off = vec2(hash(cell + 7.1), hash(cell + 3.3)) - 0.5;
              float dist = length(fract(uv) - 0.5 - off * 0.6);
              float star = step(0.985, r) * smoothstep(0.16, 0.0, dist) * (0.55 + 0.45 * sin(uTime * (1.0 + r * 3.0) + r * 40.0));
              col += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.06, 0.35, d.y) * 0.9;
              // the moon: a soft disc with a faint halo
              float m = max(dot(d, uMoonDir), 0.0);
              col += vec3(0.9, 0.92, 0.98) * smoothstep(0.99965, 0.9998, m) * 0.55 * uStars;
              col += vec3(0.5, 0.56, 0.72) * pow(m, 900.0) * 0.12 * uStars;
            }
            col = mix(col, uHorizon * 1.02, smoothstep(0.02, -0.2, vDir.y));
            // after dusk the horizon band melts into the fog, so the fogged city has no visible edge
            col = mix(col, uFog, uFogBlend * smoothstep(0.22, -0.04, vDir.y));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )
  const geo = useMemo(() => new SphereGeometry(480, 32, 16), [])

  const clouds = useMemo(() => {
    const rng = createRng(12)
    const list: { pos: [number, number, number]; scale: [number, number, number] }[] = []
    for (let i = 0; i < 16; i++) {
      const a = rng.range(0, Math.PI * 2)
      const r = rng.range(220, 320)
      const y = rng.range(70, 130)
      const cx = Math.cos(a) * r
      const cz = Math.sin(a) * r
      const puffs = rng.int(3, 5)
      for (let j = 0; j < puffs; j++) {
        const s = rng.range(14, 26)
        list.push({ pos: [cx + rng.range(-22, 22), y + rng.range(-4, 5), cz + rng.range(-10, 10)], scale: [s * 1.6, s * 0.55, s] })
      }
    }
    return list
  }, [])
  const cloudMat = useMemo(() => new MeshBasicMaterial({ color: '#fbfbf8', fog: false, transparent: true, opacity: 0.92 }), [])
  const cloudGeo = useMemo(() => new SphereGeometry(1, 14, 10), [])
  const cloudGroup = useRef<Group>(null!)
  // clouds drift very slowly around the city; sky and clouds follow the hour
  useFrame((_, dt) => {
    cloudGroup.current.rotation.y += dt * 0.004
    const u = mat.uniforms
    u.uTop.value.copy(sky.top)
    u.uMid.value.copy(sky.mid)
    u.uHorizon.value.copy(sky.horizon)
    u.uGlow.value.copy(sky.glow)
    u.uGlowI.value = sky.glowIntensity
    u.uSun.value.copy(sky.sunDir)
    u.uStars.value = sky.stars
    u.uFog.value.copy(sky.fog)
    u.uFogBlend.value = sky.lights
    cloudMat.color.copy(sky.clouds)
    // at night clouds all but vanish into the sky rather than hang as pale discs
    cloudMat.opacity = 0.92 - sky.stars * 0.84
    // no clouds during the plane pass (the camera is up among them) and none at full night
    const g = useGameStore.getState()
    const planePass = (g.phase === 'loading' || g.phase === 'intro') && introRuntime.t < INTRO.planeEnd + 2.5
    cloudGroup.current.visible = sky.stars < 0.9 && !planePass
  })

  return (
    <group>
      <mesh geometry={geo} material={mat} renderOrder={-10} frustumCulled={false} />
      <group ref={cloudGroup}>
        {clouds.map((c, i) => (
          <mesh key={i} geometry={cloudGeo} material={cloudMat} position={c.pos} scale={c.scale} />
        ))}
      </group>
    </group>
  )
}
