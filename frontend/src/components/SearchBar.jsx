import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronDown, MapPin, Minus, Plus, Search, Users, X } from 'lucide-react'
import DateRangePicker from './DateRangePicker'
import { api } from '../lib/api'
import { fmtDate } from '../lib/format'
import { readFilters, writeFilters } from '../lib/query'

const NO_BOOKINGS = new Set() // the search calendar only blocks past days; per-listing availability is applied server-side
const MAX_GUESTS = 16
const range = (f) => (f.checkIn && f.checkOut ? `${fmtDate(f.checkIn, { day: 'numeric', month: 'short' })} – ${fmtDate(f.checkOut, { day: 'numeric', month: 'short' })}` : '')

// Module level on purpose: declaring this inside SearchBar would remount the inputs on every keystroke.
function Row({ id, section, onSelect, icon: Icon, label, value, children }) {
  return (
    <div className={`sp-row ${section === id ? "open" : ""}`}>
      <button type="button" className="sp-row-head" onClick={() => onSelect(id)} aria-expanded={section === id}>
        <Icon size={18} />
        <span className="sp-label">{label}</span>
        <span className="sp-value">{value}</span>
        <ChevronDown size={16} className="sp-chev" />
      </button>
      {section === id && <div className="sp-row-body">{children}</div>}
    </div>
  )
}

export default function SearchBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sp] = useSearchParams()
  const onHome = pathname === '/'
  const current = useMemo(() => (onHome ? readFilters(sp) : readFilters(new URLSearchParams())), [onHome, sp])

  const [open, setOpen] = useState(false)
  const [section, setSection] = useState('where')
  const [draft, setDraft] = useState({ q: '', checkIn: '', checkOut: '', guests: null })
  const [suggestions, setSuggestions] = useState([])
  const input = useRef(null)

  const show = () => {
    setDraft({ q: current.q, checkIn: current.checkIn, checkOut: current.checkOut, guests: current.guests })
    setSection('where')
    setOpen(true)
  }
  const close = () => setOpen(false)

  // Escape closes; lock page scroll behind the mobile sheet
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [open])

  useEffect(() => {
    if (open && section === 'where') input.current?.focus()
  }, [open, section])

  // destination suggestions, debounced
  useEffect(() => {
    if (!open || section !== 'where') return
    let live = true
    const t = setTimeout(() => {
      api
        .get(`/listings/places?q=${encodeURIComponent(draft.q.trim())}`)
        .then((r) => live && setSuggestions(r))
        .catch(() => live && setSuggestions([]))
    }, 180)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [open, section, draft.q])

  function submit(e) {
    e?.preventDefault()
    navigate(`/?${writeFilters({ ...current, q: draft.q.trim(), checkIn: draft.checkIn, checkOut: draft.checkOut, guests: draft.guests, page: 1 })}`)
    close()
  }

  const summary = {
    where: current.q || 'Anywhere',
    when: range(current) || 'Any week',
    who: current.guests ? `${current.guests} guest${current.guests > 1 ? 's' : ''}` : 'Add guests',
  }
  const hasDraft = draft.q || draft.checkIn || draft.guests

  return (
    <>
      <button className="pill" onClick={show} aria-haspopup="dialog" aria-label="Search stays">
        <span className="pill-seg strong">{summary.where}</span>
        <span className="pill-sep" />
        <span className="pill-seg">{summary.when}</span>
        <span className="pill-sep" />
        <span className="pill-seg muted">{summary.who}</span>
        <span className="pill-go">
          <Search size={15} strokeWidth={2.5} />
        </span>
      </button>

      {open && (
        <div className="sp-layer" role="dialog" aria-modal="true" aria-label="Search stays">
          <div className="sp-backdrop" onClick={close} />
          <form className="sp-panel" onSubmit={submit}>
            <div className="sp-top">
              <strong>Find your stay</strong>
              <button type="button" className="icon-btn" onClick={close} aria-label="Close search">
                <X size={20} />
              </button>
            </div>

            <Row id="where" section={section} onSelect={setSection} icon={MapPin} label="Where" value={draft.q || 'Anywhere'}>
              <input
                ref={input}
                className="sp-input"
                value={draft.q}
                onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                placeholder="Search destinations or vibes, e.g. “goa pool”"
                autoComplete="off"
              />
              <ul className="sp-suggest">
                {suggestions.map((s) => (
                  <li key={s.place}>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((d) => ({ ...d, q: s.place }))
                        setSection('when')
                      }}
                    >
                      <span className="sp-pin">
                        <MapPin size={16} />
                      </span>
                      <span>{s.place}</span>
                      <small className="muted">{s.count} stays</small>
                    </button>
                  </li>
                ))}
              </ul>
            </Row>

            <Row id="when" section={section} onSelect={setSection} icon={CalendarDays} label="When" value={range(draft) || 'Any week'}>
              <DateRangePicker
                booked={NO_BOOKINGS}
                start={draft.checkIn || null}
                end={draft.checkOut || null}
                layout="side"
                onChange={({ start, end }) => {
                  setDraft((d) => ({ ...d, checkIn: start || '', checkOut: end || '' }))
                  if (start && end) setSection('who')
                }}
              />
            </Row>

            <Row id="who" section={section} onSelect={setSection} icon={Users} label="Who" value={draft.guests ? `${draft.guests} guest${draft.guests > 1 ? 's' : ''}` : 'Add guests'}>
              <div className="stepper-row">
                <div>
                  <strong>Guests</strong>
                  <p className="muted">Show stays that sleep at least this many</p>
                </div>
                <div className="stepper">
                  <button type="button" className="icon-btn ring" disabled={!draft.guests} onClick={() => setDraft((d) => ({ ...d, guests: d.guests > 1 ? d.guests - 1 : null }))} aria-label="Fewer guests">
                    <Minus size={16} />
                  </button>
                  <output aria-live="polite">{draft.guests || 'Any'}</output>
                  <button type="button" className="icon-btn ring" disabled={draft.guests >= MAX_GUESTS} onClick={() => setDraft((d) => ({ ...d, guests: (d.guests || 0) + 1 }))} aria-label="More guests">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </Row>

            <div className="sp-foot">
              <button type="button" className="link-btn" onClick={() => setDraft({ q: '', checkIn: '', checkOut: '', guests: null })} disabled={!hasDraft}>
                Clear all
              </button>
              <button className="btn btn-primary">
                <Search size={16} /> Search
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
