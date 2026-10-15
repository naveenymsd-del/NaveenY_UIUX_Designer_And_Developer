import { useId } from 'react'
import type { Expression } from '@/ai/expression'

/**
 * The AI companion in the interface (launcher, panel header, phone orb, hero,
 * welcome screen): the same robot as the 3D character in the city — a glossy
 * pearl-white head with ice-blue ear pods and antennae, a black glass face and
 * two cyan eyes. Its face follows `expr` (see ai/expression.ts); the eye
 * shapes, mouth, listening ring, thinking dots and sparkles are styled in
 * styles/companion.css. Vector, so the UI never needs a second WebGL canvas.
 */
export function CompanionGlyph({ awake = true, size = 64, expr = 'idle' }: { awake?: boolean; size?: number; expr?: Expression }) {
  const id = useId().replace(/:/g, '')
  const shell = `rb-shell-${id}`
  const blue = `rb-blue-${id}`
  const face = `rb-face-${id}`
  const glow = `rb-glow-${id}`
  return (
    <svg className={`ui-companion ui-robot ${awake ? 'is-awake' : ''}`} data-expr={expr} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={shell} cx="0.36" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f2f4fb" />
          <stop offset="1" stopColor="#c9cfe3" />
        </radialGradient>
        <linearGradient id={blue} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcd6ff" />
          <stop offset="0.55" stopColor="#7fb0ff" />
          <stop offset="1" stopColor="#3478ff" />
        </linearGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262b3a" />
          <stop offset="1" stopColor="#0b0d14" />
        </linearGradient>
        <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* listening: a soft cyan ring around the head */}
      <circle className="ui-robot__ring" cx="32" cy="29" r="29" />
      <g className="ui-robot__float">
        <g className="ui-robot__head">
          {/* antennae and ear pods (ice blue) */}
          <path className="ui-robot__antenna ui-robot__antenna--l" d="M16.5 15.5c-3.2-3.6-4-8.4-2.4-10.6 1.8.2 4.6 4.2 6.3 8.4z" fill={`url(#${blue})`} />
          <path className="ui-robot__antenna ui-robot__antenna--r" d="M47.5 15.5c3.2-3.6 4-8.4 2.4-10.6-1.8.2-4.6 4.2-6.3 8.4z" fill={`url(#${blue})`} />
          <ellipse cx="8.6" cy="29" rx="4.6" ry="6.4" fill={`url(#${blue})`} />
          <ellipse cx="55.4" cy="29" rx="4.6" ry="6.4" fill={`url(#${blue})`} />
          {/* pearl head */}
          <rect x="9.5" y="11.5" width="45" height="35" rx="15" fill={`url(#${shell})`} />
          <path d="M16 16.5c4-3 10-3.6 16-3.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.9" />
          {/* black glass face */}
          <rect x="15" y="18" width="34" height="23" rx="9.5" fill={`url(#${face})`} />
          <path className="ui-robot__brackets" d="M18.5 22v-1.6h1.6M45.5 22v-1.6h-1.6M18.5 37v1.6h1.6M45.5 37v1.6h-1.6" stroke="#71f0ff" strokeWidth="0.9" fill="none" strokeLinecap="round" />
          <g className="ui-robot__eyes" filter={`url(#${glow})`}>
            <ellipse className="ui-robot__eye ui-robot__eye--l" cx="26" cy="29.5" rx="3.9" ry="4.8" />
            <ellipse className="ui-robot__eye ui-robot__eye--r" cx="38" cy="29.5" rx="3.9" ry="4.8" />
            {/* happy: the eyes curve into smiles */}
            <path className="ui-robot__smile" d="M22.4 31c1.6-3.4 5.6-3.4 7.2 0M34.4 31c1.6-3.4 5.6-3.4 7.2 0" />
          </g>
          <rect className="ui-robot__mouth" x="29" y="35.6" width="6" height="1.7" rx="0.85" />
        </g>
        {/* compact body: pearl with a blue collar and a cyan chest light */}
        <path d="M21 50.5c0-3.4 4.9-5.5 11-5.5s11 2.1 11 5.5c0 5.4-4.4 9.5-11 9.5s-11-4.1-11-9.5z" fill={`url(#${shell})`} />
        <path d="M21.6 48.6c1.8-2.3 5.7-3.6 10.4-3.6s8.6 1.3 10.4 3.6c-2.2 1.6-5.9 2.6-10.4 2.6s-8.2-1-10.4-2.6z" fill={`url(#${blue})`} />
        <circle className="ui-robot__core" cx="32" cy="53.5" r="2.1" />
      </g>
      {/* thinking: three dots; success: sparkles */}
      <g className="ui-robot__dots"><circle cx="50" cy="8" r="1.6" /><circle cx="55" cy="8" r="1.6" /><circle cx="60" cy="8" r="1.6" /></g>
      <g className="ui-robot__sparks"><path d="M6 10l1 2.6 2.6 1-2.6 1L6 17l-1-2.4-2.6-1 2.6-1z" /><path d="M58 40l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></g>
    </svg>
  )
}
