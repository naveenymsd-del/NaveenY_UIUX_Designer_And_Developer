import { LOCATIONS } from '@/data/locations'
import { PROJECTS } from '@/data/projects'

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Shown when WebGL is unavailable: the same content as plain, accessible HTML. */
export function WebGLFallback() {
  return (
    <main className="ui-fallback">
      <h1>Mindscape Avenue</h1>
      <p>This browser can’t display the 3D neighbourhood, but everything in it is right here.</p>
      <h2>Places</h2>
      <ul>
        {LOCATIONS.filter((l) => l.action === 'OPEN_LOCATION').map((l) => (
          <li key={l.id}><b>{l.name}</b> — {l.description}</li>
        ))}
      </ul>
      <h2>Projects</h2>
      <ul>
        {PROJECTS.map((p) => (
          <li key={p.id}>
            <b>{p.number} · {p.title}</b> ({p.category}) — {p.description}
            {" · "}<a href={p.prototypeUrl} target="_blank" rel="noopener noreferrer">Open prototype ↗</a>
          </li>
        ))}
      </ul>
    </main>
  )
}
