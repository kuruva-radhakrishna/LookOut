import { Link } from 'react-router-dom'
import { MapPin, Star } from 'lucide-react'
import { GST_RATE, inr } from '../lib/format'

export default function ListingCard({ listing, withTax }) {
  const price = withTax ? listing.cost * (1 + GST_RATE) : listing.cost
  return (
    <Link to={`/listings/${listing._id}`} className="card">
      <div className="card-img">
        <img src={listing.img?.url} alt={listing.title} loading="lazy" />
        <span className="chip chip-float">{listing.category}</span>
      </div>
      <div className="card-body">
        <div className="card-row">
          <h3>{listing.title}</h3>
          {listing.ratingCount > 0 && (
            <span className="rating">
              <Star size={14} fill="currentColor" /> {listing.ratingAvg}
            </span>
          )}
        </div>
        <p className="muted">
          <MapPin size={14} /> {listing.place}, {listing.country}
        </p>
        <p className="price">
          <strong>{inr(price)}</strong> <span className="muted">/ night{withTax ? ' incl. GST' : ''}</span>
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
        <div className="skeleton line" style={{ width: '70%' }} />
        <div className="skeleton line" style={{ width: '45%' }} />
        <div className="skeleton line" style={{ width: '30%' }} />
      </div>
    </div>
  )
}
