import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import ListingCard, { CardSkeleton } from './ListingCard'

const taxPref = () => {
  try {
    return localStorage.getItem('lookout.withTax') === '1'
  } catch {
    return false
  }
}
const regionOf = (place) => String(place).split(',').pop().trim()

/** "More stays like this": a horizontally scrolling row with left/right buttons. Renders nothing if there is nothing similar. */
export default function SimilarListings({ listing }) {
  const [items, setItems] = useState(null)
  const [edge, setEdge] = useState({ left: false, right: false, page: 1, pages: 1 })
  const track = useRef(null)

  useEffect(() => {
    let live = true
    api
      .get(`/listings/${listing._id}/similar?limit=15`)
      .then((r) => live && setItems(r))
      .catch(() => live && setItems([]))
    return () => {
      live = false
    }
  }, [listing._id])

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    // the gaps between cards make scrollWidth/clientWidth slightly more than a whole number of pages, hence the -0.1
    const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.1))
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    setEdge({
      left: el.scrollLeft > 4,
      right: !atEnd,
      pages,
      page: atEnd ? pages : Math.min(pages, Math.round(el.scrollLeft / el.clientWidth) + 1),
    })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, items])

  const go = (dir) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.9, behavior: 'smooth' })
  const onKey = (e) => {
    if (e.key === 'ArrowRight') go(1)
    if (e.key === 'ArrowLeft') go(-1)
  }

  if (items && items.length === 0) return null
  const region = regionOf(listing.place)

  return (
    <section className="similar" aria-label="More stays like this">
      <div className="similar-head">
        <div>
          <h2>More stays like this</h2>
          <p className="muted">
            In and around {region}, and similar {listing.category} stays.{' '}
            <Link to={`/?q=${encodeURIComponent(region)}`}>See all in {region}</Link>
          </p>
        </div>
        <div className="car-btns">
          {edge.pages > 1 && (
            <span className="car-count" aria-live="polite">
              {edge.page} / {edge.pages}
            </span>
          )}
          <button className="car-btn" onClick={() => go(-1)} disabled={!edge.left} aria-label="Previous stays">
            <ChevronLeft size={18} />
          </button>
          <button className="car-btn" onClick={() => go(1)} disabled={!edge.right} aria-label="Next stays">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="carousel" ref={track} onScroll={measure} onKeyDown={onKey} tabIndex={0} role="group" aria-label="Similar stays, use the arrow keys to scroll">
        {items
          ? items.map((l) => (
              <div className="slide" key={l._id}>
                <ListingCard listing={l} withTax={taxPref()} />
              </div>
            ))
          : Array.from({ length: 4 }, (_, i) => (
              <div className="slide" key={i}>
                <CardSkeleton />
              </div>
            ))}
      </div>
    </section>
  )
}
