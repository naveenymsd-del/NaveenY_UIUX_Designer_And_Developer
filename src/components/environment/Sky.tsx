import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, type Group, MeshBasicMaterial, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { createRng } from '@/utils/rng'
import { worldUniforms } from '@/utils/materials'

/** Natural daylight sky: blue zenith, warm hazy horizon, soft sun and drifting clouds. */
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
          uSun: { value: SUN_DIRECTION },
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
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, -0.2, 1.0);
            vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
            col = mix(col, uTop, smoothstep(0.25, 0.85, h));
            float s = max(dot(normalize(vDir), uSun), 0.0);
            col += uGlow * pow(s, 8.0) * 0.55;
            col += vec3(1.0, 0.93, 0.85) * pow(s, 400.0) * 1.2;
            col = mix(col, uHorizon * 1.02, smoothstep(0.02, -0.2, vDir.y));
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
  // clouds drift very slowly around the city
  useFrame((_, dt) => {
    cloudGroup.current.rotation.y += dt * 0.004
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
