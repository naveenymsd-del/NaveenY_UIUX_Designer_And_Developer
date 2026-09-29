import { useGameStore } from '@/stores/gameStore'

/**
 * Client-side routes without page reloads: /street and /projects map to the
 * two experience modes. History navigation (back/forward) is honoured.
 */
export type RoutePath = '/street' | '/projects'

let pending: RoutePath | null = null

export function currentRoute(): RoutePath {
  return window.location.pathname.replace(/\/+$/, '').endsWith('/projects') ? '/projects' : '/street'
}

function apply(path: RoutePath) {
  const g = useGameStore.getState()
  if (g.phase !== 'playing') {
    pending = path
    return
  }
  g.setMode(path === '/projects' ? 'projects' : 'street')
}

export function navigate(path: RoutePath, replace = false) {
  const url = path + window.location.search
  if (window.location.pathname !== path) {
    if (replace) window.history.replaceState({ path }, '', url)
    else window.history.pushState({ path }, '', url)
  }
  apply(path)
}

/** Call once at startup: normalises '/', listens to history, applies deferred routes after the intro. */
export function initRouter() {
  const initial = currentRoute()
  if (window.location.pathname === '/' || window.location.pathname === '') window.history.replaceState({ path: initial }, '', initial + window.location.search)
  pending = initial
  const onPop = () => apply(currentRoute())
  window.addEventListener('popstate', onPop)
  const unsub = useGameStore.subscribe((s, prev) => {
    if (s.phase === 'playing' && prev.phase !== 'playing' && pending) {
      const p = pending
      pending = null
      apply(p)
    }
    // keep the URL in sync when mode changes from inside the app
    if (s.mode !== prev.mode) {
      const want: RoutePath = s.mode === 'projects' ? '/projects' : '/street'
      if (currentRoute() !== want) window.history.pushState({ path: want }, '', want + window.location.search)
    }
  })
  return () => {
    window.removeEventListener('popstate', onPop)
    unsub()
  }
}
