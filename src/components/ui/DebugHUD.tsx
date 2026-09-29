import { useEffect, useState } from 'react'
import { debugStats } from '@/components/game/DebugProbe'
import { useUIStore } from '@/stores/uiStore'

/** ?debug overlay: fps, draw calls, triangles, memory and player state. */
export function DebugHUD() {
  const debug = useUIStore((s) => s.debug)
  const quality = useUIStore((s) => s.quality)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!debug) return
    const id = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [debug])
  if (!debug) return null
  const d = debugStats
  return (
    <pre className="ui-debug" aria-hidden="true">
      {`fps ${d.fps}  quality ${quality}
calls ${d.calls}  tris ${(d.triangles / 1000).toFixed(0)}k
geo ${d.geometries}  tex ${d.textures}
pos ${d.x} ${d.y} ${d.z}
state ${d.state} ${d.grounded ? 'grounded' : 'air'}`}
    </pre>
  )
}
