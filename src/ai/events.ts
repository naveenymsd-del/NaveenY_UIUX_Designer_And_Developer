/**
 * Voice → UI events. The guide never reaches into React components; the few
 * components that react to it (the case-study panel) subscribe here.
 */
type Events = {
  showSection: 'overview' | 'challenges'
}

const listeners: { [K in keyof Events]?: Set<(v: Events[K]) => void> } = {}

export function onGuideEvent<K extends keyof Events>(name: K, fn: (v: Events[K]) => void) {
  const set = (listeners[name] ??= new Set()) as Set<(v: Events[K]) => void>
  set.add(fn)
  return () => { set.delete(fn) }
}

export function emitGuideEvent<K extends keyof Events>(name: K, value: Events[K]) {
  ;(listeners[name] as Set<(v: Events[K]) => void> | undefined)?.forEach((fn) => fn(value))
}

/** what the case-study panel is showing (written by ProjectPanel, read by the guide) */
export const caseView = { section: 'overview' as 'overview' | 'challenges' }
