import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapPin, Pencil, Share2, Star, Trash2, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import BookingCard from '../components/BookingCard'
import YourStay from '../components/YourStay'
import SimilarListings from '../components/SimilarListings'
import Gallery from '../components/Gallery'
import FavoriteButton from '../components/FavoriteButton'
import { myNights } from '../lib/bookings'
import Reviews from '../components/Reviews'
import LocationSection from '../components/LocationSection'
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
  const [stays, setStays] = useState([]) // the signed-in guest's own bookings at this listing
  const [version, setVersion] = useState(0) // bumped whenever a booking changes so the calendar reloads

  const loadStays = () => {
    if (!user) return setStays([])
    api.get(`/bookings/mine?listing=${id}`).then(setStays).catch(() => setStays([]))
  }
  useEffect(() => {
    loadStays()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, version])

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
  const cover = listing.images?.[0] || listing.img
  const [city, ...rest] = listing.place.split(',').map((s) => s.trim())
  const region = rest.length ? rest[rest.length - 1] : null

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch {
      /* the share sheet was dismissed */
    }
  }

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
        <div className="row gap wrap detail-actions">
          <button className="btn btn-ghost btn-sm" onClick={share}>
            <Share2 size={16} /> Share
          </button>
          <FavoriteButton id={listing._id} variant="inline" />
          {isOwner && (
            <>
              <Link className="btn btn-ghost btn-sm" to={`/listings/${id}/edit`}>
                <Pencil size={16} /> Edit
              </Link>
              <button className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      <YourStay bookings={stays} onChanged={() => setVersion((v) => v + 1)} />

      <Gallery images={listing.images} title={listing.title} />
      {cover?.credit && (
        <p className="photo-credit">
          Cover photo: {cover.credit} · {cover.license} ·{' '}
          <a href={cover.source} target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
        </p>
      )}

      <div className="detail-cols">
        <div>
          <div className="host">
            <div className="avatar">{listing.owner?.username?.[0]?.toUpperCase()}</div>
            <div>
              <strong>Hosted by @{listing.owner?.username}</strong>
              <p className="muted">
                <Users size={14} /> Up to {listing.maxGuests} guests
                {listing.owner?.createdAt && <> · Host since {new Date(listing.owner.createdAt).getFullYear()}</>}
              </p>
            </div>
          </div>
          <hr />
          <p className="desc">{listing.description || 'The host has not added a description yet.'}</p>
          <hr />
          <section className="section">
            <h2>Where you'll be</h2>
            <p className="muted">The exact address is shared after booking.</p>
            <LocationSection coordinates={listing.geometry?.coordinates} label={listing.place} />
          </section>
          <hr />
          <Reviews listingId={id} isOwner={isOwner} onChanged={load} />
        </div>
        <BookingCard listing={listing} isOwner={isOwner} mine={myNights(stays)} refreshKey={version} />
      </div>

      <SimilarListings key={listing._id} listing={listing} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">LookOut</Link>
        <span aria-hidden="true">›</span>
        <Link to={`/?q=${encodeURIComponent(listing.country)}`}>{listing.country}</Link>
        {region && (
          <>
            <span aria-hidden="true">›</span>
            <Link to={`/?q=${encodeURIComponent(region)}`}>{region}</Link>
          </>
        )}
        <span aria-hidden="true">›</span>
        <Link to={`/?q=${encodeURIComponent(city)}`}>{city}</Link>
      </nav>

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
