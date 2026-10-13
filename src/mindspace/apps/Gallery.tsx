import { useEffect, useMemo, useRef, useState } from 'react'
import { GALLERY } from '@/data/portfolioContent'
import { PROJECTS } from '@/data/projects'
import { asset } from '@/utils/basePath'

/**
 * Gallery: the real UI screens exported from the case studies (the same
 * images the projects use). Filter by project; open any image full size.
 */
export function Gallery() {
  const [filter, setFilter] = useState<string>('all')
  const [open, setOpen] = useState<number | null>(null)
  const items = useMemo(() => GALLERY.filter((g) => filter === 'all' || g.project === filter), [filter])
  const filters = useMemo(() => PROJECTS.filter((p) => GALLERY.some((g) => g.project === p.id)), [])
  const viewer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open === null) return
    viewer.current?.focus({ preventScroll: true })
  }, [open])
  const step = (d: number) => setOpen((i) => (i === null ? i : (i + d + items.length) % items.length))

  if (open !== null) {
    const g = items[open]
    return (
      <div
        className="ms-app ms-viewer"
        ref={viewer}
        tabIndex={-1}
        data-keys-own
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1)
          else if (e.key === 'ArrowLeft') step(-1)
          else if (e.key === 'Escape') { e.stopPropagation(); setOpen(null) }
        }}
      >
        <div className="ms-viewer__bar">
          <button className="ms-back-link" onClick={() => setOpen(null)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg> Gallery
          </button>
          <span className="ms-muted">{open + 1} / {items.length}</span>
        </div>
        <figure className="ms-viewer__fig" key={g.id}>
          <img src={asset(g.image)} alt={g.caption} />
          <figcaption>{g.caption}</figcaption>
        </figure>
        <div className="ms-viewer__nav">
          <button className="ms-round-btn" onClick={() => step(-1)} aria-label="Previous image">‹</button>
          <button className="ms-round-btn" onClick={() => step(1)} aria-label="Next image">›</button>
        </div>
      </div>
    )
  }
  return (
    <div className="ms-app">
      <div className="ms-filters" role="group" aria-label="Filter by project">
        <button className={filter === 'all' ? 'is-on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
        {filters.map((p) => (
          <button key={p.id} className={filter === p.id ? 'is-on' : ''} aria-pressed={filter === p.id} onClick={() => setFilter(p.id)}>{p.title}</button>
        ))}
      </div>
      <ul className="ms-gallery">
        {items.map((g, i) => (
          <li key={g.id}>
            <button onClick={() => setOpen(i)} aria-label={`Open: ${g.caption}`}>
              <img src={asset(g.image)} alt="" loading="lazy" />
              <span>{g.caption}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="ms-muted ms-small">UI screens from Naveen’s case studies. Sketches and photography will appear here once real files are added.</p>
    </div>
  )
}
