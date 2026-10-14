import type { ReactNode } from 'react'
import type { AppId } from '../store'

/** every application on the launcher: label, a one-line purpose, its icon face */
export interface AppDef {
  id: AppId
  label: string
  title: string
  /** CSS background of the round icon */
  face: string
  glyph: ReactNode
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** an original multi-petal flower for Gallery (eight translucent petals) */
function Petals() {
  const cols = ['#f9b233', '#f37e45', '#e9466f', '#b459c7', '#5d72e8', '#33a6e8', '#38c98a', '#a6d64a']
  return (
    <svg viewBox="-50 -50 100 100" aria-hidden="true">
      {cols.map((c, i) => (
        <ellipse key={c} cx="0" cy="-19" rx="11" ry="20" fill={c} opacity="0.82" transform={`rotate(${i * 45})`} style={{ mixBlendMode: 'multiply' }} />
      ))}
    </svg>
  )
}

export const APPS: AppDef[] = [
  {
    id: 'about', label: 'About Me', title: 'About Me',
    face: 'radial-gradient(circle at 32% 26%, #ffd9b8, #f08a4b 55%, #c4552a)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8.5" r="3.6" /><path d="M5 19.5c1.3-3.4 4-5 7-5s5.7 1.6 7 5" /></svg>,
  },
  {
    id: 'education', label: 'Education', title: 'Education',
    face: 'radial-gradient(circle at 32% 26%, #c9d8ff, #5b7cf0 55%, #2f47b8)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><path d="M2.5 9.5 12 5l9.5 4.5L12 14z" /><path d="M6.5 11.5v4c1.5 1.6 3.4 2.4 5.5 2.4s4-.8 5.5-2.4v-4" /><path d="M21.5 9.5v5" /></svg>,
  },
  {
    id: 'experience', label: 'Experience', title: 'Experience',
    face: 'radial-gradient(circle at 32% 26%, #6e6a66, #2f2c2a 58%, #141312)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><rect x="3.5" y="7.5" width="17" height="12" rx="2.5" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" /></svg>,
  },
  {
    id: 'projects', label: 'Projects', title: 'Projects',
    face: 'radial-gradient(circle at 32% 26%, #fff1b8, #f6c12f 55%, #d38b0c)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="3.5" /></svg>,
  },
  { id: 'gallery', label: 'Gallery', title: 'Gallery', face: 'radial-gradient(circle at 32% 26%, #ffffff, #f4f2ee 60%, #dcd8d0)', glyph: <Petals /> },
  {
    id: 'process', label: 'Design Process', title: 'Design Process',
    face: 'radial-gradient(circle at 32% 26%, #c3f0e4, #3fbf9d 55%, #1e8467)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><path d="M12 3.5 20.5 8 12 12.5 3.5 8z" /><path d="m3.5 12 8.5 4.5 8.5-4.5" /><path d="m3.5 16 8.5 4.5 8.5-4.5" /></svg>,
  },
  {
    id: 'skills', label: 'Skills & Tools', title: 'Skills & Tools',
    face: 'radial-gradient(circle at 32% 26%, #e5d4ff, #9668e8 55%, #5b35b0)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><path d="M14.5 6.5a4 4 0 0 0-5.3 5.2L3.8 17.1a1.6 1.6 0 0 0 2.3 2.3l5.4-5.4a4 4 0 0 0 5.2-5.3l-2.4 2.4-2.1-.4-.4-2.1z" /></svg>,
  },
  {
    id: 'games', label: 'Joy Lab', title: 'Joy Lab',
    face: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%), conic-gradient(from 210deg, #ff5d8f, #ffb020, #ffd23f, #3bceac, #7b6cff, #ff5d8f)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><path d="M7.5 8h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.2a2 2 0 0 1-3.4.7L14.6 16H9.4l-1.8 1.7a2 2 0 0 1-3.4-.7l-1-3.2A4.5 4.5 0 0 1 7.5 8z" /><path d="M8 11v3M6.5 12.5h3" /><circle cx="15.5" cy="11.5" r=".6" fill="currentColor" /><circle cx="17" cy="13.3" r=".6" fill="currentColor" /></svg>,
  },
  {
    id: 'music', label: 'Music', title: 'Music Lounge',
    face: 'radial-gradient(circle at 32% 26%, #ffb3c1, #fa3c64 55%, #b8133d)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><path d="M9 18.5a2.5 2.5 0 1 1-2.5-2.5H9V5.5l10-2v12a2.5 2.5 0 1 1-2.5-2.5H19" /></svg>,
  },
  {
    id: 'contact', label: 'Contact', title: 'Contact',
    face: 'radial-gradient(circle at 32% 26%, #bfe6ff, #2c9bf0 55%, #126bc0)',
    glyph: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.8 7 8.2 6 8.2-6" /></svg>,
  },
]

export const appDef = (id: AppId) => APPS.find((a) => a.id === id)!
