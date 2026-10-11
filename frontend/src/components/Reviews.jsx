import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Star, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDate } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

function Stars({ value, onChange, size = 18 }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Star size={size} fill={n <= value ? 'currentColor' : 'none'} />
        return onChange ? (
          <button type="button" key={n} onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} role="radio" aria-checked={n === value}>
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        )
      })}
    </span>
  )
}

export default function Reviews({ listingId, isOwner, onChanged }) {
  const { user } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [reviews, setReviews] = useState(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/listings/${listingId}/reviews`).then(setReviews).catch(() => setReviews([]))
  }, [listingId])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const review = await api.post(`/listings/${listingId}/reviews`, { rating, comment })
      setReviews((r) => [review, ...r])
      setComment('')
      setRating(5)
      toast.success('Thanks for your review!')
      onChanged?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      await api.del(`/reviews/${id}`)
      setReviews((r) => r.filter((x) => x._id !== id))
      onChanged?.()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section className="section" id="reviews">
      <h2>Reviews {reviews?.length ? <span className="muted">({reviews.length})</span> : null}</h2>

      {!isOwner &&
        (user ? (
          <form className="review-form" onSubmit={submit}>
            <Stars value={rating} onChange={setRating} size={24} />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was your stay?"
              rows={3}
              maxLength={1000}
              required
            />
            <button className="btn btn-dark" disabled={busy || !comment.trim()}>
              Post review
            </button>
          </form>
        ) : (
          <p className="muted">
            <Link to="/login" state={{ from: location.pathname }}>
              Log in
            </Link>{' '}
            to leave a review.
          </p>
        ))}

      {reviews === null && <div className="skeleton line" style={{ height: 70 }} />}
      {reviews?.length === 0 && <p className="muted">No reviews yet. Be the first!</p>}
      <div className="review-list">
        {reviews?.map((r) => (
          <article key={r._id} className="review">
            <div className="avatar">{r.author?.username?.[0]?.toUpperCase() || '?'}</div>
            <div>
              <div className="review-top">
                <strong>@{r.author?.username || 'deleted user'}</strong>
                <span className="muted">{fmtDate(r.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <Stars value={r.rating} size={14} />
              <p>{r.comment}</p>
            </div>
            {user && r.author?._id === user.id && (
              <button className="icon-btn" aria-label="Delete review" onClick={() => remove(r._id)}>
                <Trash2 size={16} />
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
