import { useMemo } from 'react'
import { Color, PlaneGeometry, ShaderMaterial } from 'three'
import type { ScreenDef } from '@/utils/buildingGen'
import { worldUniforms } from '@/utils/materials'

/**
 * Animated digital billboards: original generative visuals (no ads, no
 * branding) — flowing gradients, orbiting dots, and scrolling bands.
 */
export function Screens({ screens }: { screens: ScreenDef[] }) {
  const geo = useMemo(() => new PlaneGeometry(1, 1), [])
  const mats = useMemo(
    () =>
      [0, 1, 2].map(
        (variant) =>
          new ShaderMaterial({
            toneMapped: true,
            uniforms: {
              uTime: worldUniforms.uTime,
              uVariant: { value: variant },
              uA: { value: new Color('#2f3fb8') },
              uB: { value: new Color('#ef8a78') },
              uC: { value: new Color('#f5dd92') },
              uD: { value: new Color('#a996d4') },
            },
            vertexShader: /* glsl */ `
              varying vec2 vUv;
              void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: /* glsl */ `
              uniform float uTime; uniform float uVariant; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uD;
              varying vec2 vUv;
              void main() {
                vec2 uv = vUv;
                float t = uTime;
                vec3 col;
                if (uVariant < 0.5) {
                  float w = sin(uv.x * 6.0 + t * 0.8) * 0.5 + sin(uv.y * 5.0 - t * 0.6 + uv.x * 3.0) * 0.5;
                  col = mix(uA, uD, smoothstep(-0.6, 0.6, w));
                  col = mix(col, uB, smoothstep(0.55, 1.0, sin(uv.x * 3.0 - t * 0.5 + uv.y * 4.0)) * 0.7);
                  float ring = abs(length((uv - vec2(0.5 + 0.25 * sin(t * 0.4), 0.5)) * vec2(3.5, 1.0)) - 0.35 - 0.05 * sin(t));
                  col += uC * smoothstep(0.03, 0.0, ring) * 0.9;
                } else if (uVariant < 1.5) {
                  col = mix(uD, uB, uv.y);
                  for (int i = 0; i < 6; i++) {
                    float fi = float(i);
                    vec2 c = vec2(0.5 + 0.35 * sin(t * 0.6 + fi * 1.7), 0.5 + 0.3 * cos(t * 0.8 + fi * 2.1));
                    float d = length((uv - c) * vec2(1.9, 1.0));
                    col = mix(col, fi < 3.0 ? uC : uA, smoothstep(0.12, 0.1, d));
                  }
                } else {
                  float band = floor(fract(uv.y * 2.0 + t * 0.15) * 5.0);
                  col = band < 1.0 ? uA : band < 2.0 ? uB : band < 3.0 ? uC : band < 4.0 ? uD : vec3(0.98, 0.96, 0.92);
                  float sweep = smoothstep(0.02, 0.0, abs(fract(uv.x - t * 0.25) - 0.5) - 0.18);
                  col = mix(col, vec3(1.0), sweep * 0.25);
                }
                // scanlines + slight vignette give it a real display feel
                col *= 0.93 + 0.07 * sin(uv.y * 240.0);
                col *= 0.8 + 0.2 * smoothstep(0.0, 0.25, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)) * 4.0);
                gl_FragColor = vec4(col * 1.25, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
              }
            `,
          }),
      ),
    [],
  )
  return (
    <group>
      {screens.map((s, i) => (
        <mesh key={i} geometry={geo} material={mats[s.variant % 3]} position={s.position} rotation-y={s.yaw} scale={[s.width, s.height, 1]} />
      ))}
    </group>
  )
}
