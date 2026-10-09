import { soundManager } from '@/core/sound/SoundManager'
import { CONTACT } from '@/data/portfolioContent'
import { asset } from '@/utils/basePath'

/** the résumé PDF, wherever the site is hosted (e.g. under /repo-name/ on GitHub Pages) */
export const resumeUrl = () => (CONTACT.resume ? asset(CONTACT.resume) : '')
/** the name the downloaded file gets */
export const RESUME_FILE = 'Naveen_Yarramallugalla_UIUX_Designer_Resume.pdf'

/**
 * Contact actions from CONTACT (portfolioContent). Only links with a real
 * value are shown — an empty value hides the link, so nothing is ever a
 * placeholder or a broken URL.
 */
export function ContactLinks({ tabbable = true, compact = false }: { tabbable?: boolean; compact?: boolean }) {
  const items = [
    { key: 'email', label: 'Email Me', value: CONTACT.email, href: `mailto:${CONTACT.email}`, external: false, aria: `Email ${CONTACT.email}` },
    { key: 'phone', label: 'Call', value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, '')}`, external: false, aria: `Call ${CONTACT.phone}` },
    { key: 'linkedin', label: 'LinkedIn ↗', value: CONTACT.linkedin, href: CONTACT.linkedin, external: true, aria: 'LinkedIn profile (opens in a new tab)' },
    { key: 'resume', label: 'View Resume ↗', value: CONTACT.resume, href: resumeUrl(), external: true, aria: 'View Naveen’s résumé (PDF, opens in a new tab)' },
    { key: 'resume-download', label: 'Download Resume ↓', value: CONTACT.resume, href: resumeUrl(), external: false, download: RESUME_FILE, aria: 'Download Naveen’s résumé (PDF)' },
  ].filter((it) => it.value)
  return (
    <div className={`ui-contact ${compact ? 'is-compact' : ''}`}>
      {items.map((it, i) => (
        <a
          key={it.key}
          className={`ui-btn ${i === 0 ? 'ui-btn--primary' : 'ui-btn--glass'} ui-contact__link`}
          href={it.href}
          target={it.external ? '_blank' : undefined}
          rel={it.external ? 'noopener noreferrer' : undefined}
          download={'download' in it ? it.download : undefined}
          aria-label={it.aria}
          tabIndex={tabbable ? 0 : -1}
          onClick={() => soundManager.play('click')}
        >
          <span className="ui-contact__label">{it.label}</span>
          {!it.external && !('download' in it) && <span className="ui-contact__value">{it.value}</span>}
        </a>
      ))}
    </div>
  )
}
