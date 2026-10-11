import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  Castle,
  Flame,
  Home as HomeIcon,
  Mountain,
  Search,
  SearchX,
  Umbrella,
  Waves,
  Wheat,
  LayoutGrid,
} from 'lucide-react'
import { api } from '../lib/api'
import ListingCard, { CardSkeleton } from '../components/ListingCard'

const CATEGORIES = [
  { id: '', label: 'All', icon: LayoutGrid },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'rooms', label: 'Rooms', icon: HomeIcon },
  { id: 'mansion', label: 'Mansions', icon: Building2 },
  { id: 'castles', label: 'Castles', icon: Castle },
  { id: 'pools', label: 'Pools', icon: Waves },
  { id: 'beaches', label: 'Beaches', icon: Umbrella },
  { id: 'mountains', label: 'Mountains', icon: Mountain },
  { id: 'farmhouses', label: 'Farmhouses', icon: Wheat },
]

const readTaxPref = () => {
  try {
    return localStorage.getItem('lookout.withTax') === '1'
  } catch {
    return false
  }
}

export default function Home() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const category = params.get('category') || ''
  const [draft, setDraft] = useState(q)
  const [data, setData] = useState({ items: [], page: 0, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [slow, setSlow] = useState(false)
  const [withTax, setWithTax] = useState(readTaxPref)
  const reqId = useRef(0)

  useEffect(() => {
    setDraft(q)
  }, [q])

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError('')
    // Free hosting sleeps when idle; tell the user why the first load is slow instead of showing nothing.
    const t = setTimeout(() => setSlow(true), 4000)
    const qs = new URLSearchParams({ page: 1, limit: 12, ...(q && { q }), ...(category && { category }) })
    api
      .get(`/listings?${qs}`)
      .then((r) => id === reqId.current && setData(r))
      .catch((e) => id === reqId.current && setError(e.message))
      .finally(() => {
        clearTimeout(t)
        if (id === reqId.current) {
          setLoading(false)
          setSlow(false)
        }
      })
    return () => clearTimeout(t)
  }, [q, category])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const qs = new URLSearchParams({ page: data.page + 1, limit: 12, ...(q && { q }), ...(category && { category }) })
      const r = await api.get(`/listings?${qs}`)
      setData((d) => ({ ...r, items: [...d.items, ...r.items] }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const update = (next) => {
    const p = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    setParams(p)
  }

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Find a stay that feels like somewhere.</h1>
          <p>Castles, beach huts, mountain lodges and more. Book instantly, pay securely.</p>
          <form
            className="searchbar"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              update({ q: draft.trim() })
            }}
          >
            <Search size={20} />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search by place, title or vibe, e.g. “goa pool”"
              aria-label="Search stays"
            />
            <button className="btn btn-primary">Search</button>
          </form>
        </div>
      </section>

      <div className="container">
        <div className="filters-row">
          <div className="cats" role="tablist" aria-label="Categories">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={category === id}
                className={`cat ${category === id ? 'active' : ''}`}
                onClick={() => update({ category: id })}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={withTax}
              onChange={(e) => {
                setWithTax(e.target.checked)
                try {
                  localStorage.setItem('lookout.withTax', e.target.checked ? '1' : '0')
                } catch {
                  /* ignore */
                }
              }}
            />
            <span className="track" />
            <span>Show prices with GST</span>
          </label>
        </div>

        {(q || category) && !loading && !error && (
          <p className="muted result-meta">
            {data.total} stay{data.total === 1 ? '' : 's'}
            {q && <> matching “{q}”</>}
            {category && <> in {category}</>} ·{' '}
            <button className="link-btn" onClick={() => setParams({})}>
              Clear filters
            </button>
          </p>
        )}

        {error && (
          <div className="empty">
            <p>{error}</p>
            <button className="btn btn-dark" onClick={() => setParams(new URLSearchParams(params))}>
              Try again
            </button>
          </div>
        )}

        {loading && (
          <>
            {slow && <p className="notice">Waking up the server. The first load can take up to a minute on free hosting…</p>}
            <div className="grid">
              {Array.from({ length: 6 }, (_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </>
        )}

        {!loading && !error && data.items.length === 0 && (
          <div className="empty">
            <SearchX size={40} />
            <h3>No stays found</h3>
            <p className="muted">Try a different search or clear the filters.</p>
            <button className="btn btn-dark" onClick={() => setParams({})}>
              Show all stays
            </button>
          </div>
        )}

        {!loading && data.items.length > 0 && (
          <>
            <div className="grid">
              {data.items.map((l) => (
                <ListingCard key={l._id} listing={l} withTax={withTax} />
              ))}
            </div>
            {data.page < data.pages && (
              <div className="center">
                <button className="btn btn-dark" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Show more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
