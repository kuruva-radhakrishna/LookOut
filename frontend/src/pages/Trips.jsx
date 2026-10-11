import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Luggage } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDate, inrFromPaise } from '../lib/format'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'

const FULL_REFUND_MS = 2 * 86400000

function statusOf(b) {
  if (b.status === 'pending' && new Date(b.holdExpiresAt) <= Date.now()) return 'expired'
  return b.status
}
const LABEL = { pending: 'Awaiting payment', confirmed: 'Confirmed', cancelled: 'Cancelled', expired: 'Expired' }

export default function Trips() {
  const toast = useToast()
  const [tab, setTab] = useState('trips')
  const [data, setData] = useState({ trips: null, hosting: null })
  const [cancelling, setCancelling] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/bookings/mine'), api.get('/bookings/hosting')])
      .then(([trips, hosting]) => setData({ trips, hosting }))
      .catch((e) => setError(e.message))
  }, [])

  async function cancel() {
    setBusy(true)
    try {
      const updated = await api.post(`/bookings/${cancelling._id}/cancel`)
      setData((d) => ({ ...d, trips: d.trips.map((b) => (b._id === updated._id ? { ...b, ...updated, listing: b.listing, guest: b.guest } : b)) }))
      toast.success(updated.payment?.refundId ? 'Cancelled. Your refund is on its way.' : 'Reservation cancelled')
      setCancelling(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="container empty">{error}</div>
  const list = data[tab]
  if (!list) return <Spinner />

  const refundable = cancelling && new Date(cancelling.checkIn).getTime() - Date.now() >= FULL_REFUND_MS

  return (
    <div className="container narrow">
      <h1>My trips</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'trips'} className={tab === 'trips' ? 'active' : ''} onClick={() => setTab('trips')}>
          My bookings
        </button>
        <button role="tab" aria-selected={tab === 'hosting'} className={tab === 'hosting' ? 'active' : ''} onClick={() => setTab('hosting')}>
          Guests staying with me {data.hosting?.length ? `(${data.hosting.length})` : ''}
        </button>
      </div>

      {list.length === 0 && (
        <div className="empty">
          <Luggage size={40} />
          <h3>{tab === 'trips' ? 'No trips yet' : 'No reservations yet'}</h3>
          <p className="muted">{tab === 'trips' ? 'When you book a stay it will show up here.' : 'Confirmed bookings on your listings appear here.'}</p>
          <Link className="btn btn-dark" to={tab === 'trips' ? '/' : '/listings/new'}>
            {tab === 'trips' ? 'Explore stays' : 'Host a stay'}
          </Link>
        </div>
      )}

      <div className="trip-list">
        {list.map((b) => {
          const st = statusOf(b)
          const upcoming = new Date(b.checkIn) > Date.now()
          return (
            <article key={b._id} className="panel trip">
              <img src={b.listing?.img?.url} alt="" />
              <div className="trip-main">
                <div className="card-row">
                  <h3>
                    <Link to={`/listings/${b.listing?._id}`}>{b.listing?.title || 'Removed listing'}</Link>
                  </h3>
                  <span className={`badge badge-${st}`}>{LABEL[st]}</span>
                </div>
                <p className="muted">
                  <CalendarDays size={14} /> {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {b.guests} guest{b.guests > 1 ? 's' : ''}
                  {tab === 'hosting' && <> · @{b.guest?.username}</>}
                </p>
                <p>
                  <strong>{inrFromPaise(b.pricing.total)}</strong>
                  {b.payment?.refundedAmount ? <span className="muted"> · refunded {inrFromPaise(b.payment.refundedAmount)}</span> : null}
                </p>
                {tab === 'trips' && (
                  <div className="row gap">
                    {st === 'pending' && (
                      <Link className="btn btn-primary btn-sm" to={`/checkout/${b._id}`}>
                        Complete payment
                      </Link>
                    )}
                    {(st === 'pending' || (st === 'confirmed' && upcoming)) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setCancelling(b)}>
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <ConfirmDialog
        open={Boolean(cancelling)}
        danger
        busy={busy}
        title="Cancel this booking?"
        message={
          cancelling?.status === 'confirmed'
            ? refundable
              ? `You'll get a full refund of ${inrFromPaise(cancelling.pricing.total)}.`
              : 'Check-in is less than 48 hours away, so this booking is not eligible for a refund.'
            : 'Your held dates will be released.'
        }
        confirmLabel="Cancel booking"
        onConfirm={cancel}
        onCancel={() => setCancelling(null)}
      />
    </div>
  )
}
