import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Loader2, Star, Users } from 'lucide-react'
import DateRangePicker from './DateRangePicker'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { diffDays, fmtDate, inr, inrFromPaise, priceStay } from '../lib/format'

export default function BookingCard({ listing, isOwner, mine, refreshKey }) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [booked, setBooked] = useState(() => new Set())
  const [range, setRange] = useState({ start: null, end: null })
  const [guests, setGuests] = useState(1)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadAvailability = useCallback(
    () =>
      api
        .get(`/listings/${listing._id}/availability`)
        .then((r) => setBooked(new Set(r.booked)))
        .catch(() => {}),
    [listing._id],
  )
  useEffect(() => {
    loadAvailability()
  }, [loadAvailability, refreshKey])

  const nights = range.start && range.end ? diffDays(range.start, range.end) : 0
  const price = useMemo(() => (nights ? priceStay(listing.cost, nights) : null), [listing.cost, nights])

  async function reserve() {
    if (!user) return navigate('/login', { state: { from: location.pathname } })
    setBusy(true)
    try {
      const { booking } = await api.post('/bookings', {
        listingId: listing._id,
        checkIn: range.start,
        checkOut: range.end,
        guests,
      })
      navigate(`/checkout/${booking._id}`)
    } catch (err) {
      toast.error(err.message)
      if (err.status === 409) {
        setRange({ start: null, end: null })
        loadAvailability() // someone beat us to it: show what's actually free now
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="book-card">
      <div className="book-price">
        <span>
          <strong>{inr(listing.cost)}</strong> <small>/ night</small>
        </span>
        {listing.ratingCount > 0 && (
          <span className="rating">
            <Star size={14} fill="currentColor" /> {listing.ratingAvg}
          </span>
        )}
      </div>

      <button type="button" className="date-field" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CalendarDays size={18} />
        <span className="date-cols">
          <span>
            <small>Check-in</small>
            {range.start ? fmtDate(range.start, { day: 'numeric', month: 'short' }) : 'Add date'}
          </span>
          <span>
            <small>Check-out</small>
            {range.end ? fmtDate(range.end, { day: 'numeric', month: 'short' }) : 'Add date'}
          </span>
        </span>
      </button>

      {open && (
        <div className="cal-pop">
          <DateRangePicker
            booked={booked}
            mine={mine}
            start={range.start}
            end={range.end}
            onChange={(r) => {
              setRange(r)
              if (r.start && r.end) setOpen(false)
            }}
          />
        </div>
      )}

      <label className="guest-field">
        <Users size={18} />
        <span>
          <small>Guests</small>
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
            {Array.from({ length: listing.maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} guest{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </span>
      </label>

      {isOwner ? (
        <p className="hint">This is your listing. Guests will see a Reserve button here.</p>
      ) : (
        <button className="btn btn-primary btn-block" disabled={!nights || busy} onClick={reserve}>
          {busy ? <Loader2 className="spin" size={18} /> : null}
          {nights ? 'Reserve' : 'Select dates'}
        </button>
      )}

      {price && (
        <>
          <p className="hint center">You won't be charged yet. We'll hold your dates while you pay.</p>
          <dl className="breakdown">
            <div>
              <dt>
                {inr(listing.cost)} × {nights} night{nights > 1 ? 's' : ''}
              </dt>
              <dd>{inrFromPaise(price.subtotal)}</dd>
            </div>
            <div>
              <dt>GST (18%)</dt>
              <dd>{inrFromPaise(price.tax)}</dd>
            </div>
            <div className="total">
              <dt>Total</dt>
              <dd>{inrFromPaise(price.total)}</dd>
            </div>
          </dl>
        </>
      )}
    </aside>
  )
}
