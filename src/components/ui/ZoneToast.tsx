import { useEffect } from 'react'
import { useGameStore } from '@/stores/gameStore'

/** Brief title card when entering a named area for the first time. */
export function ZoneToast() {
  const toast = useGameStore((s) => s.zoneToast)
  const clear = useGameStore((s) => s.clearZoneToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clear, 3800)
    return () => clearTimeout(t)
  }, [toast, clear])
  return (
    <div className={`ui-zone ${toast ? 'is-visible' : ''}`} aria-live="polite">
      {toast && (
        <div key={toast.at}>
          <p className="ui-zone__name">{toast.name}</p>
          <p className="ui-zone__sub">{toast.subtitle}</p>
        </div>
      )}
    </div>
  )
}
