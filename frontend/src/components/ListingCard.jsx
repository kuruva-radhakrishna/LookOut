import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { GST_RATE, inr } from '../lib/format'

export default function ListingCard({ listing, withTax }) {
  const price = withTax ? listing.cost * (1 + GST_RATE) : listing.cost
  const favourite = listing.ratingAvg >= 4.5 && listing.ratingCount >= 5
  return (
    <Link to={`/listings/${listing._id}`} className="card">
      <div className="card-img">
        <img src={listing.img?.url} alt={listing.title} loading="lazy" />
        {favourite && <span className="badge-float">Guest favourite</span>}
      </div>
      <div className="card-body">
        <div className="card-row">
          <h3>{listing.place}</h3>
          {listing.ratingCount > 0 && (
            <span className="rating">
              <Star size={13} fill="currentColor" /> {listing.ratingAvg.toFixed(1)}
            </span>
          )}
        </div>
        <p className="card-title">{listing.title}</p>
        <p className="price">
          <strong>{inr(price)}</strong> <span>night{withTax ? ' incl. GST' : ''}</span>
        </p>
      </div>
    </Link>
  )
}

export function CardSkeleton() {
  return (
    <div className="card" aria-hidden="true">
      <div className="card-img skeleton" />
      <div className="card-body">
        <div className="skeleton line" style={{ width: '60%' }} />
        <div className="skeleton line" style={{ width: '85%' }} />
        <div className="skeleton line" style={{ width: '35%' }} />
      </div>
    </div>
  )
}
