import { Bloom, EffectComposer, FXAA, HueSaturation } from '@react-three/postprocessing'
import { offFlags } from '@/utils/performance'

/**
 * Restrained post stack: half-resolution bloom only on genuinely bright
 * emitters (lamps, neon, the sun), colour-preserving neutral tone mapping,
 * a touch of saturation. (No vignette: on dark or hazy skies it rendered as a pale blob.) MSAA on high, FXAA on medium.
 * ?off=bloom,vignette,tone,hue isolates individual effects when profiling.
 */
export function PostProcessing({ multisampling, fxaa }: { multisampling: number; fxaa: boolean }) {
  const off = offFlags()
  return (
    <EffectComposer multisampling={multisampling} enableNormalPass={false}>
      {off.has('bloom') ? <></> : <Bloom mipmapBlur intensity={0.35} luminanceThreshold={1.7} luminanceSmoothing={0.2} radius={0.6} resolutionScale={0.5} />}
      {off.has('hue') ? <></> : <HueSaturation saturation={0.02} />}
      {fxaa ? <FXAA /> : <></>}
    </EffectComposer>
  )
}
