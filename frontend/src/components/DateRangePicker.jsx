import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, fromISO, toISO, todayISO } from '../lib/format'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1))
  const lead = (first.getUTCDay() + 6) % 7 // Monday first
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => toISO(new Date(Date.UTC(year, month, i + 1))))]
}

/**
 * Two-month range calendar. `booked` is a Set of nights ("YYYY-MM-DD") that are taken.
 * A night is the date you sleep; check-out is the morning after your last night, so a booked date
 * can still be chosen as check-out, but never as check-in, and a stay may not span a booked night.
 */
export default function DateRangePicker({ booked, start, end, onChange, layout = 'stack' }) {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => {
    const d = fromISO(start || today)
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
  })
  const [hover, setHover] = useState(null)

  const months = [0, 1].map((offset) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m + offset, 1))
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
  })

  // The furthest check-out reachable from `start` (first booked night after it).
  const limit = useMemo(() => {
    if (!start || end) return null
    for (let d = start, i = 0; i < 31; d = addDays(d, 1), i++) if (booked.has(d)) return d
    return addDays(start, 31)
  }, [start, end, booked])

  const canStart = (d) => d >= today && !booked.has(d)
  const canEnd = (d) => start && !end && d > start && d <= limit && d <= addDays(start, 30)

  function pick(d) {
    if (!start || end) return canStart(d) && onChange({ start: d, end: null })
    if (canEnd(d)) return onChange({ start, end: d })
    if (canStart(d)) onChange({ start: d, end: null }) // clicked something unreachable: restart from here
  }

  const inRange = (d) => {
    if (start && end) return d > start && d < end
    if (start && hover && canEnd(hover)) return d > start && d < hover
    return false
  }

  const step = (n) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m + n, 1))
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() })
  }
  const atMin = cursor.y === fromISO(today).getUTCFullYear() && cursor.m === fromISO(today).getUTCMonth()

  return (
    <div className="cal" onMouseLeave={() => setHover(null)}>
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => step(-1)} disabled={atMin} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className={`cal-months ${layout}`}>
        {months.map(({ y, m }) => (
          <div className="cal-month" key={`${y}-${m}`}>
            <div className="cal-title">
              {new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </div>
            <div className="cal-grid">
              {WEEKDAYS.map((w) => (
                <span key={w} className="cal-dow">
                  {w}
                </span>
              ))}
              {monthCells(y, m).map((d, i) => {
                if (!d) return <span key={`b${i}`} />
                const selecting = start && !end
                const disabled = selecting ? !(canEnd(d) || canStart(d)) : !canStart(d)
                const cls = [
                  'cal-day',
                  d === start && 'is-start',
                  d === end && 'is-end',
                  inRange(d) && 'in-range',
                  booked.has(d) && 'is-booked',
                  d === today && 'is-today',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    type="button"
                    key={d}
                    className={cls}
                    disabled={disabled}
                    onClick={() => pick(d)}
                    onMouseEnter={() => setHover(d)}
                    aria-label={`${d}${booked.has(d) ? ' (unavailable)' : ''}`}
                    aria-pressed={d === start || d === end}
                  >
                    {Number(d.slice(8))}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="cal-foot">
        <span className="legend">
          <i className="dot dot-booked" /> Unavailable
        </span>
        {(start || end) && (
          <button type="button" className="link-btn" onClick={() => onChange({ start: null, end: null })}>
            Clear dates
          </button>
        )}
      </div>
    </div>
  )
}
