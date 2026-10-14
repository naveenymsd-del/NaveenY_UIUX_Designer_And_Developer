import type { Album } from './library'

/** original cover art for each album, drawn in SVG (no image files, nothing copied) */
export function Artwork({ album, className = '', mono = false }: { album: Album; className?: string; mono?: boolean }) {
  const [a, b, c, d] = album.palette
  const id = `art-${album.id}`
  return (
    <svg viewBox="0 0 100 100" className={`mu-art ${mono ? 'is-mono' : ''} ${className}`} role="img" aria-label={`${album.title} cover`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c} />
          <stop offset="1" stopColor={a} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={c} stopOpacity="0.9" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-bg)`} />
      {album.motif === 'sun' && (
        <>
          <circle cx="50" cy="56" r="26" fill={b} />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="0" y={62 + i * 8} width="100" height={4 - i * 0.5} fill={c} opacity={0.85} />)}
          <rect x="0" y="86" width="100" height="14" fill={d} opacity="0.85" />
          <text x="8" y="16" fontSize="7" fontWeight="700" fill={d} letterSpacing="1">SUNDAY</text>
        </>
      )}
      {album.motif === 'confetti' && (
        <>
          <rect width="100" height="100" fill={d} />
          {Array.from({ length: 26 }, (_, i) => {
            const x = (i * 37) % 96, y = (i * 53) % 92, col = [a, b, c][i % 3]
            return i % 3 === 0 ? <circle key={i} cx={x + 3} cy={y + 4} r={3 + (i % 4)} fill={col} /> : <rect key={i} x={x} y={y} width={6 + (i % 5)} height="4" rx="2" fill={col} transform={`rotate(${(i * 47) % 180} ${x + 3} ${y + 2})`} />
          })}
          <circle cx="50" cy="50" r="17" fill={a} />
          <path d="M42 47a2 2 0 1 0 0 .1M58 47a2 2 0 1 0 0 .1" stroke={d} strokeWidth="4" strokeLinecap="round" />
          <path d="M41 54q9 9 18 0" stroke={d} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      {album.motif === 'waves' && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M0 ${30 + i * 13} q12.5 -8 25 0 t25 0 t25 0 t25 0 V100 H0z`} fill={[c, a, b, a, b, d][i]} opacity={0.75 + i * 0.04} />
          ))}
          <circle cx="74" cy="20" r="8" fill={c} />
        </>
      )}
      {album.motif === 'grid' && (
        <>
          <rect width="100" height="100" fill={c} />
          {Array.from({ length: 36 }, (_, i) => {
            const x = (i % 6) * 15 + 6, y = Math.floor(i / 6) * 15 + 6
            const on = [3, 8, 9, 14, 15, 16, 21, 22, 27, 33].includes(i)
            return <rect key={i} x={x} y={y} width="11" height="11" rx={on ? 5.5 : 2} fill={on ? d : a} opacity={on ? 1 : 0.55} />
          })}
        </>
      )}
      {album.motif === 'moon' && (
        <>
          <rect width="100" height="100" fill={d} />
          <circle cx="50" cy="44" r="30" fill={`url(#${id}-glow)`} />
          <circle cx="50" cy="44" r="16" fill={c} />
          <circle cx="57" cy="39" r="14" fill={d} />
          {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={(i * 41) % 100} cy={70 + ((i * 17) % 26)} r={0.8 + (i % 3) * 0.5} fill={a} opacity={0.5 + (i % 3) * 0.2} />)}
          <path d="M0 84q25-10 50 0t50 0V100H0z" fill={b} opacity="0.8" />
        </>
      )}
    </svg>
  )
}
