import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapPin, Pencil, Star, Trash2, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import BookingCard from '../components/BookingCard'
import Reviews from '../components/Reviews'
import MapView from '../components/MapView'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'

export default function ListingDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [listing, setListing] = useState(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .get(`/listings/${id}`)
      .then(setListing)
      .catch((e) => setError(e.status === 404 ? 'not-found' : e.message))

  useEffect(() => {
    setListing(null)
    setError('')
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function remove() {
    setBusy(true)
    try {
      await api.del(`/listings/${id}`)
      toast.success('Listing deleted')
      navigate('/')
    } catch (e) {
      toast.error(e.message)
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  if (error === 'not-found')
    return (
      <div className="container empty">
        <h2>That stay doesn't exist</h2>
        <Link className="btn btn-dark" to="/">
          Back to explore
        </Link>
      </div>
    )
  if (error) return <div className="container empty">{error}</div>
  if (!listing) return <Spinner />

  const isOwner = !!user && listing.owner?._id === user.id

  return (
    <div className="container detail">
      <div className="detail-head">
        <div>
          <h1>{listing.title}</h1>
          <p className="muted meta">
            {listing.ratingCount > 0 && (
              <a href="#reviews" className="rating">
                <Star size={14} fill="currentColor" /> {listing.ratingAvg} ({listing.ratingCount})
              </a>
            )}
            <span>
              <MapPin size={14} /> {listing.place}, {listing.country}
            </span>
            <span className="chip">{listing.category}</span>
          </p>
        </div>
        {isOwner && (
          <div className="row gap">
            <Link className="btn btn-ghost" to={`/listings/${id}/edit`}>
              <Pencil size={16} /> Edit
            </Link>
            <button className="btn btn-ghost danger-text" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
      </div>

      <img className="detail-img" src={listing.img?.url} alt={listing.title} />

      <div className="detail-cols">
        <div>
          <div className="host">
            <div className="avatar">{listing.owner?.username?.[0]?.toUpperCase()}</div>
            <div>
              <strong>Hosted by @{listing.owner?.username}</strong>
              <p className="muted">
                <Users size={14} /> Up to {listing.maxGuests} guests
              </p>
            </div>
          </div>
          <hr />
          <p className="desc">{listing.description || 'The host has not added a description yet.'}</p>
          <hr />
          <section className="section">
            <h2>Where you'll be</h2>
            <p className="muted">The exact address is shared after booking.</p>
            <MapView coordinates={listing.geometry?.coordinates} label={listing.place} />
          </section>
          <hr />
          <Reviews listingId={id} isOwner={isOwner} onChanged={load} />
        </div>
        <BookingCard listing={listing} isOwner={isOwner} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        busy={busy}
        title="Delete this listing?"
        message="Its reviews and open reservations will be removed. This can't be undone."
        confirmLabel="Delete listing"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
