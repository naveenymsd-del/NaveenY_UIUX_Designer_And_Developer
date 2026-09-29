import { isPlaceholder } from '@/data/projects'

/** Renders text, visually flagging [PLACEHOLDER] segments so they're easy to spot and replace. */
export function Rich({ text }: { text: string }) {
  if (!isPlaceholder(text)) return <>{text}</>
  const parts = text.split(/(\[[^\]]+\])/)
  return <>{parts.map((p, i) => (isPlaceholder(p) ? <mark key={i} className="ui-placeholder">{p}</mark> : <span key={i}>{p}</span>))}</>
}
