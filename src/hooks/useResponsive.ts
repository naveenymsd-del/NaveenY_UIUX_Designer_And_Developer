import { useEffect, useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { isTouchDevice } from '@/utils/performance'

export interface Viewport {
  width: number
  height: number
  portrait: boolean
  compact: boolean
}

function read(): Viewport {
  const width = window.innerWidth
  const height = window.innerHeight
  return { width, height, portrait: height > width, compact: width < 720 }
}

/** Tracks viewport size / orientation and re-detects touch capability on change. */
export function useResponsive(): Viewport {
  const [vp, setVp] = useState(read)
  const setIsTouch = useUIStore((s) => s.setIsTouch)
  useEffect(() => {
    const on = () => {
      setVp(read())
      setIsTouch(isTouchDevice())
    }
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setIsTouch(true)
    }
    window.addEventListener('pointerdown', onPointer, { passive: true })
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [setIsTouch])
  return vp
}
