import { Bloom, EffectComposer, FXAA, HueSaturation, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, VignetteTechnique } from 'postprocessing'

/**
 * Restrained post stack: half-resolution bloom only on genuinely bright
 * emitters (lamps, neon, the sun), colour-preserving neutral tone mapping,
 * a touch of saturation and a soft vignette. MSAA on high, FXAA on medium.
 */
export function PostProcessing({ multisampling, fxaa }: { multisampling: number; fxaa: boolean }) {
  return (
    <EffectComposer multisampling={multisampling} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.35} luminanceThreshold={1.7} luminanceSmoothing={0.2} radius={0.6} resolutionScale={0.5} />
      <HueSaturation saturation={0.02} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette technique={VignetteTechnique.ESKIL} offset={0.5} darkness={0.28} />
      {fxaa ? <FXAA /> : <></>}
    </EffectComposer>
  )
}
