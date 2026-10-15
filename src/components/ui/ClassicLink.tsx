import { BASE } from '@/utils/basePath'

/**
 * "Explore the Classic Portfolio" — the way to /mindspace, the spatial
 * portfolio, from anywhere in the city (header, welcome screen, menu). A full
 * page load, so the city is never kept running behind it.
 */
export function ClassicLink({ variant = 'pill', tabIndex, hidden = false }: { variant?: 'pill' | 'card'; tabIndex?: number; hidden?: boolean }) {
  if (variant === 'card') {
    return (
      <a className="ui-classic-card" href={`${BASE}mindspace`} tabIndex={tabIndex}>
        <span className="ui-classic-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></svg>
        </span>
        <span className="ui-classic-card__text">
          <b>Explore the Classic Portfolio</b>
          <small>The same portfolio as a quick, app-style view — no 3D city to walk.</small>
        </span>
        <svg className="ui-classic-card__go" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
      </a>
    )
  }
  return (
    <a className="ui-classic-link" href={`${BASE}mindspace`} tabIndex={hidden ? -1 : tabIndex} aria-hidden={hidden || undefined} aria-label="Explore the Classic Portfolio">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></svg>
      {/* wide screens: the full wording; narrower: "Classic Portfolio"; phones: the icon alone */}
      <span className="ui-classic-link__label"><span className="ui-classic-link__pre">Explore the </span>Classic Portfolio</span>
    </a>
  )
}
