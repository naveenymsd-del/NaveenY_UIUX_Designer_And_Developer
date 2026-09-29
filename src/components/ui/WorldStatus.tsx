import { useEffect, useState } from 'react'
import { loadVisitorStats, SESSION_STATS, type VisitorStats } from '@/services/visitors'

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const fmtDate = (d: Date) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The visitor's local time (updates on the minute) and visitor information.
 * The visitor figure is real or clearly labelled: without a connected
 * analytics backend it reads "THIS SESSION · 01".
 */
export function WorldStatus() {
  const [now, setNow] = useState(() => new Date())
  const [stats, setStats] = useState<VisitorStats>(SESSION_STATS)

  useEffect(() => {
    let t = 0
    const tick = () => {
      const d = new Date()
      setNow(d)
      t = window.setTimeout(tick, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50)
    }
    tick()
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let alive = true
    loadVisitorStats().then((s) => alive && setStats(s))
    return () => {
      alive = false
    }
  }, [])

  const backend = stats.source === 'backend'
  const label = backend ? (stats.current !== undefined ? 'Exploring now' : stats.today !== undefined ? 'Visitors today' : 'Visitors') : 'This session'
  const value = backend ? (stats.current ?? stats.today ?? stats.total ?? 0) : 1
  return (
    <div className="ui-status">
      <time className="ui-status__time" dateTime={now.toISOString()} aria-label={`Local time ${fmtTime(now)}`}>
        <b>{fmtTime(now)}</b>
        <span>{fmtDate(now)}</span>
      </time>
      <span
        className="ui-status__visitors"
        title={backend ? undefined : 'Live visitor count is not connected yet — this shows your session only.'}
        aria-label={backend ? `${label}: ${value}` : 'This session: one visitor, you'}
      >
        <i aria-hidden="true" />
        {label} · {pad(value)}
      </span>
    </div>
  )
}
