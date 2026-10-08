import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { soundManager } from '@/core/sound/SoundManager'
import { GALLERY } from '@/data/portfolioContent'
import { asset } from '@/utils/basePath'

interface GalleryState {
  index: number | null
  open: (i?: number) => void
  close: () => void
  step: (d: number) => void
}

export const useGallery = create<GalleryState>((set, get) => ({
  index: null,
  open: (i = 0) => GALLERY.length && set({ index: Math.max(0, Math.min(GALLERY.length - 1, i)) }),
  close: () => set({ index: null }),
  step: (d) => {
    const i = get().index
    if (i === null) return
    set({ index: (i + d + GALLERY.length) % GALLERY.length })
  },
}))

/**
 * Gallery viewer: one large image at a time with its caption, a
 * counter, ← → to browse and Esc to close (captured so it only closes this).
 */
export function GalleryViewer() {
  const index = useGallery((s) => s.index)
  const close = useGallery((s) => s.close)
  const step = useGallery((s) => s.step)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (index === null) return
    closeRef.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else return
      e.preventDefault()
      e.stopPropagation()
      soundManager.play('click')
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [index === null])

  if (index === null || !GALLERY[index]) return null
  const photo = GALLERY[index]
  const n = (v: number) => String(v).padStart(2, '0')
  return (
    <div className="ui-gallery" role="dialog" aria-modal="true" aria-label="Gallery" onClick={(e) => e.target === e.currentTarget && close()}>
      <figure>
        <img key={photo.id} src={asset(photo.image)} alt={photo.caption} />
        <figcaption>
          <span><small className="ui-gallery__cat">{photo.category}</small> {photo.caption}</span>
          <span className="ui-gallery__count">{n(index + 1)} / {n(GALLERY.length)}</span>
        </figcaption>
      </figure>
      {GALLERY.length > 1 && (
        <>
          <button className="ui-gallery__nav is-prev" onClick={() => step(-1)} aria-label="Previous image">←</button>
          <button className="ui-gallery__nav is-next" onClick={() => step(1)} aria-label="Next image">→</button>
        </>
      )}
      <button ref={closeRef} className="ui-gallery__close" onClick={close} aria-label="Close gallery">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  )
}
