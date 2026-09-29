import { useEffect, useState } from 'react'
import { GameCanvas } from '@/components/game/GameCanvas'
import { A11yLayer } from '@/components/ui/A11yLayer'
import { ControlsHint } from '@/components/ui/ControlsHint'
import { DebugHUD } from '@/components/ui/DebugHUD'
import { InteractionPrompt } from '@/components/ui/InteractionPrompt'
import { IntroOverlay } from '@/components/ui/IntroOverlay'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { LocationPanel } from '@/components/ui/LocationPanel'
import { MenuOverlay } from '@/components/ui/MenuOverlay'
import { Minimap } from '@/components/ui/Minimap'
import { MobileControls } from '@/components/ui/MobileJoystick'
import { ProjectPanel } from '@/components/ui/ProjectPanel'
import { ProjectRail } from '@/components/ui/ProjectRail'
import { TipsOverlay } from '@/components/ui/TipsOverlay'
import { TopNavigation } from '@/components/ui/TopNavigation'
import { WebGLFallback, hasWebGL } from '@/components/ui/WebGLFallback'
import { ZoneToast } from '@/components/ui/ZoneToast'
import { FadeOverlay } from '@/components/ui/FadeOverlay'
import { CompanionBubble } from '@/components/ui/CompanionBubble'
import { FinalPanel } from '@/components/ui/FinalPanel'
import { NameTag } from '@/components/ui/NameTag'
import { initJourney } from '@/core/journey'
import { useDayNight } from '@/core/dayNight'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { useResponsive } from '@/hooks/useResponsive'
import { useSoundBridge } from '@/hooks/useSoundBridge'
import { useAssetStore } from '@/stores/assetStore'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { initRouter } from './routes'

/** Two layers: the WebGL world, and the HTML/CSS interface above it. */
export function App() {
  const [webgl] = useState(hasWebGL)
  const phase = useGameStore((s) => s.phase)
  const isTouch = useUIStore((s) => s.isTouch)
  const night = useDayNight((s) => s.night)
  const vp = useResponsive()
  useKeyboardControls()
  useSoundBridge()

  useEffect(() => initRouter(), [])
  useEffect(() => initJourney(), [])

  useEffect(() => {
    const setLoading = useGameStore.getState().setLoading
    const fonts = Promise.all([
      document.fonts.load('640 48px "Bricolage Grotesque Variable"', 'NAVEEN'),
      document.fonts.load('800 48px "Bricolage Grotesque Variable"', 'NFC SOLUTIONS'),
      document.fonts.load('500 24px "Instrument Sans Variable"'),
    ])
      .then(() => document.fonts.ready)
      .catch(() => undefined)
    Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(() => setLoading({ fontsReady: true }))
    useAssetStore
      .getState()
      .probeModels()
      .finally(() => setLoading({ assetsProbed: true }))
  }, [])

  if (!webgl) return <WebGLFallback />
  return (
    <div className={`app phase-${phase} ${isTouch ? 'is-touch' : 'is-desktop'} ${vp.portrait ? 'is-portrait' : 'is-landscape'} ${vp.compact ? 'is-compact' : ''} ${night ? 'is-night' : ''}`}>
      <GameCanvas />
      <div className="ui-layer">
        <TopNavigation />
        <ZoneToast />
        <InteractionPrompt />
        <ControlsHint />
        <Minimap />
        <MobileControls />
        <TipsOverlay />
        <LocationPanel />
        <ProjectPanel />
        <FinalPanel />
        <NameTag />
        <ProjectRail />
        <CompanionBubble />
        <FadeOverlay />
        <IntroOverlay />
        <MenuOverlay />
        <LoadingScreen />
        <A11yLayer />
        <DebugHUD />
      </div>
    </div>
  )
}
