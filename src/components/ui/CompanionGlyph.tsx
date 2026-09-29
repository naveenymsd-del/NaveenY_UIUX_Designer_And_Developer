/**
 * 2D version of the AI companion (loading screen, menu, bubbles): a soft
 * orange pebble with a dark face visor, two expressive eyes and small
 * floating hands. Mirrors the 3D model in effects/AICompanion.
 */
export function CompanionGlyph({ awake = true, size = 64 }: { awake?: boolean; size?: number }) {
  return (
    <svg className={`ui-companion ${awake ? 'is-awake' : ''}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="cg-body" cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffb56e" />
          <stop offset="0.55" stopColor="#ec7a2c" />
          <stop offset="1" stopColor="#b9531a" />
        </radialGradient>
      </defs>
      <ellipse className="ui-companion__shadow" cx="32" cy="60" rx="11" ry="2.2" />
      <g className="ui-companion__float">
        <ellipse className="ui-companion__hand ui-companion__hand--l" cx="12.5" cy="37" rx="4" ry="5" fill="url(#cg-body)" />
        <ellipse className="ui-companion__hand ui-companion__hand--r" cx="51.5" cy="37" rx="4" ry="5" fill="url(#cg-body)" />
        <path d="M32 9c11 0 17.5 8.6 17.5 20.5S43.6 52 32 52 14.5 41.4 14.5 29.5 21 9 32 9Z" fill="url(#cg-body)" />
        <rect x="20" y="21" width="24" height="15" rx="7.5" fill="#1d1712" />
        <g className="ui-companion__eyes">
          <rect x="25" y="25.5" width="4.4" height="6" rx="2.2" />
          <rect x="34.6" y="25.5" width="4.4" height="6" rx="2.2" />
        </g>
        <circle cx="32" cy="12.5" r="1.6" className="ui-companion__spark" />
      </g>
    </svg>
  )
}
