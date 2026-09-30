import { soundManager } from '@/core/sound/SoundManager'
import { CONTACT } from '@/data/portfolioContent'
import { isPlaceholder } from '@/data/projects'

/**
 * Contact actions from CONTACT (portfolioContent). A link that is still a
 * placeholder renders as a disabled "coming soon" chip showing what to add —
 * never a broken or invented link.
 */
export function ContactLinks({ tabbable = true, compact = false }: { tabbable?: boolean; compact?: boolean }) {
  const items = [
    { key: 'phone', label: 'Call me', value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, '')}` },
    { key: 'email', label: 'Email me', value: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { key: 'linkedin', label: 'View LinkedIn', value: CONTACT.linkedin, href: CONTACT.linkedin },
    { key: 'resume', label: 'View resume', value: CONTACT.resume, href: CONTACT.resume },
  ]
  return (
    <div className={`ui-contact ${compact ? 'is-compact' : ''}`}>
      {items.map((it, i) =>
        isPlaceholder(it.value) ? (
          <span key={it.key} className="ui-contact__todo" title={`Add this link in src/data/portfolioContent.ts (CONTACT.${it.key})`}>
            <b>{it.label}</b>
            <mark className="ui-placeholder">{it.value}</mark>
          </span>
        ) : (
          <a
            key={it.key}
            className={`ui-btn ${i === 0 ? 'ui-btn--primary' : 'ui-btn--glass'}`}
            href={it.href}
            target={it.key === 'email' ? undefined : '_blank'}
            rel="noreferrer"
            tabIndex={tabbable ? 0 : -1}
            onClick={() => soundManager.play('click')}
          >
            {it.label}
          </a>
        ),
      )}
    </div>
  )
}
