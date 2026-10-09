import { useGallery } from '@/components/ui/GalleryViewer'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * The phone's back button (and the browser's) closes whatever panel is open —
 * a project, a place, the gallery, the menu — instead of leaving the site.
 * Opening a panel adds one history entry; closing it in the UI removes it.
 */
const anyOpen = () => {
  const g = useGameStore.getState()
  const ui = useUIStore.getState()
  return !!(g.activeProjectId || g.activeLocationId || ui.menuOpen || ui.guideOpen || useGallery.getState().index !== null)
}

/** close the top-most panel */
function closeTop() {
  const gallery = useGallery.getState()
  const ui = useUIStore.getState()
  const g = useGameStore.getState()
  if (gallery.index !== null) gallery.close()
  else if (ui.menuOpen) ui.setMenuOpen(false)
  else if (ui.guideOpen) ui.setGuideOpen(false)
  else if (g.activeProjectId || g.activeLocationId) g.closePanels()
}

export function initModalHistory() {
  let pushed = false
  /** our own history.back() is on its way (it lands asynchronously) */
  let ownBack = false
  const sync = () => {
    if (ownBack) return
    const open = anyOpen()
    if (open && !pushed) {
      window.history.pushState({ ...(window.history.state ?? {}), modal: true }, '', window.location.href)
      pushed = true
    } else if (!open && pushed) {
      // closed in the UI: drop our entry, so "back" leaves the page only when nothing is open
      pushed = false
      ownBack = true
      window.history.back()
    }
  }
  const onPop = () => {
    // the back we triggered ourselves: nothing to close — but a panel opened meanwhile gets its entry now
    if (ownBack) {
      ownBack = false
      setTimeout(sync, 0)
      return
    }
    if (!pushed) return
    pushed = false
    if (anyOpen()) closeTop()
    // another panel underneath is still open: it gets an entry of its own
    setTimeout(sync, 0)
  }
  window.addEventListener('popstate', onPop)
  const subs = [useGameStore.subscribe(sync), useUIStore.subscribe(sync), useGallery.subscribe(sync)]
  return () => {
    window.removeEventListener('popstate', onPop)
    subs.forEach((u) => u())
  }
}
