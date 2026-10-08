import { navigate } from '@/app/routes'
import { activateLocation } from '@/components/interactions/InteractionManager'
import { LOCATIONS, getLocation } from '@/data/locations'
import { PROJECTS } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'
import { PROFILE } from '@/data/portfolioContent'

/**
 * Accessible fallback for everything that lives only in WebGL: a skip-link
 * style overview (visible on keyboard focus) listing every place and project,
 * plus a live region announcing what is nearby.
 */
export function A11yLayer() {
  const nearby = useGameStore((s) => s.nearbyId)
  const phase = useGameStore((s) => s.phase)
  const openLocation = useGameStore((s) => s.openLocation)
  const openProject = useGameStore((s) => s.openProject)
  const loc = getLocation(nearby)
  const ready = phase === 'playing'
  return (
    <>
      <nav className="sr-only sr-only-focusable ui-a11y" aria-label="Places and projects (accessible overview)">
        <h2>Mindscape Avenue — overview</h2>
        <p>The interactive portfolio of {PROFILE.fullName}, {PROFILE.role}. Every place and story can also be opened directly:</p>
        <ul>
          {LOCATIONS.filter((l) => l.marker || l.type === 'story').map((l) => (
            <li key={l.id}>
              <button disabled={!ready} onClick={() => { navigate('/street'); if (l.action === 'OPEN_LOCATION') openLocation(l.id); else activateLocation(l) }}>{l.name} — {l.kicker}</button>
            </li>
          ))}
          {PROJECTS.map((p) => (
            <li key={p.id}>
              <button disabled={!ready} onClick={() => openProject(p.id)}>Project {p.number}: {p.title} ({p.category})</button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sr-only" aria-live="polite">{loc ? `${loc.name} nearby. ${loc.label}.` : ''}</div>
    </>
  )
}
