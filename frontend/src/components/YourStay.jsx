import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock, PenLine, Users } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDate, inrFromPaise } from '../lib/format'
import { bookingRef, describeBooking, isRefundable, paidWith } from '../lib/bookings'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from './ConfirmDialog'

function HoldLeft({ until }) {
  const calc = () => Math.max(0, Math.round((new Date(until) - Date.now()) / 1000))
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until])
  return <span className="hold-left"><Clock size={13} /> Pay within {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
}

/**
 * "Your stay" card for a listing page: the signed-in guest's own bookings at this place, with the actions that
 * make sense for each (finish paying, cancel, review). Renders nothing if there is nothing to show.
 */
export default function YourStay({ bookings, onChanged }) {
  const toast = useToast()
  const [cancelling, setCancelling] = useState(null)
  const [busy, setBusy] = useState(false)

  const shown = bookings
    .map((b) => ({ b, d: describeBooking(b) }))
    .filter(({ d }) => d.tab !== 'cancelled') // cancelled and expired ones live in My bookings
    .sort((x, y) => (x.d.tab === y.d.tab ? new Date(x.b.checkIn) - new Date(y.b.checkIn) : x.d.tab === 'upcoming' ? -1 : 1))

  if (!shown.length) return null

  async function cancel() {
    setBusy(true)
    try {
      const updated = await api.post(`/bookings/${cancelling._id}/cancel`)
      toast.success(updated.payment?.refundId ? 'Cancelled. Your refund is on its way.' : 'Booking cancelled')
      setCancelling(null)
      onChanged()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="your-stay" aria-label="Your stay at this place">
      <h2>{shown.some(({ d }) => d.tab === 'upcoming') ? 'Your stay' : 'You stayed here'}</h2>
      <div className="stay-list">
        {shown.slice(0, 3).map(({ b, d }) => (
          <article key={b._id} className={`stay stay-${d.tone}`}>
            <div className="stay-main">
              <div className="stay-top">
                <span className={`badge badge-${d.tone}`}>{d.label}</span>
                <span className="muted">Ref {bookingRef(b)}</span>
                {b.status === 'pending' && <HoldLeft until={b.holdExpiresAt} />}
              </div>
              <p className="stay-dates">
                <CalendarDays size={16} /> {fmtDate(b.checkIn, { weekday: 'short', day: 'numeric', month: 'short' })} → {fmtDate(b.checkOut, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                <span className="muted"> · {b.nights} night{b.nights > 1 ? 's' : ''}</span>
              </p>
              <p className="stay-meta">
                <Users size={14} /> {b.guests} guest{b.guests > 1 ? 's' : ''}
                <span> · <strong>{inrFromPaise(b.pricing.total)}</strong></span>
                {b.status === 'confirmed' && (
                  <span className="paid">
                    <CheckCircle2 size={14} /> Paid{paidWith(b) ? ` with ${paidWith(b)}` : ''}
                  </span>
                )}
              </p>
              {d.tab === 'upcoming' && b.status === 'confirmed' && (
                <p className="hint">{isRefundable(b) ? 'Free cancellation until 48 hours before check-in.' : 'No longer refundable (check-in is within 48 hours).'}</p>
              )}
            </div>
            <div className="stay-actions">
              {b.status === 'pending' && (
                <Link className="btn btn-primary btn-sm" to={`/checkout/${b._id}`}>
                  Complete payment
                </Link>
              )}
              {d.tab === 'past' && (
                <a className="btn btn-primary btn-sm" href="#reviews">
                  <PenLine size={14} /> Write a review
                </a>
              )}
              <Link className="btn btn-ghost btn-sm" to="/bookings">
                All bookings
              </Link>
              {d.tab === 'upcoming' && (
                <button className="btn btn-ghost btn-sm danger-text" onClick={() => setCancelling(b)}>
                  Cancel
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {shown.length > 3 && (
        <p className="hint">
          + {shown.length - 3} more at this place in <Link to="/bookings">My bookings</Link>
        </p>
      )}

      <ConfirmDialog
        open={Boolean(cancelling)}
        danger
        busy={busy}
        title="Cancel this booking?"
        message={cancelling?.status === 'confirmed' ? (isRefundable(cancelling) ? `You'll get a full refund of ${inrFromPaise(cancelling.pricing.total)}.` : 'Check-in is less than 48 hours away, so this booking is not eligible for a refund.') : 'Your held dates will be released.'}
        confirmLabel="Cancel booking"
        onConfirm={cancel}
        onCancel={() => setCancelling(null)}
      />
    </section>
  )
}
