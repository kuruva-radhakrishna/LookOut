import { addDays, diffDays, todayISO } from './format'

export const FULL_REFUND_MS = 2 * 86400000 // free cancellation until 48h before check-in

export const bookingRef = (b) => b._id.slice(-8).toUpperCase()
const day = (d) => new Date(d).toISOString().slice(0, 10)

/** Where a booking sits in its life and the badge to show for it. */
export function describeBooking(b, now = Date.now()) {
  const today = todayISO()
  if (b.status === 'cancelled') return { tab: 'cancelled', label: 'Cancelled', tone: 'cancelled' }
  if (b.status === 'expired' || (b.status === 'pending' && new Date(b.holdExpiresAt) <= now)) return { tab: 'cancelled', label: 'Expired', tone: 'expired' }
  if (b.status === 'pending') return { tab: 'upcoming', label: 'Awaiting payment', tone: 'pending' }
  if (day(b.checkOut) < today) return { tab: 'past', label: 'Completed', tone: 'done' }
  if (day(b.checkIn) === today) return { tab: 'upcoming', label: 'Check-in today', tone: 'confirmed' }
  if (day(b.checkIn) < today) return { tab: 'upcoming', label: 'Staying now', tone: 'confirmed' }
  return { tab: 'upcoming', label: 'Confirmed', tone: 'confirmed' }
}

/** Unpaid holds, and paid stays up to and including the check-in day. Mirrors the server rule in bookingService.cancelBooking. */
export const canCancelBooking = (b) => {
  if (describeBooking(b).tab !== 'upcoming') return false
  return b.status === 'pending' || day(b.checkIn) >= todayISO()
}

/** Why a paid, upcoming-tab booking can't be cancelled (so the UI can say so instead of just hiding the button). */
export const cancelBlockedNote = (b) =>
  describeBooking(b).tab === 'upcoming' && b.status === 'confirmed' && day(b.checkIn) < todayISO()
    ? "This stay is under way, so it can't be cancelled online. Contact the host if you need to change it."
    : null

export const isRefundable = (b) => b.status === 'confirmed' && new Date(b.checkIn).getTime() - Date.now() >= FULL_REFUND_MS

export const paidWith = (b) => b.payment?.attempts?.find((a) => a.status === 'succeeded')?.label || (b.payment?.provider === 'razorpay' ? 'Razorpay' : null)

/** Nights ("YYYY-MM-DD") the guest holds or has paid for, so the calendar can mark them as theirs. */
export function myNights(bookings) {
  const out = new Set()
  for (const b of bookings) {
    const d = describeBooking(b)
    if (d.tab !== 'upcoming') continue // paid or currently held; completed/cancelled/expired nights are not "mine" any more
    const start = day(b.checkIn)
    for (let i = 0, n = diffDays(start, day(b.checkOut)); i < n; i++) out.add(addDays(start, i))
  }
  return out
}
