import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock, Loader2, ShieldCheck, TimerOff, Users } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDate, inr, inrFromPaise } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import DemoPayment from '../components/DemoPayment'
import Spinner from '../components/Spinner'

let razorpayLoader
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  razorpayLoader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = resolve
    s.onerror = () => {
      razorpayLoader = null
      reject(new Error('Could not load the payment window. Check your connection.'))
    }
    document.body.appendChild(s)
  })
  return razorpayLoader
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function Checkout() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    Promise.all([api.get(`/bookings/${id}`), api.get('/health')])
      .then(([b, h]) => {
        setBooking(b)
        setHealth(h)
      })
      .catch((e) => setError(e.message))
  }, [id])

  const holdEnds = booking?.status === 'pending' && booking.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() : null
  useEffect(() => {
    if (!holdEnds) return
    const tick = () => setLeft(Math.max(0, Math.round((holdEnds - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [holdEnds])

  const reloadBooking = () => api.get(`/bookings/${id}`).then(setBooking).catch(() => {})
  const onDemoPaid = async () => {
    await reloadBooking()
    toast.success('Payment received. Your stay is booked!')
  }

  async function verify(body) {
    try {
      await api.post(`/bookings/${id}/verify`, body)
      setBooking(await api.get(`/bookings/${id}`)) // refetch: the verify response has an unpopulated listing
      toast.success('Payment received. Your stay is booked!')
    } catch (err) {
      toast.error(err.message)
      api.get(`/bookings/${id}`).then(setBooking).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  async function pay() {
    setBusy(true)
    try {
      await loadRazorpay()
      const rzp = new window.Razorpay({
        key: health.razorpayKeyId,
        order_id: booking.payment.orderId,
        amount: booking.pricing.total,
        currency: booking.pricing.currency,
        name: 'LookOut',
        description: booking.listing.title,
        prefill: { name: user?.username, email: user?.email },
        theme: { color: '#e4572e' },
        handler: (r) => verify(r),
        modal: { ondismiss: () => setBusy(false) },
      })
      rzp.on('payment.failed', (r) => {
        toast.error(r.error?.description || 'Payment failed. You can try again.')
        setBusy(false)
      })
      rzp.open()
    } catch (err) {
      toast.error(err.message)
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    try {
      await api.post(`/bookings/${id}/cancel`)
      toast.success('Reservation cancelled')
      navigate(`/listings/${booking.listing._id}`)
    } catch (err) {
      toast.error(err.message)
      setConfirmCancel(false)
      setBusy(false)
    }
  }

  if (error) return <div className="container empty"><p>{error}</p><Link className="btn btn-dark" to="/bookings">My bookings</Link></div>
  if (!booking || !health) return <Spinner />

  const l = booking.listing
  const expired = booking.status === 'expired' || booking.status === 'cancelled' || (booking.status === 'pending' && left === 0)
  const isDemo = health.paymentMode === 'demo'

  const summary = (
    <div className="panel summary">
      <img src={l.img?.url} alt="" />
      <div>
        <h3>{l.title}</h3>
        <p className="muted">
          {l.place}, {l.country}
        </p>
        <p>
          <CalendarDays size={15} /> {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)} · {booking.nights} night{booking.nights > 1 ? 's' : ''}
        </p>
        <p>
          <Users size={15} /> {booking.guests} guest{booking.guests > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )

  if (booking.status === 'confirmed')
    return (
      <div className="container narrow">
        <div className="panel success">
          <CheckCircle2 size={56} />
          <h1>You're booked!</h1>
          <p className="muted">Booking ref {booking._id.slice(-8).toUpperCase()}. Pack your bags.</p>
        </div>
        {summary}
        <p className="center">
          Paid <strong>{inrFromPaise(booking.pricing.total)}</strong>
        </p>
        <div className="row gap center-row">
          <Link className="btn btn-primary" to="/bookings">
            View my bookings
          </Link>
          <Link className="btn btn-ghost" to="/">
            Keep exploring
          </Link>
        </div>
      </div>
    )

  if (expired)
    return (
      <div className="container narrow">
        <div className="panel success warn">
          <TimerOff size={52} />
          <h1>{booking.status === 'cancelled' ? 'Reservation cancelled' : 'Your hold expired'}</h1>
          <p className="muted">We released those dates so others can book. They may still be free.</p>
          <Link className="btn btn-primary" to={`/listings/${l._id}`}>
            Pick dates again
          </Link>
        </div>
      </div>
    )

  return (
    <div className="container narrow">
      <h1>Confirm and pay</h1>
      <div className={`hold ${left !== null && left < 60 ? 'urgent' : ''}`} role="timer">
        <Clock size={18} />
        <span>
          We're holding your dates for <strong>{left === null ? '…' : mmss(left)}</strong>
        </span>
      </div>
      {summary}

      <div className="panel">
        <h3>Price details</h3>
        <dl className="breakdown">
          <div>
            <dt>
              {inr(booking.pricing.subtotal / 100 / booking.nights)} × {booking.nights} night{booking.nights > 1 ? 's' : ''}
            </dt>
            <dd>{inrFromPaise(booking.pricing.subtotal)}</dd>
          </div>
          <div>
            <dt>GST (18%)</dt>
            <dd>{inrFromPaise(booking.pricing.tax)}</dd>
          </div>
          <div className="total">
            <dt>Total (INR)</dt>
            <dd>{inrFromPaise(booking.pricing.total)}</dd>
          </div>
        </dl>
      </div>

      {isDemo ? (
        <DemoPayment booking={booking} onPaid={onDemoPaid} reload={reloadBooking} />
      ) : (
        <>
          <button className="btn btn-primary btn-block btn-lg" onClick={pay} disabled={busy}>
            {busy ? <Loader2 className="spin" size={20} /> : <ShieldCheck size={20} />}
            Pay {inrFromPaise(booking.pricing.total)}
          </button>
          <p className="hint center">Secure payment by Razorpay (UPI, cards, netbanking, wallets).</p>
        </>
      )}
      <p className="center">
        <button className="link-btn" onClick={() => setConfirmCancel(true)} disabled={busy}>
          Cancel reservation
        </button>
      </p>

      <ConfirmDialog
        open={confirmCancel}
        danger
        busy={busy}
        title="Cancel this reservation?"
        message="Your held dates will be released straight away."
        confirmLabel="Cancel reservation"
        onConfirm={cancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  )
}
