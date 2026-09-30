import { Bloom, EffectComposer, FXAA, HueSaturation, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, VignetteTechnique } from 'postprocessing'
import { offFlags } from '@/utils/performance'

/**
 * Restrained post stack: half-resolution bloom only on genuinely bright
 * emitters (lamps, neon, the sun), colour-preserving neutral tone mapping,
 * a touch of saturation and a soft vignette. MSAA on high, FXAA on medium.
 * ?off=bloom,vignette,tone,hue isolates individual effects when profiling.
 */
export function PostProcessing({ multisampling, fxaa }: { multisampling: number; fxaa: boolean }) {
  const off = offFlags()
  return (
    <EffectComposer multisampling={multisampling} enableNormalPass={false}>
      {off.has('bloom') ? <></> : <Bloom mipmapBlur intensity={0.35} luminanceThreshold={1.7} luminanceSmoothing={0.2} radius={0.6} resolutionScale={0.5} />}
      {off.has('hue') ? <></> : <HueSaturation saturation={0.02} />}
      {off.has('tone') ? <></> : <ToneMapping mode={ToneMappingMode.NEUTRAL} />}
      {off.has('vignette') ? <></> : <Vignette technique={VignetteTechnique.DEFAULT} offset={0.32} darkness={0.42} />}
      {fxaa ? <FXAA /> : <></>}
    </EffectComposer>
  )
}
