import { useMemo } from 'react'
import { CircleGeometry, Color, ShaderMaterial } from 'three'
import type { WaterDef } from '@/utils/buildingGen'
import { worldUniforms } from '@/utils/materials'

/** Stylised water: concentric ripples, caustic sparkle and a soft fresnel rim. */
export function WaterSurfaces({ waters }: { waters: WaterDef[] }) {
  const geo = useMemo(() => {
    const g = new CircleGeometry(1, 40)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: worldUniforms.uTime,
          uDeep: { value: new Color('#5f8fd6') },
          uShallow: { value: new Color('#9fd3f2') },
          uFoam: { value: new Color('#f2fbff') },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vWorld;
          void main() {
            vUv = position.xz;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam;
          varying vec2 vUv; varying vec3 vWorld;
          void main() {
            float r = length(vUv);
            float ripple = sin(r * 22.0 - uTime * 3.0) * 0.5 + 0.5;
            float caustic = sin(vWorld.x * 3.1 + uTime * 1.3) * sin(vWorld.z * 2.7 - uTime * 1.1);
            vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.9, r));
            col += uFoam * smoothstep(0.75, 1.0, caustic) * 0.35;
            col += uFoam * ripple * 0.08 * (1.0 - r);
            col = mix(col, uFoam, smoothstep(0.9, 1.0, r) * 0.7);
            gl_FragColor = vec4(col, 0.9);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )
  return (
    <group>
      {waters.map((w, i) => (
        <mesh key={i} geometry={geo} material={mat} position={[w.x, w.y, w.z]} scale={[w.r, 1, w.r]} renderOrder={1} />
      ))}
    </group>
  )
}
