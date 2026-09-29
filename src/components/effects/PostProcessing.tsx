import { Bloom, EffectComposer, FXAA, HueSaturation, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * Restrained post stack: half-resolution bloom only on genuinely bright
 * emitters (lamps, neon, the sun), colour-preserving neutral tone mapping,
 * a touch of saturation and a soft vignette. MSAA on high, FXAA on medium.
 */
export function PostProcessing({ multisampling, fxaa }: { multisampling: number; fxaa: boolean }) {
  return (
    <EffectComposer multisampling={multisampling} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.75} luminanceThreshold={1.35} luminanceSmoothing={0.25} radius={0.7} resolutionScale={0.5} />
      <HueSaturation saturation={0.1} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.32} darkness={0.42} />
      {fxaa ? <FXAA /> : <></>}
    </EffectComposer>
  )
}
