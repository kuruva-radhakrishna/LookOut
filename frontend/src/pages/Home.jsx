import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX, SlidersHorizontal, X } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDate, inr } from '../lib/format'
import { panelFilterCount, readFilters, ROWS, SORTS, toApiQuery, writeFilters } from '../lib/query'
import ListingCard, { CardSkeleton } from '../components/ListingCard'
import CategoryBar from '../components/CategoryBar'
import FiltersModal from '../components/FiltersModal'
import Pagination from '../components/Pagination'
import { pageSize, useGridColumns } from '../lib/grid'

const readTaxPref = () => {
  try {
    return localStorage.getItem('lookout.withTax') === '1'
  } catch {
    return false
  }
}

export default function Home() {
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const f = useMemo(() => readFilters(new URLSearchParams(key)), [key])

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [slow, setSlow] = useState(false)
  const [withTax, setWithTax] = useState(readTaxPref)
  const [bounds, setBounds] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const reqId = useRef(0)
  const results = useRef(null)
  // A page is whole rows: limit = columns (measured from the real grid) x rows (3, 6 or 9 base rows, more on narrow screens).
  const columns = useGridColumns(results)
  const limit = columns ? pageSize(columns, f.rows) : null

  const go = (patch, { keepPage = false, replace = false } = {}) =>
    setParams(writeFilters({ ...f, ...patch, page: keepPage ? (patch.page ?? f.page) : 1 }), { replace })

  useEffect(() => {
    api.get('/listings/facets').then((r) => setBounds(r.price)).catch(() => {})
  }, [])

  // The window was resized (or rotated) so the grid has a different column count: keep the first visible stay on screen
  // by recomputing the page number for the new page size, instead of leaving the guest on an unrelated page.
  const lastLimit = useRef(null)
  useEffect(() => {
    if (!limit) return
    const prev = lastLimit.current
    lastLimit.current = limit
    if (prev && prev !== limit && f.page > 1) {
      const page = Math.floor(((f.page - 1) * prev) / limit) + 1
      setParams(writeFilters({ ...f, page }), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  useEffect(() => {
    if (!limit) return // not measured yet
    const id = ++reqId.current
    setData(null)
    setError('')
    // Free hosting sleeps when idle; explain a slow first load instead of showing nothing.
    const t = setTimeout(() => setSlow(true), 4000)
    api
      .get(`/listings?${toApiQuery({ ...f, limit })}`)
      .then((r) => {
        if (id !== reqId.current) return
        setData(r)
        // e.g. an old link to page 9 after the filters shrank the results: jump to the last real page
        if (r.pages > 0 && f.page > r.pages) setParams(writeFilters({ ...f, page: r.pages }), { replace: true })
      })
      .catch((e) => id === reqId.current && setError(e.message))
      .finally(() => {
        clearTimeout(t)
        if (id === reqId.current) setSlow(false)
      })
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit])

  const setTax = (on) => {
    setWithTax(on)
    try {
      localStorage.setItem("lookout.withTax", on ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  const toTop = () => {
    const top = results.current?.getBoundingClientRect().top + window.scrollY - 150
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  const chips = [
    f.q && { label: `“${f.q}”`, clear: { q: '' } },
    f.checkIn && f.checkOut && { label: `${fmtDate(f.checkIn, { day: 'numeric', month: 'short' })} – ${fmtDate(f.checkOut, { day: 'numeric', month: 'short' })}`, clear: { checkIn: '', checkOut: '' } },
    f.guests && { label: `${f.guests}+ guests`, clear: { guests: null } },
    (f.minPrice || f.maxPrice) && { label: `${f.minPrice ? inr(f.minPrice) : 'Any'} – ${f.maxPrice ? inr(f.maxPrice) : 'Any'}`, clear: { minPrice: null, maxPrice: null } },
    f.minRating && { label: `★ ${f.minRating}+`, clear: { minRating: null } },
    f.sort !== 'recommended' && { label: SORTS.find((s) => s.id === f.sort)?.label, clear: { sort: 'recommended' } },
  ].filter(Boolean)
  const filtered = chips.length > 0 || f.category
  const clearAll = () => setParams(writeFilters({ rows: f.rows }))
  const loading = !data && !error

  return (
    <>
      <div className="sticky-cats">
        <div className="page-wide cats-row">
          <CategoryBar value={f.category} onChange={(category) => go({ category })} />
          <button className="filter-btn" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={16} />
            Filters
            {panelFilterCount(f) > 0 && <span className="filter-count">{panelFilterCount(f)}</span>}
          </button>
          <label className="switch tax-switch">
            <input
              type="checkbox"
              checked={withTax}
              onChange={(e) => setTax(e.target.checked)}
            />
            <span className="track" />
            <span>Total with GST</span>
          </label>
        </div>
      </div>

      <div className="page-wide" ref={results}>
        <div className="results-head">
          <h1>{!filtered ? 'Stays across India' : data ? `${data.total.toLocaleString('en-IN')} stay${data.total === 1 ? '' : 's'}` : 'Searching…'}</h1>
          {chips.length > 0 && (
            <div className="active-chips">
              {chips.map((c) => (
                <button key={c.label} className="active-chip" onClick={() => go(c.clear)} aria-label={`Remove filter ${c.label}`}>
                  {c.label} <X size={14} />
                </button>
              ))}
              <button className="link-btn dark" onClick={clearAll}>
                Clear all
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="empty">
            <p>{error}</p>
            <button className="btn btn-dark" onClick={() => setParams(new URLSearchParams(key))}>
              Try again
            </button>
          </div>
        )}

        {loading && (
          <>
            {slow && <p className="notice">Waking up the server. The first load can take up to a minute on free hosting…</p>}
            <div className="grid">
              {Array.from({ length: limit || 0 }, (_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </>
        )}

        {data && data.items.length === 0 && (
          <div className="empty">
            <SearchX size={40} />
            <h2>No stays match</h2>
            <p className="muted">Try removing a filter or searching a different place or dates.</p>
            <button className="btn btn-dark" onClick={clearAll}>
              Clear all filters
            </button>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="grid">
              {data.items.map((l) => (
                <ListingCard key={l._id} listing={l} withTax={withTax} />
              ))}
            </div>
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              rows={f.rows}
              sizes={ROWS.map((r) => ({ rows: r, count: pageSize(columns, r) }))}
              offset={data.offset}
              itemCount={data.items.length}
              onPage={(page) => {
                go({ page }, { keepPage: true })
                toTop()
              }}
              onRows={(rows) => go({ rows })}
            />
          </>
        )}
      </div>

      <FiltersModal
        open={filtersOpen}
        filters={f}
        bounds={bounds}
        withTax={withTax}
        onTax={setTax}
        onClose={() => setFiltersOpen(false)}
        onApply={(d) => {
          go(d)
          setFiltersOpen(false)
        }}
      />
    </>
  )
}
