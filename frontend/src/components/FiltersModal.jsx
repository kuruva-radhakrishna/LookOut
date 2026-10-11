import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../lib/api'
import { inr } from '../lib/format'
import { SORTS, toApiQuery } from '../lib/query'

const RATINGS = [
  { v: null, label: 'Any' },
  { v: 3, label: '3+' },
  { v: 3.5, label: '3.5+' },
  { v: 4, label: '4+' },
  { v: 4.5, label: '4.5+' },
]
const STEP = 100

export default function FiltersModal({ open, filters, bounds, withTax, onTax, onApply, onClose }) {
  const ref = useRef(null)
  const lo = Math.floor((bounds?.min ?? 0) / STEP) * STEP
  const hi = Math.ceil((bounds?.max ?? 50000) / STEP) * STEP
  const [draft, setDraft] = useState({ minPrice: null, maxPrice: null, minRating: null, sort: 'recommended' })
  const [count, setCount] = useState(null)

  // open/close the native dialog, and start each opening from the applied filters
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) {
      setDraft({ minPrice: filters.minPrice, maxPrice: filters.maxPrice, minRating: filters.minRating, sort: filters.sort })
      dlg.showModal()
    }
    if (!open && dlg.open) dlg.close()
  }, [open, filters])

  // live result count for the primary button, debounced
  useEffect(() => {
    if (!open) return
    let live = true
    setCount(null)
    const t = setTimeout(() => {
      api
        .get(`/listings?${toApiQuery({ ...filters, ...draft, page: 1 }, { limit: 3, page: 1 })}`)
        .then((r) => live && setCount(r.total))
        .catch(() => live && setCount(null))
    }, 250)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [open, draft, filters])

  const minV = draft.minPrice ?? lo
  const maxV = draft.maxPrice ?? hi
  const setMin = (v) => setDraft((d) => ({ ...d, minPrice: v <= lo ? null : Math.min(v, maxV - STEP) }))
  const setMax = (v) => setDraft((d) => ({ ...d, maxPrice: v >= hi ? null : Math.max(v, minV + STEP) }))
  const pct = (v) => ((v - lo) / (hi - lo || 1)) * 100
  const dirty = draft.minPrice || draft.maxPrice || draft.minRating || draft.sort !== 'recommended'

  return (
    <dialog ref={ref} className="sheet" onCancel={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <header className="sheet-head">
        <button className="icon-btn" onClick={onClose} aria-label="Close filters">
          <X size={18} />
        </button>
        <strong>Filters</strong>
        <span />
      </header>

      <div className="sheet-body">
        <section>
          <h3>Sort by</h3>
          <div className="chips">
            {SORTS.map((s) => (
              <button key={s.id} className={`chip-btn ${draft.sort === s.id ? 'on' : ''}`} onClick={() => setDraft((d) => ({ ...d, sort: s.id }))} aria-pressed={draft.sort === s.id}>
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Price per night</h3>
          <p className="muted">Before GST</p>
          <div className="range">
            <div className="range-track">
              <div className="range-fill" style={{ left: `${pct(minV)}%`, right: `${100 - pct(maxV)}%` }} />
            </div>
            <input type="range" min={lo} max={hi} step={STEP} value={minV} onChange={(e) => setMin(Number(e.target.value))} aria-label="Minimum price" />
            <input type="range" min={lo} max={hi} step={STEP} value={maxV} onChange={(e) => setMax(Number(e.target.value))} aria-label="Maximum price" />
          </div>
          <div className="price-inputs">
            <label>
              Minimum
              <span className="money">
                ₹
                <input type="number" min={lo} max={maxV} step={STEP} value={minV} onChange={(e) => setMin(Number(e.target.value) || lo)} />
              </span>
            </label>
            <span className="muted">to</span>
            <label>
              Maximum
              <span className="money">
                ₹
                <input type="number" min={minV} max={hi} step={STEP} value={maxV} onChange={(e) => setMax(Number(e.target.value) || hi)} />
              </span>
            </label>
          </div>
          <p className="muted small">
            Stays here range from {inr(lo)} to {inr(hi)}
          </p>
        </section>

        <section>
          <h3>Guest rating</h3>
          <div className="chips">
            {RATINGS.map((r) => (
              <button key={r.label} className={`chip-btn ${draft.minRating === r.v ? 'on' : ''}`} onClick={() => setDraft((d) => ({ ...d, minRating: r.v }))} aria-pressed={draft.minRating === r.v}>
                {r.v ? <>★ {r.label}</> : r.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Display</h3>
          <label className="switch spaced">
            <input type="checkbox" checked={withTax} onChange={(e) => onTax(e.target.checked)} />
            <span className="track" />
            <span>Show prices including 18% GST</span>
          </label>
        </section>
      </div>

      <footer className="sheet-foot">
        <button className="link-btn dark" onClick={() => setDraft({ minPrice: null, maxPrice: null, minRating: null, sort: 'recommended' })} disabled={!dirty}>
          Clear all
        </button>
        <button className="btn btn-dark" onClick={() => onApply(draft)} disabled={count === 0}>
          {count === null ? 'Show stays' : count === 0 ? 'No stays match' : `Show ${count.toLocaleString('en-IN')} stay${count === 1 ? '' : 's'}`}
        </button>
      </footer>
    </dialog>
  )
}
