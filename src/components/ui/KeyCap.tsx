export function KeyCap({ k, wide = false, accent = false }: { k: string; wide?: boolean; accent?: boolean }) {
  return <kbd className={`ui-key ${wide ? 'ui-key--wide' : ''} ${accent ? 'ui-key--accent' : ''}`}>{k}</kbd>
}
