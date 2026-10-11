import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BadgeCheck, CornerDownRight, MessageSquareReply, Star, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDate } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ImageUploader from './ImageUploader'
import ConfirmDialog from './ConfirmDialog'
import Lightbox from './Lightbox'

const PAGE = 6 // two columns of three
const SORTS = [
  { id: 'recent', label: 'Most recent' },
  { id: 'helpful', label: 'Most helpful' },
  { id: 'high', label: 'Highest rated' },
  { id: 'low', label: 'Lowest rated' },
]

const hue = (name = '') => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
const countAll = (r) => r.replies.reduce((n, x) => n + 1 + countAll(x), 0)

function Avatar({ name }) {
  return (
    <span className="avatar sm" style={{ background: `hsl(${hue(name)} 45% 38%)` }} aria-hidden="true">
      {name?.[0]?.toUpperCase() || '?'}
    </span>
  )
}

function StarRow({ value, size = 13 }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= value ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

function StarInput({ value, onChange }) {
  return (
    <span className="stars big" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)}>
          <Star size={26} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  )
}

/** Text clamped to a few lines with a Show more / Show less toggle, shown only when the text really overflows. */
function ClampText({ text, lines = 4 }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [text, open])
  return (
    <>
      <p ref={ref} className={`rv-text ${open ? '' : 'clamped'}`} style={{ '--lines': lines }}>
        {text}
      </p>
      {(overflows || open) && (
        <button className="link-btn dark rv-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  )
}

function Summary({ summary }) {
  if (!summary?.count) return null
  return (
    <div className="rv-summary">
      <div className="rv-score">
        <strong>{summary.avg.toFixed(1)}</strong>
        <StarRow value={Math.round(summary.avg)} size={16} />
        <span className="muted">{summary.count} review{summary.count > 1 ? 's' : ''}</span>
      </div>
      <ul className="rv-bars" aria-label="Rating breakdown">
        {[5, 4, 3, 2, 1].map((n) => (
          <li key={n}>
            <span>{n}</span>
            <span className="bar">
              <i style={{ width: `${(summary.distribution[n] / summary.count) * 100}%` }} />
            </span>
            <span className="muted">{summary.distribution[n]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReplyForm({ onSubmit, onCancel }) {
  const [text, setText] = useState('')
  const [images, setImages] = useState([])
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ comment: text.trim(), images: images.map(({ url, filename }) => ({ url, filename })) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="rv-reply-form" onSubmit={submit}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" rows={2} maxLength={1000} required autoFocus />
      <ImageUploader images={images} onChange={setImages} max={2} label="Add photo" />
      <div className="row gap end">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-dark btn-sm" disabled={busy || !text.trim()}>
          Post reply
        </button>
      </div>
    </form>
  )
}

function ReviewCard({ r, ctx, level = 0 }) {
  const { user, react, replyTo, askDelete, openPhotos } = ctx
  const [replying, setReplying] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const mine = user && r.author?._id === user.id
  const total = countAll(r)
  const isReply = level > 0

  return (
    <article className={`rv ${isReply ? 'rv-reply' : ''}`}>
      <header className="rv-head">
        <Avatar name={r.author?.username} />
        <div className="rv-who">
          <strong>
            @{r.author?.username || 'deleted user'}
            {r.isHost && <span className="tag host">Host</span>}
            {r.verifiedStay && (
              <span className="tag ok" title="Completed a paid stay here">
                <BadgeCheck size={12} /> Stayed here
              </span>
            )}
          </strong>
          {!isReply && r.author?.memberSince && <span className="muted">Member since {new Date(r.author.memberSince).getFullYear()}</span>}
        </div>
        {mine && (
          <button className="icon-btn rv-del" aria-label={isReply ? 'Delete reply' : 'Delete review'} onClick={() => askDelete(r)}>
            <Trash2 size={15} />
          </button>
        )}
      </header>

      <div className="rv-meta">
        {r.rating ? <StarRow value={r.rating} /> : <CornerDownRight size={13} className="muted" />}
        <span className="muted">· {isReply ? fmtDate(r.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }) : fmtDate(r.createdAt, { month: 'long', year: 'numeric' })}</span>
      </div>

      <ClampText text={r.comment} lines={isReply ? 3 : 4} />

      {r.images.length > 0 && (
        <ul className="rv-photos">
          {r.images.map((img, i) => (
            <li key={img.url}>
              <button onClick={() => openPhotos(r.images, i)} aria-label={`Open photo ${i + 1} of ${r.images.length}`}>
                <img src={img.url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rv-actions">
        <button className={`rv-react ${r.myReaction === 'like' ? 'on' : ''}`} onClick={() => react(r, 'like')} disabled={mine} aria-pressed={r.myReaction === 'like'} aria-label={`Helpful, ${r.likes}`} title={mine ? "You can't react to your own post" : 'Helpful'}>
          <ThumbsUp size={15} fill={r.myReaction === 'like' ? 'currentColor' : 'none'} /> {r.likes > 0 && r.likes}
        </button>
        <button className={`rv-react ${r.myReaction === 'dislike' ? 'on' : ''}`} onClick={() => react(r, 'dislike')} disabled={mine} aria-pressed={r.myReaction === 'dislike'} aria-label={`Not helpful, ${r.dislikes}`} title={mine ? "You can't react to your own post" : 'Not helpful'}>
          <ThumbsDown size={15} fill={r.myReaction === 'dislike' ? 'currentColor' : 'none'} /> {r.dislikes > 0 && r.dislikes}
        </button>
        {r.depth < 3 && (
          <button className="rv-react" onClick={() => (user ? setReplying((x) => !x) : ctx.needLogin())}>
            <MessageSquareReply size={15} /> Reply
          </button>
        )}
        {total > 0 && (
          <button className="rv-react" onClick={() => setShowReplies((s) => !s)} aria-expanded={showReplies}>
            {showReplies ? 'Hide' : 'View'} {total} repl{total > 1 ? 'ies' : 'y'}
          </button>
        )}
      </div>

      {replying && (
        <ReplyForm
          onCancel={() => setReplying(false)}
          onSubmit={async (body) => {
            if (await replyTo(r, body)) {
              setReplying(false)
              setShowReplies(true)
            }
          }}
        />
      )}

      {showReplies && total > 0 && (
        <div className="rv-thread">
          {r.replies.map((c) => (
            <ReviewCard key={c._id} r={c} ctx={ctx} level={level + 1} />
          ))}
        </div>
      )}
    </article>
  )
}

export default function Reviews({ listingId, isOwner, onChanged }) {
  const { user } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [sort, setSort] = useState('recent')
  const [data, setData] = useState({ items: [], total: 0, summary: null })
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [images, setImages] = useState([])
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [photos, setPhotos] = useState(null)

  const load = useCallback(
    async (offset = 0) => {
      const r = await api.get(`/listings/${listingId}/reviews?sort=${sort}&limit=${PAGE}&offset=${offset}`)
      setData((d) => ({
        items: offset ? [...d.items, ...r.items.filter((x) => !d.items.some((y) => y._id === x._id))] : r.items,
        total: r.total,
        summary: r.summary,
      }))
    },
    [listingId, sort],
  )

  useEffect(() => {
    setLoading(true)
    load(0)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [load])

  const refresh = async () => {
    await load(0).catch(() => {})
    onChanged?.()
  }

  async function submit(e) {
    e.preventDefault()
    if (!rating) return toast.error('Choose a star rating first')
    setBusy(true)
    try {
      await api.post(`/listings/${listingId}/reviews`, { rating, comment: comment.trim(), images: images.map(({ url, filename }) => ({ url, filename })) })
      setRating(0)
      setComment('')
      setImages([])
      toast.success('Thanks for your review!')
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Updates one review/reply anywhere in the loaded tree.
  const patch = (id, fn) => {
    const walk = (list) => list.map((r) => (r._id === id ? fn(r) : { ...r, replies: walk(r.replies) }))
    setData((d) => ({ ...d, items: walk(d.items) }))
  }

  const ctx = {
    user,
    needLogin: () => toast.error('Log in to reply'),
    openPhotos: (imgs, i) => setPhotos({ imgs, i }),
    askDelete: setDeleting,
    async react(r, value) {
      if (!user) return toast.error('Log in to react')
      const next = r.myReaction === value ? 'none' : value
      const before = { likes: r.likes, dislikes: r.dislikes, myReaction: r.myReaction }
      patch(r._id, (x) => ({
        ...x,
        myReaction: next === 'none' ? null : next,
        likes: x.likes + (next === 'like' ? 1 : 0) - (x.myReaction === 'like' ? 1 : 0),
        dislikes: x.dislikes + (next === 'dislike' ? 1 : 0) - (x.myReaction === 'dislike' ? 1 : 0),
      })) // optimistic
      try {
        const res = await api.post(`/reviews/${r._id}/reaction`, { value: next })
        patch(r._id, (x) => ({ ...x, ...res }))
      } catch (err) {
        patch(r._id, (x) => ({ ...x, ...before }))
        toast.error(err.message)
      }
    },
    async replyTo(r, body) {
      try {
        await api.post(`/reviews/${r._id}/replies`, body)
        toast.success('Reply posted')
        await load(0)
        return true
      } catch (err) {
        toast.error(err.message)
        return false
      }
    },
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await api.del(`/reviews/${deleting._id}`)
      toast.success(deleting.depth ? 'Reply deleted' : 'Review deleted')
      setDeleting(null)
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const { items, total, summary } = data

  return (
    <section className="section reviews" id="reviews">
      <div className="rv-top">
        <h2>
          <Star size={20} fill="currentColor" className="rv-h-star" /> {summary?.count ? `${summary.avg.toFixed(1)} · ${summary.count} review${summary.count > 1 ? 's' : ''}` : 'Reviews'}
        </h2>
        {total > 1 && (
          <label className="rv-sort">
            <span className="sr-only">Sort reviews</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort reviews">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Summary summary={summary} />

      {!isOwner &&
        (user ? (
          <form className="review-form" onSubmit={submit}>
            <h3>Share your experience</h3>
            <StarInput value={rating} onChange={setRating} />
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was your stay? What would you tell the next guest?" rows={3} maxLength={1000} required />
            <div className="rv-counter muted small">{comment.length}/1000</div>
            <ImageUploader images={images} onChange={setImages} max={4} label="Add photos" />
            <button className="btn btn-dark" disabled={busy || !comment.trim() || !rating}>
              Post review
            </button>
          </form>
        ) : (
          <p className="muted">
            <Link to="/login" state={{ from: location.pathname }}>
              Log in
            </Link>{' '}
            to leave a review or join the conversation.
          </p>
        ))}

      {loading && <div className="skeleton line" style={{ height: 90 }} />}
      {!loading && items.length === 0 && <p className="muted">No reviews yet. Be the first!</p>}

      <div className="rv-grid">
        {items.map((r) => (
          <ReviewCard key={r._id} r={r} ctx={ctx} />
        ))}
      </div>

      {items.length < total && (
        <div className="center">
          <button
            className="btn btn-ghost"
            disabled={more}
            onClick={async () => {
              setMore(true)
              await load(items.length).catch(() => {})
              setMore(false)
            }}
          >
            {more ? 'Loading…' : `Show more reviews (${total - items.length} left)`}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        busy={busy}
        title={deleting?.depth ? 'Delete this reply?' : 'Delete this review?'}
        message={deleting?.depth ? 'This reply and any replies to it will be removed.' : 'Your review, its photos and every reply to it will be removed.'}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      {photos && <Lightbox images={photos.imgs} start={photos.i} onClose={() => setPhotos(null)} />}
    </section>
  )
}
