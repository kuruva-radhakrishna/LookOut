export const GST_RATE = 0.18 // mirrors the server; the server's number is the one that's charged

export const inr = (rupees) => `₹${Math.round(rupees).toLocaleString('en-IN')}`
export const inrFromPaise = (paise) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`

// ---- day strings ("YYYY-MM-DD"), handled in UTC so time zones can't shift a date ----
const DAY = 86400000
export const toISO = (d) => d.toISOString().slice(0, 10)
export const fromISO = (s) => new Date(`${s}T00:00:00Z`)
export const addDays = (s, n) => toISO(new Date(fromISO(s).getTime() + n * DAY))
export const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / DAY)
export const todayISO = () => {
  const n = new Date()
  return toISO(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())))
}
export const fmtDate = (s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const iso = typeof s === 'string' ? s.slice(0, 10) : toISO(new Date(s))
  return fromISO(iso).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' })
}

export function priceStay(cost, nights) {
  const subtotal = Math.round(cost * 100) * nights
  const tax = Math.round(subtotal * GST_RATE)
  return { subtotal, tax, total: subtotal + tax }
}
